// Solaria Capital production server.
// Serves the built React app from /dist and exposes:
//   GET  /api/quotes?symbols=AAPL,MSFT,^GSPC   -> Yahoo Finance (server-side, no CORS)
//   GET  /api/crypto?ids=bitcoin,ethereum      -> CoinGecko
//   POST /api/contact                          -> emails the partner inbox via Resend
//
// Same-origin from the browser, so the live ticker stops paying the CORS tax
// and the contact form never exposes the partner email address to the DOM.

import http from 'node:http';
import { promises as fs, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContactHandler } from './contact.js';
import { CARD_PROFILES, getCardProfile } from './card-profiles.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '..', 'dist');

// Optional local .env (Cloud Run sets env vars directly; this is for `npm run server`).
function loadDotEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadDotEnv();

const PORT = parseInt(process.env.PORT || '8080', 10);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.txt':  'text/plain; charset=utf-8',
  '.map':  'application/json; charset=utf-8',
  '.xml':  'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

// ---- tiny in-memory TTL cache --------------------------------------------
const cache = new Map();
function cacheGet(key, ttlMs) {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() - e.t > ttlMs) {
    cache.delete(key);
    return null;
  }
  return e.v;
}
function cacheSet(key, v) {
  cache.set(key, { t: Date.now(), v });
}

// ---- Stooq (primary): single CSV call, no key, US equities + indexes ------
// Returns intraday session change (close vs open today). Real prices.
const STOOQ_OVERRIDES = {
  '^GSPC': '^spx',
  '^NDX':  '^ndx',
  '^DJI':  '^dji',
};
function toStooqSymbol(s) {
  if (STOOQ_OVERRIDES[s]) return STOOQ_OVERRIDES[s];
  if (s.startsWith('^')) return s.toLowerCase();
  return `${s.toLowerCase()}.us`;
}

async function fetchStooqQuotes(symbols) {
  const cacheKey = `stq:${symbols.join(',')}`;
  const cached = cacheGet(cacheKey, 30_000);
  if (cached) return cached;

  const stooqSyms = symbols.map(toStooqSymbol);
  const reverse = new Map();
  symbols.forEach((s, i) => reverse.set(stooqSyms[i].toLowerCase(), s));

  // Stooq uses literal '+' to separate symbols in the `s=` param —
  // encode each symbol individually but keep the '+' separators raw.
  const url =
    `https://stooq.com/q/l/?s=${stooqSyms.map(encodeURIComponent).join('+')}` +
    `&f=sd2t2ohlc&h&e=csv`;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(7000),
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 ' +
        '(KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      'Accept': 'text/csv,text/plain,*/*',
    },
  });
  if (!res.ok) throw new Error(`stooq http ${res.status}`);
  const text = await res.text();
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error(`stooq no rows; body=${text.slice(0, 200)}`);

  const quotes = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 7) continue;
    // Symbol, Date, Time, Open, High, Low, Close
    const stooqSym = cols[0].toLowerCase();
    const open = parseFloat(cols[3]);
    const close = parseFloat(cols[6]);
    if (!isFinite(open) || !isFinite(close) || open <= 0) continue;
    const canonical = reverse.get(stooqSym);
    if (!canonical) continue;
    const change = close - open;
    const changePct = (change / open) * 100;
    quotes.push({
      symbol: canonical,
      price: close,
      change,
      changePct,
      prevClose: open, // intraday session change (open as reference)
      currency: 'USD',
      isLive: true,
    });
  }
  if (quotes.length > 0) cacheSet(cacheKey, quotes);
  return quotes;
}

// ---- Yahoo Finance (fallback): per-symbol chart endpoint -----------------
const YAHOO_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 ' +
    '(KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  'Accept': 'application/json,text/plain,*/*',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function fetchYahooOne(symbol) {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=1d&range=1d`;
  const res = await fetch(url, {
    headers: YAHOO_HEADERS,
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`yahoo http ${res.status} for ${symbol}`);
  // Yahoo serves rate-limit body as text/html with HTTP 200 — guard it.
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('json')) throw new Error(`yahoo non-json for ${symbol}`);
  const json = await res.json();
  const meta = json?.chart?.result?.[0]?.meta;
  if (!meta || meta.regularMarketPrice == null) {
    throw new Error(`yahoo bad payload for ${symbol}`);
  }
  const price = meta.regularMarketPrice;
  const prev = meta.chartPreviousClose ?? meta.previousClose ?? price;
  const change = price - prev;
  const changePct = prev ? (change / prev) * 100 : 0;
  return {
    symbol,
    price,
    change,
    changePct,
    prevClose: prev,
    currency: meta.currency || 'USD',
    isLive: true,
  };
}

