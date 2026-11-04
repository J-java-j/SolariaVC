// HTTP surface for Solaria Sign, imported lazily by server/index.js so the marketing
// site never pays its cold-start cost.
//
// Signer tokens travel in the URL fragment and reach this server only as an
// Authorization header. That keeps them out of Cloud Run request logs, Referer
// headers and the mail scanners that follow every link they see.
import { LIMITS, loadConfig } from './config.js';
import { createMailer } from './mail.js';
import { HttpError, createSignService } from './envelopes.js';
import { PdfRejected } from './pdf.js';
import { createLocalStore } from './store-local.js';

const config = loadConfig();

let servicePromise = null;
function service() {
  servicePromise ??= (async () => {
    const store = config.store === 'gcp'
      ? (await import('./store-gcp.js')).createGcpStore(config)
      : createLocalStore(config.dataDir);
    return createSignService({ store, config, mail: createMailer(config) });
  })();
  return servicePromise;
}

const SESSION_COOKIE = config.production ? '__Host-solaria_sign' : 'solaria_sign';

// In-memory and per instance, like the contact form's limiter: a stopgap against
// floods. The limits that matter (code attempts, resends) live on the envelope.
const hits = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) throw new HttpError(429, 'Too many requests. Please wait a little and try again.');
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
}

// Cloud Run appends the address it saw, so only the last entry is trustworthy; a
// client can put anything it likes earlier in the list.
function clientInfo(req) {
  const forwarded = String(req.headers['x-forwarded-for'] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return {
    ip: forwarded.at(-1) || req.socket.remoteAddress || 'unknown',
    ua: String(req.headers['user-agent'] ?? '').slice(0, 300),
  };
}

function cookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie ?? '').split(';')) {
    const at = part.indexOf('=');
    if (at > 0) out[part.slice(0, at).trim()] = part.slice(at + 1).trim();
  }
  return out;
}

async function readBody(req, limit) {
  if (Number(req.headers['content-length'] ?? 0) > limit) throw new HttpError(413, 'That file is too large.');
  let total = 0;
  const chunks = [];
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limit) throw new HttpError(413, 'That file is too large.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJson(req, limit = 64 * 1024) {
  const raw = await readBody(req, limit);
  if (!raw.length) return {};
  try {
    const value = JSON.parse(raw.toString('utf8'));
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  } catch { /* falls through to the error below */ }
  throw new HttpError(400, 'Invalid request.');
}

const BASE_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
};

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, { ...BASE_HEADERS, 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(body));
}

function sendFile(res, { bytes, fileName }) {
  res.writeHead(200, {
    ...BASE_HEADERS,
    'Content-Type': 'application/pdf',
    'Content-Length': bytes.length,
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    'Content-Security-Policy': "sandbox; default-src 'none'",
  });
  res.end(bytes);
}

// The session cookie is SameSite=Strict; this also refuses forged cross-site posts
// from browsers that send an Origin header.
function assertSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return;
  let host;
  try {
    host = new URL(origin).host;
  } catch {
    throw new HttpError(403, 'Forbidden.');
  }
  const local = !config.production && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  if (host !== req.headers.host && !local) throw new HttpError(403, 'Forbidden.');
}

const bearer = (req) => /^Bearer (.+)$/.exec(String(req.headers.authorization ?? ''))?.[1];
const verifiedHeader = (req) => String(req.headers['x-sign-verified'] ?? '') || undefined;

