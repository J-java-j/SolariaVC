import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt } from 'node:crypto';
import { isIP } from 'node:net';
import { getCardProfile } from './card-profiles.js';
import { buildInquiryEmail, buildVerificationEmail, createEmailSender } from './contact-email.js';
import { createMemoryStore, createRedisStore } from './contact-store.js';

const TEN_MINUTES = 600_000;
const KINDS = new Set(['fund', 'ventures', 'founder', 'investor', 'research', 'subscribe', 'card', 'other']);
const LOOPBACK_ORIGINS = new Set(['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:8080', 'http://127.0.0.1:8080']);

class ContactError extends Error {
  constructor(status, message, retryAfter) { super(message); this.status = status; this.retryAfter = retryAfter; }
}

export function loadContactConfig(env = process.env) {
  const local = env.CONTACT_LOCAL_DEV === 'true' && env.NODE_ENV !== 'production' && !env.K_SERVICE;
  const origins = new Set((env.CONTACT_ALLOWED_ORIGINS || 'https://solariavc.com,https://www.solariavc.com').split(',').map(s => s.trim()).filter(Boolean));
  const hostnames = new Set();
  let validOrigins = true;
  for (const origin of origins) {
    try {
      const url = new URL(origin);
      if (url.origin !== origin || url.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) validOrigins = false;
      hostnames.add(url.hostname);
    } catch { validOrigins = false; }
  }
  if (local) for (const origin of LOOPBACK_ORIGINS) origins.add(origin);
  const proxyHops = Number(env.CONTACT_TRUST_PROXY_HOPS || 0);
  const secret = env.CONTACT_VERIFICATION_SECRET || (local ? randomBytes(32).toString('base64') : '');
  const from = env.CONTACT_FROM_EMAIL || '';
  const config = {
    local, origins, hostnames, proxyHops, secret, from,
    siteKey: env.TURNSTILE_SITE_KEY || '', turnstileSecret: env.TURNSTILE_SECRET_KEY || '',
    redisUrl: env.UPSTASH_REDIS_REST_URL || '', redisToken: env.UPSTASH_REDIS_REST_TOKEN || '',
    apiKey: env.RESEND_API_KEY || '',
  };
  config.available = Boolean(
    validOrigins && origins.size && Number.isInteger(proxyHops) && proxyHops >= 0 && proxyHops <= 10 &&
    secret.length >= 32 && config.apiKey && from && !/[\r\n]/.test(from) &&
    (local || (config.siteKey && config.turnstileSecret && config.redisUrl && config.redisToken && !/@resend\.dev\b/i.test(from)))
  );
  return config;
}

export function normalizeEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim();
  if (email.length > 200) return null;
  const at = email.lastIndexOf('@');
  const local = email.slice(0, at);
  const domain = email.slice(at + 1).toLowerCase();
  // Practical ASCII mailbox syntax; quoted local parts and address literals are unsupported.
  if (at < 1 || local.length > 64 || !/^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/i.test(local) || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return null;
  if (!domain.includes('.') || domain.length > 253 || !domain.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)) || !/^[a-z]{2,63}$/i.test(domain.split('.').at(-1))) return null;
  return `${local}@${domain}`;
}

export function emailRateIdentity(email) {
  let [local, domain] = email.toLowerCase().split('@');
  local = local.split('+')[0];
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') local = local.replaceAll('.', '');
  return `${local}@${domain}`;
}

export function clientIdentity(req, proxyHops = 0) {
  let address = req.socket.remoteAddress || '';
  if (proxyHops) {
    const forwarded = typeof req.headers['x-forwarded-for'] === 'string' ? req.headers['x-forwarded-for'].split(',').map(s => s.trim()) : [];
    if (forwarded.length < proxyHops) throw new ContactError(400, 'Unable to verify request origin.');
    address = forwarded[forwarded.length - proxyHops];
  }
  if (isIP(address) === 4) return address;
  if (isIP(address) === 6) {
    const canonical = new URL(`http://[${address}]`).hostname.slice(1, -1);
    const [left, right = ''] = canonical.split('::');
    const a = left ? left.split(':') : [];
    const b = right ? right.split(':') : [];
    const groups = canonical.includes('::') ? [...a, ...Array(8 - a.length - b.length).fill('0'), ...b] : a;
    const numbers = groups.map(g => parseInt(g, 16));
    if (numbers.slice(0, 5).every(n => n === 0) && numbers[5] === 65535) {
      return [numbers[6] >> 8, numbers[6] & 255, numbers[7] >> 8, numbers[7] & 255].join('.');
    }
    // Group IPv6 by /64, so rotating an address in one subnet doesn't reset quotas.
    return `${numbers.slice(0, 4).map(n => n.toString(16)).join(':')}::/64`;
  }
  throw new ContactError(400, 'Unable to verify request origin.');
}