async function fetchYahooQuotes(symbols) {
  const cacheKey = `yh:${symbols.join(',')}`;
  const cached = cacheGet(cacheKey, 30_000);
  if (cached) return cached;
  const settled = await Promise.allSettled(symbols.map(fetchYahooOne));
  const quotes = settled
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value);
  if (quotes.length > 0) cacheSet(cacheKey, quotes);
  return quotes;
}

// Combined equity fetcher: Stooq first, Yahoo for any missing symbols.
async function fetchEquityQuotes(symbols) {
  let primary = [];
  try {
    primary = await fetchStooqQuotes(symbols);
  } catch (e) {
    console.warn('[server] stooq failed:', e.message);
  }
  const have = new Set(primary.map((q) => q.symbol));
  const missing = symbols.filter((s) => !have.has(s));
  if (missing.length === 0) return primary;
  let secondary = [];
  try {
    secondary = await fetchYahooQuotes(missing);
  } catch (e) {
    console.warn('[server] yahoo fallback failed:', e.message);
  }
  return [...primary, ...secondary];
}

// ---- CoinGecko ------------------------------------------------------------
async function fetchCoinGecko(ids) {
  const cacheKey = `cg:${ids.join(',')}`;
  const cached = cacheGet(cacheKey, 60_000);
  if (cached) return cached;

  const url =
    `https://api.coingecko.com/api/v3/simple/price` +
    `?ids=${encodeURIComponent(ids.join(','))}` +
    `&vs_currencies=usd&include_24hr_change=true`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`coingecko http ${res.status}`);
  const json = await res.json();

  // Map CoinGecko id -> symbol & assemble normalised quote shape
  const symbolByCgId = {
    bitcoin: 'BTC-USD',
    ethereum: 'ETH-USD',
    solana: 'SOL-USD',
    ripple: 'XRP-USD',
  };
  const quotes = [];
  for (const id of ids) {
    const row = json[id];
    if (!row || row.usd == null) continue;
    const price = row.usd;
    const pctChange = row.usd_24h_change ?? 0;
    const prevClose = price / (1 + pctChange / 100);
    quotes.push({
      symbol: symbolByCgId[id] || id.toUpperCase(),
      price,
      change: price - prevClose,
      changePct: pctChange,
      prevClose,
      currency: 'USD',
      isLive: true,
    });
  }
  if (quotes.length > 0) cacheSet(cacheKey, quotes);
  return quotes;
}

const contact = createContactHandler();

// ---- digital business cards: GET /card/:profile-id.vcf ------------------
// The card page links straight to this URL. Served as a real text/vcard
// response, iOS Safari opens the native "Create New Contact" sheet on the
// spot, and Android / desktop download a correctly named .vcf. (A Blob
// download built in the page can't do that on iOS — it lands in Files.)
// No Content-Disposition on purpose: "attachment" makes iOS save to Files
// instead of opening Contacts; browsers that can't render vCards download
// anyway, naming the file after the URL.
const CARD_VCF_ROUTES = new Map(
  Object.values(CARD_PROFILES).map((card) => [`/card/${card.id}.vcf`, card]),
);