async function signer(req, res, svc, action) {
  const token = bearer(req);
  const verified = verifiedHeader(req);
  const info = clientInfo(req);
  rateLimit(`s:${info.ip}`, 120, 60_000);
  switch (action) {
    case 'GET session': return sendJson(res, 200, await svc.signerSession(token, verified));
    case 'POST code/send':
      rateLimit(`code:${info.ip}`, 10, 600_000);
      await svc.sendCode(token, info);
      return sendJson(res, 200, { ok: true });
    case 'POST code/verify': {
      rateLimit(`verify:${info.ip}`, 30, 600_000);
      const body = await readJson(req);
      return sendJson(res, 200, await svc.verifyCode(token, body.code, info));
    }
    case 'GET document': return sendFile(res, await svc.signerDocument(token, verified));
    case 'POST viewed':
      await svc.recordViewed(token, verified, info);
      return sendJson(res, 200, { ok: true });
    case 'POST consent':
      await svc.recordConsent(token, verified, await readJson(req), info);
      return sendJson(res, 200, { ok: true });
    case 'POST submit': {
      const body = await readJson(req, LIMITS.signatureBytes * 3 + 256 * 1024);
      return sendJson(res, 200, await svc.submit(token, verified, body, info));
    }
    case 'POST finish': return sendJson(res, 200, await svc.finishFromSigner(token, verified));
    case 'POST decline': return sendJson(res, 200, await svc.decline(token, verified, await readJson(req), info));
    case 'GET sealed': return sendFile(res, await svc.signerSealedFile(token, verified));
    default: throw new HttpError(404, 'Not found.');
  }
}

async function signedInUser(req, svc) {
  if (req.method !== 'GET') assertSameOrigin(req);
  const user = await svc.authenticate(cookies(req)[SESSION_COOKIE]);
  if (!user) throw new HttpError(401, 'Please sign in.');
  return user;
}

async function team(req, res, svc, action) {
  const user = await signedInUser(req, svc);
  if (req.method === 'GET' && !action) return sendJson(res, 200, { people: await svc.listTeam(user) });
  if (req.method === 'POST' && !action) return sendJson(res, 201, await svc.addAdmin(user, await readJson(req)));
  if (req.method === 'POST' && action === 'remove') {
    await svc.removeAdmin(user, (await readJson(req)).email);
    return sendJson(res, 200, { ok: true });
  }
  throw new HttpError(404, 'Not found.');
}

async function folders(req, res, svc, id) {
  const user = await signedInUser(req, svc);
  const { method } = req;
  if (!id && method === 'GET') return sendJson(res, 200, { folders: await svc.listFolders() });
  if (!id && method === 'POST') return sendJson(res, 201, await svc.createFolder(user, (await readJson(req)).name));
  if (id && method === 'PUT') return sendJson(res, 200, await svc.renameFolder(id, (await readJson(req)).name));
  if (id && method === 'DELETE') {
    await svc.deleteFolder(id);
    return sendJson(res, 200, { ok: true });
  }
  throw new HttpError(405, 'Method not allowed.');
}

async function sender(req, res, url, svc, parts) {
  const user = await signedInUser(req, svc);
  const method = req.method;
  const info = clientInfo(req);

  const [id, action] = parts;
  if (!id) {
    if (method === 'GET') return sendJson(res, 200, { envelopes: await svc.listEnvelopes() });
    if (method === 'POST') {
      const bytes = await readBody(req, LIMITS.uploadBytes);
      const name = url.searchParams.get('name') ?? 'Document.pdf';
      return sendJson(res, 201, await svc.createDraft(user, name, bytes, info, url.searchParams.get('folder')));
    }
    throw new HttpError(405, 'Method not allowed.');
  }
  if (id === 'selection' && method === 'POST') {
    const body = await readJson(req);
    switch (action) {
      case 'move':
        await svc.moveEnvelopes(body.ids, body.folderId);
        break;
      case 'delete':
        await svc.deleteEnvelopes(body.ids, user, info);
        break;
      case 'restore':
        await svc.restoreEnvelopes(body.ids, user, info);
        break;
      case 'erase':
        await svc.eraseEnvelopes(user, body.ids);
        break;
      default: throw new HttpError(404, 'Not found.');
    }
    return sendJson(res, 200, { ok: true });
  }
  if (!/^[0-9A-Z]{12}$/.test(id)) throw new HttpError(404, 'Document not found.');
  if (!action) {
    if (method === 'GET') return sendJson(res, 200, await svc.getEnvelope(id));
    if (method === 'PUT') return sendJson(res, 200, await svc.updateDraft(id, await readJson(req, 512 * 1024)));
    if (method === 'DELETE') {
      await svc.deleteDraft(id);
      return sendJson(res, 200, { ok: true });
    }
    throw new HttpError(405, 'Method not allowed.');
  }
  if (method === 'GET' && action === 'original') return sendFile(res, await svc.senderFile(id, 'original'));
  if (method === 'GET' && action === 'sealed') return sendFile(res, await svc.senderFile(id, 'sealed'));
  if (method === 'POST') {
    const body = await readJson(req);
    switch (action) {
      case 'send': return sendJson(res, 200, await svc.send(id, user, info));
      case 'remind':
        await svc.remind(id, body.recipientId);
        return sendJson(res, 200, { ok: true });
      case 'link': return sendJson(res, 200, await svc.newLink(id, body.recipientId, user, info));
      case 'void':
        await svc.voidEnvelope(id, body.reason, user, info);
        return sendJson(res, 200, { ok: true });
      case 'duplicate': return sendJson(res, 201, await svc.duplicate(id, user, info));
      case 'bulk': return sendJson(res, 200, await svc.bulkSend(id, user, info, body));
      case 'finish': return sendJson(res, 200, await svc.finish(id));
      case 'timestamp': return sendJson(res, 200, await svc.retryTimestamp(id));
      default: break;
    }
  }
  throw new HttpError(404, 'Not found.');
}