export function validatePayload(p) {
  const str = (v, max, required = false, multiline = false) => {
    if (v === undefined && !required) return '';
    if (typeof v !== 'string' || v.length > max || (multiline ? /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/ : /[\x00-\x1f\x7f]/).test(v)) throw new ContactError(400, 'Please check your contact details.');
    const text = v.trim();
    if (required && !text) throw new ContactError(400, 'Please complete all required fields.');
    return text;
  };
  const name = str(p.name, 120, true);
  const email = normalizeEmail(p.email);
  if (!email) throw new ContactError(400, 'Please enter a valid email address.');
  const message = str(p.message, 8000, true, true);
  if (message.length < 3) throw new ContactError(400, 'Please add a message of at least 3 characters.');
  if (typeof p.kind !== 'string' || !KINDS.has(p.kind)) throw new ContactError(400, 'Please choose an inquiry type.');
  const phone = str(p.phone, 40);
  const organization = str(p.organization, 200);
  const card = p.kind === 'card' ? getCardProfile(p.cardId) : null;
  if (p.kind === 'card' && (!card || !card.email)) throw new ContactError(400, 'Unknown digital card.');
  return { name, email, message, phone, organization, kind: p.kind, ...(card ? { cardId: card.id } : {}) };
}

function readJson(req, limit = 20_000) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    const cleanup = () => { req.off('data', onData); req.off('end', onEnd); req.off('error', onError); req.off('aborted', onAborted); };
    const onError = () => { cleanup(); reject(new ContactError(400, 'Invalid request.')); };
    const onAborted = onError;
    const onData = chunk => {
      total += chunk.length;
      if (total > limit) { cleanup(); req.resume(); reject(new ContactError(413, 'Message is too large.')); }
      else chunks.push(chunk);
    };
    const onEnd = () => {
      cleanup();
      try {
        const p = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!p || typeof p !== 'object' || Array.isArray(p)) throw new Error();
        resolve(p);
      } catch { reject(new ContactError(400, 'Invalid JSON object.')); }
    };
    req.on('data', onData).on('end', onEnd).on('error', onError).on('aborted', onAborted);
  });
}

