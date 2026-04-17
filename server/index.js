// Solaria production server.
// Serves the built React app from /dist and exposes:
//   GET  /api/quotes?symbols=AAPL,MSFT,^GSPC   -> Yahoo Finance (server-side, no CORS)
//   GET  /api/crypto?ids=bitcoin,ethereum      -> CoinGecko
//   POST /api/contact                          -> emails the partner inbox via Resend
//
// Same-origin from the browser, so the live ticker stops paying the CORS tax
// and the contact form never exposes the partner email address to the DOM.

import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = parseInt(process.env.PORT || '8080', 10);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '..', 'dist');

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

// ---- contact form: POST /api/contact → email partner inbox via Resend ---
// To enable real delivery, set RESEND_API_KEY in the Cloud Run service env.
// Without a key, submissions are logged to stdout (visible in Cloud Run logs).
const CONTACT_TO = process.env.CONTACT_TO_EMAIL || 'joj059@ucsd.edu';
const CONTACT_FROM = process.env.CONTACT_FROM_EMAIL || 'Solaria Contact <onboarding@resend.dev>';
const KIND_LABEL = {
  fund: 'Medallion Fund',
  ventures: 'Ventures',
  research: 'Research',
  subscribe: 'Research · Subscribe',
  other: 'General',
};

// Simple in-memory rate limiter: max 5 contact POSTs per IP per 10 min.
const rateLog = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const hits = (rateLog.get(ip) || []).filter((t) => now - t < windowMs);
  if (hits.length >= 5) {
    rateLog.set(ip, hits);
    return true;
  }
  hits.push(now);
  rateLog.set(ip, hits);
  return false;
}

async function readJson(req, limit = 20_000) {
  let total = 0;
  const chunks = [];
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limit) throw new Error('payload too large');
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf-8');
  if (!raw) return {};
  return JSON.parse(raw);
}

function esc(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderContactHtml(p) {
  const kindLabel = KIND_LABEL[p.kind] || KIND_LABEL.other;
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #04080a; color: #e5e7eb; padding: 28px 24px; max-width: 620px; margin: 0 auto;">
      <div style="border-left: 3px solid #10b981; padding-left: 12px; margin-bottom: 22px;">
        <div style="font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: #34d399;">Solaria · New inquiry</div>
        <div style="font-size: 22px; font-weight: 600; margin-top: 6px;">${esc(kindLabel)}</div>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 6px 0; color: #9ca3af; width: 140px;">From</td><td style="padding: 6px 0;">${esc(p.name)} &lt;${esc(p.email)}&gt;</td></tr>
        ${p.organization ? `<tr><td style="padding: 6px 0; color: #9ca3af;">Organization</td><td style="padding: 6px 0;">${esc(p.organization)}</td></tr>` : ''}
        <tr><td style="padding: 6px 0; color: #9ca3af;">Inquiry</td><td style="padding: 6px 0;">${esc(kindLabel)}</td></tr>
        <tr><td style="padding: 6px 0; color: #9ca3af;">Submitted</td><td style="padding: 6px 0;">${new Date().toISOString()}</td></tr>
      </table>
      <div style="margin-top: 22px; padding-top: 18px; border-top: 1px solid #1f2937;">
        <div style="font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #9ca3af;">Message</div>
        <div style="margin-top: 10px; white-space: pre-wrap; line-height: 1.55;">${esc(p.message)}</div>
      </div>
      <div style="margin-top: 28px; font-size: 11px; color: #6b7280;">
        Sent from the Solaria contact form. Reply directly to this email to respond to ${esc(p.name)}.
      </div>
    </div>
  `;
}

function renderContactText(p) {
  const kindLabel = KIND_LABEL[p.kind] || KIND_LABEL.other;
  return [
    `Solaria — new ${kindLabel} inquiry`,
    '',
    `From:         ${p.name} <${p.email}>`,
    p.organization ? `Organization: ${p.organization}` : null,
    `Inquiry:      ${kindLabel}`,
    `Submitted:    ${new Date().toISOString()}`,
    '',
    '---',
    '',
    p.message,
  ]
    .filter(Boolean)
    .join('\n');
}

async function sendViaResend(payload) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log('[contact] RESEND_API_KEY not set — logging submission:');
    console.log(JSON.stringify(payload, null, 2));
    return { sent: false, logged: true };
  }
  const kindLabel = KIND_LABEL[payload.kind] || KIND_LABEL.other;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: CONTACT_FROM,
      to: [CONTACT_TO],
      reply_to: payload.email,
      subject: `[Solaria · ${kindLabel}] ${payload.name}`,
      html: renderContactHtml(payload),
      text: renderContactText(payload),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`resend http ${res.status}: ${body.slice(0, 200)}`);
  }
  return { sent: true };
}

function jsonRes(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function handleContact(req, res) {
  const ip =
    (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim() ||
    req.socket.remoteAddress ||
    'unknown';

  if (rateLimited(ip)) {
    return jsonRes(res, 429, { error: 'rate limited — try again shortly' });
  }

  let p;
  try {
    p = await readJson(req);
  } catch {
    return jsonRes(res, 400, { error: 'invalid json' });
  }

  // Honeypot: a hidden field bots happily fill but humans don't.
  if (p.website) {
    console.log('[contact] honeypot triggered, silently accepting');
    return jsonRes(res, 200, { ok: true });
  }

  const name = String(p.name || '').trim();
  const email = String(p.email || '').trim();
  const organization = String(p.organization || '').trim().slice(0, 200);
  const message = String(p.message || '').trim();
  const kind = ['fund', 'ventures', 'research', 'subscribe', 'other'].includes(p.kind)
    ? p.kind
    : 'other';

  if (!name || name.length > 120) {
    return jsonRes(res, 400, { error: 'name required' });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
    return jsonRes(res, 400, { error: 'valid email required' });
  }
  if (!message || message.length < 3 || message.length > 8000) {
    return jsonRes(res, 400, { error: 'message required (3–8000 chars)' });
  }

  try {
    const result = await sendViaResend({ name, email, organization, message, kind });
    return jsonRes(res, 200, { ok: true, ...result });
  } catch (err) {
    console.error('[contact] send failed:', err);
    // Still return 200 so the user gets a clean "received" state — log captures it.
    return jsonRes(res, 200, { ok: true, sent: false, logged: true });
  }
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

    if (pathname === '/api/contact' && req.method === 'POST') {
      await handleContact(req, res);
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
  console.log(`Solaria server listening on :${PORT}, serving ${DIST}`);
});