async function auth(req, res, svc, action) {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed.');
  assertSameOrigin(req);
  const { ip } = clientInfo(req);
  if (action === 'request') {
    rateLimit(`login:${ip}`, 5, 600_000);
    console.log('[sign] sign-in link requested from', ip);
    const body = await readJson(req);
    await svc.requestLogin(body.email);
    return sendJson(res, 200, { ok: true });
  }
  if (action === 'verify') {
    rateLimit(`login-verify:${ip}`, 20, 600_000);
    const body = await readJson(req);
    const { sessionId, maxAgeSeconds } = await svc.completeLogin(body.token);
    const secure = config.production ? ' Secure;' : '';
    return sendJson(res, 200, { ok: true }, {
      'Set-Cookie': `${SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly;${secure} SameSite=Strict; Max-Age=${maxAgeSeconds}`,
    });
  }
  if (action === 'logout') {
    await svc.logout(cookies(req)[SESSION_COOKIE]);
    const secure = config.production ? ' Secure;' : '';
    return sendJson(res, 200, { ok: true }, {
      'Set-Cookie': `${SESSION_COOKIE}=; Path=/; HttpOnly;${secure} SameSite=Strict; Max-Age=0`,
    });
  }
  throw new HttpError(404, 'Not found.');
}

export async function handleSignApi(req, res, url) {
  try {
    const svc = await service();
    const path = url.pathname.replace(/^\/api\/sign\/?/, '');
    const [area, ...parts] = path.split('/').filter(Boolean);
    switch (area) {
      case 'auth': return await auth(req, res, svc, parts[0]);
      case 'me': {
        const user = await svc.authenticate(cookies(req)[SESSION_COOKIE]);
        return sendJson(res, 200, { user });
      }
      case 'team': return await team(req, res, svc, parts[0]);
      case 'folders': return await folders(req, res, svc, parts[0]);
      case 'envelopes': return await sender(req, res, url, svc, parts);
      case 's': return await signer(req, res, svc, `${req.method} ${parts.join('/')}`);
      case 'verify': {
        rateLimit(`verify-hash:${clientInfo(req).ip}`, 30, 60_000);
        return sendJson(res, 200, await svc.verifyHash(parts[0] ?? ''));
      }
      default: throw new HttpError(404, 'Not found.');
    }
  } catch (e) {
    if (res.headersSent) throw e;
    if (e instanceof HttpError) return sendJson(res, e.status, { error: e.message });
    if (e instanceof PdfRejected) return sendJson(res, 422, { error: e.message });
    console.error('[sign] request failed:', e);
    return sendJson(res, 500, { error: 'Something went wrong. Please try again.' });
  }
}