export function createContactHandler({ env = process.env, store: suppliedStore, fetchImpl = fetch, sendEmail: suppliedSender, now = Date.now, logger = console } = {}) {
  const config = loadContactConfig(env);
  let store = suppliedStore;
  if (!store && config.available) {
    try { store = config.local ? createMemoryStore({ now }) : createRedisStore({ url: config.redisUrl, token: config.redisToken, fetchImpl }); }
    catch { config.available = false; }
  }
  const sendEmail = suppliedSender || createEmailSender({ apiKey: config.apiKey, fetchImpl });
  const key = createHash('sha256').update(`encryption:${config.secret}`).digest();
  const hashKey = createHash('sha256').update(`authentication:${config.secret}`).digest();
  const hash = value => createHmac('sha256', hashKey).update(value).digest('hex');
  function encrypt(payload, id) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(id));
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
  }
  function decrypt(value, id) {
    const bytes = Buffer.from(value, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    decipher.setAAD(Buffer.from(id));
    return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8'));
  }
  async function limit(key, count, windowMs) {
    const wait = await store.rateLimit(key, count, windowMs);
    if (!Number.isFinite(wait) || wait < 0) throw new Error('invalid contact quota response');
    if (wait > 0) throw new ContactError(429, 'Too many attempts. Please wait before trying again.', Math.max(1, Math.ceil(wait / 1000)));
  }
  async function verifyBot(token, origin) {
    if (config.local && LOOPBACK_ORIGINS.has(origin)) return;
    if (typeof token !== 'string' || !token || token.length > 2048) throw new ContactError(400, 'Please complete the human check.');
    const response = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(5000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: config.turnstileSecret, response: token }),
    });
    if (!response.ok) throw new Error('human check unavailable');
    const result = await response.json();
    if (result.success !== true || result.action !== 'contact' || !config.hostnames.has(result.hostname)) throw new ContactError(400, 'The human check expired or failed. Please try again.');
  }
  const reply = (res, status, body, headers = {}) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
    res.end(JSON.stringify(body));
  };
  return async function handleContact(req, res, pathname) {
    if (pathname === '/api/contact/config' && req.method === 'GET') return reply(res, 200, { available: config.available, siteKey: config.local ? '' : config.siteKey });
    if (!['/api/contact', '/api/contact/verify', '/api/contact/config'].includes(pathname)) return reply(res, 404, { error: 'Not found.' });
    if (req.method !== 'POST' || pathname === '/api/contact/config') return reply(res, 405, { error: 'Method not allowed.' }, { Allow: pathname.endsWith('/config') ? 'GET' : 'POST' });
    try {
      if (!config.available || !store) throw new ContactError(503, 'The contact form is temporarily unavailable. Please try again later.');
      const origin = req.headers.origin;
      if (typeof origin !== 'string' || !config.origins.has(origin) || (config.local && !LOOPBACK_ORIGINS.has(origin)) || req.headers['sec-fetch-site'] === 'cross-site') throw new ContactError(403, 'Please submit this form from the Solaria website.');
      if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new ContactError(415, 'JSON content type required.');
      if (req.headers['content-encoding'] && req.headers['content-encoding'] !== 'identity') throw new ContactError(415, 'Unsupported content encoding.');
      const ip = hash(`ip:${clientIdentity(req, config.proxyHops)}`);
      await limit(`attempt:${ip}`, 30, TEN_MINUTES);
      await limit('attempt:global', 1000, 60_000);
      const p = await readJson(req);
      if (pathname === '/api/contact/verify') {
        if (typeof p.verificationId !== 'string' || !/^[a-f0-9]{48}$/.test(p.verificationId) || typeof p.code !== 'string' || !/^\d{6}$/.test(p.code)) throw new ContactError(400, 'Enter the six-digit code from your email.');
        const id = p.verificationId;
        const owner = randomBytes(16).toString('hex');
        const result = await store.claim(id, hash(`code:${id}:${p.code}`), owner);
        if (result.status === 'sent') return reply(res, 200, { ok: true, sent: true });
        if (result.status === 'busy') throw new ContactError(429, 'Your message is being sent. Please try again shortly.', 3);
        if (result.status !== 'claimed') throw new ContactError(400, 'The code is incorrect, expired, or has too many attempts. Check the code or start again.');
        try {
          const email = decrypt(result.encrypted, id);
          await sendEmail(email, `solaria-contact/${id}`);
          if (!await store.finish(id, owner, 'sent')) throw new Error('verification state changed');
        } catch (error) {
          // The provider may already have accepted delivery. Retrying with the same
          // stored email + idempotency key is safe, including after lease expiry.
          await store.finish(id, owner, 'pending').catch(() => {});
          throw error;
        }
        return reply(res, 200, { ok: true, sent: true });
      }
      if (p.website !== undefined && typeof p.website !== 'string') throw new ContactError(400, 'Invalid request.');
      // Give bots the same first-step response without sending any email.
      if (p.website?.trim()) return reply(res, 200, { ok: true, verificationRequired: true, verificationId: randomBytes(24).toString('hex') });
      const payload = validatePayload(p);
      await limit(`request:${ip}`, 5, TEN_MINUTES);
      await verifyBot(p.turnstileToken, origin);
      const emailKey = hash(`email:${emailRateIdentity(payload.email)}`);
      await limit(`email:cooldown:${emailKey}`, 1, 60_000);
      await limit(`email:hour:${emailKey}`, 3, 3_600_000);
      await limit(`email:day:${emailKey}`, 5, 86_400_000);
      await limit('email:global:hour', 30, 3_600_000);
      await limit('email:global:day', 100, 86_400_000);
      const id = randomBytes(24).toString('hex');
      const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
      payload.submittedAt = new Date(now()).toISOString();
      const email = buildInquiryEmail(payload, config.from);
      await store.put(id, { codeHash: hash(`code:${id}:${code}`), encrypted: encrypt(email, id), attempts: 0, status: 'pending' }, TEN_MINUTES);
      const verificationEmail = buildVerificationEmail(payload.email, code, config.from);
      // A timeout can mean the provider accepted the mail. One identical retry
      // recovers this without generating a new code or sending a second email.
      try { await sendEmail(verificationEmail, `solaria-verification/${id}`); }
      catch { await sendEmail(verificationEmail, `solaria-verification/${id}`); }
      return reply(res, 200, { ok: true, verificationRequired: true, verificationId: id });
    } catch (error) {
      if (error instanceof ContactError) return reply(res, error.status, { ok: false, error: error.message }, error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : {});
      // Avoid raw errors, request payloads, addresses, verification codes and secrets in logs.
      logger.error('[contact] dependency unavailable; request not confirmed');
      return reply(res, 503, { ok: false, error: 'We could not confirm your request. Please wait a moment and try again.' }, { 'Retry-After': '10' });
    }
  };
}