function vcfEscape(v) {
  return String(v)
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

// RFC 2426 line folding: 75 chars, continuation lines start with a space.
function vcfFold(line) {
  const out = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length) {
    out.push(' ' + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  return out.join('\r\n');
}

// `saved` is the recipient's local calendar date (YYYY-MM-DD), sent by the
// page so the note records when they saved the card, without implying a meeting.
function buildCardVcf(card, savedParam) {
  const fmt = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  let saved = '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(savedParam || '')) {
    const d = new Date(`${savedParam}T12:00:00Z`);
    // Date normalizes impossible days (for example February 30); reject them.
    if (!Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === savedParam) {
      saved = d.toLocaleDateString('en-US', { ...fmt, timeZone: 'UTC' });
    }
  }
  if (!saved) saved = new Date().toLocaleDateString('en-US', { ...fmt, timeZone: 'America/Los_Angeles' });

  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${vcfEscape(card.last)};${vcfEscape(card.first)};;;`,
    `FN:${vcfEscape(`${card.first} ${card.last}`)}`,
    `ORG:${vcfEscape(card.org)}`,
    `TITLE:${vcfEscape(card.title)}`,
    ...(card.tel ? [`TEL;TYPE=CELL,VOICE:${card.tel}`] : []),
    ...(card.email ? [`EMAIL;TYPE=INTERNET,WORK:${card.email}`] : []),
    `item1.URL:${card.site}`,
    'item1.X-ABLabel:Website',
    ...(card.linkedin ? [
      `item2.URL:${card.linkedin}`,
      'item2.X-ABLabel:LinkedIn',
      `X-SOCIALPROFILE;TYPE=linkedin:${card.linkedin}`,
    ] : []),
    `NOTE:${vcfEscape(`Saved on ${saved} — Solaria Capital digital card (${card.page}).`)}`,
    `REV:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
  ];
  lines.push('END:VCARD');
  return lines.map(vcfFold).join('\r\n') + '\r\n';
}

function handleCardVcf(req, res, url, card) {
  // Keep links from earlier versions of the card working; `saved` takes priority.
  const body = buildCardVcf(card, url.searchParams.get('saved') ?? url.searchParams.get('met'));
  res.writeHead(200, {
    'Content-Type': 'text/vcard; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

// ---- static file serving --------------------------------------------------
async function serveStatic(req, res, urlPath) {
  let safe = path.normalize(urlPath).replace(/^(\.\.[\\/])+/, '');
  if (safe === '/' || safe === '') safe = '/index.html';
  let filePath = path.join(DIST, safe);

  // SPA fallback: if file doesn't exist, serve index.html (for routes / 404s)
  try {
    const st = await fs.stat(filePath);
    if (st.isDirectory()) filePath = path.join(filePath, 'index.html');
  } catch {
    filePath = path.join(DIST, 'index.html');
    safe = '/index.html';
  }

  let data;
  try {
    data = await fs.readFile(filePath);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';
  const isAsset = safe.startsWith('/assets/');
  const cacheControl = isAsset
    ? 'public, max-age=31536000, immutable'
    : 'no-cache';

  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': cacheControl,
  });
  res.end(data);
}

// ---- request router -------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const startedAt = Date.now();
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    if (pathname === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
      return;
    }

    if (pathname === '/api/quotes') {
      const symbols = String(url.searchParams.get('symbols') || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 25);
      if (symbols.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'symbols query param required' }));
        return;
      }
      const quotes = await fetchEquityQuotes(symbols);
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=15, s-maxage=15',
      });
      res.end(JSON.stringify({ quotes, fetchedAt: new Date().toISOString() }));
      return;
    }

    if (pathname === '/api/contact' || pathname.startsWith('/api/contact/')) {
      await contact(req, res, pathname);
      return;
    }

    const card = CARD_VCF_ROUTES.get(pathname);
    if (card) {
      handleCardVcf(req, res, url, card);
      return;
    }

    if (pathname === '/api/crypto') {
      const ids = String(url.searchParams.get('ids') || 'bitcoin,ethereum')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 10);
      const quotes = await fetchCoinGecko(ids);
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=30, s-maxage=30',
      });
      res.end(JSON.stringify({ quotes, fetchedAt: new Date().toISOString() }));
      return;
    }

    await serveStatic(req, res, pathname);
  } catch (err) {
    console.error('[server] error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: String(err.message || err) }));
  } finally {
    const ms = Date.now() - startedAt;
    if (ms > 200) console.log(`[server] ${req.method} ${req.url} ${ms}ms`);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Solaria Capital server listening on :${PORT}, serving ${DIST}`);
});
