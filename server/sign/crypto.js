// Tokens, hashes and the tamper-evident audit chain.
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

// Crockford base32: no I, L, O or U, so an ID survives being read aloud.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export const sha256Hex = (data) => createHash('sha256').update(data).digest('hex');

export const randomSecret = () => randomBytes(32).toString('base64url');

export function newEnvelopeId() {
  return Array.from({ length: 12 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
}

export const formatEnvelopeId = (id) => `${id.slice(0, 4)}-${id.slice(4, 8)}-${id.slice(8)}`;

export const newId = (prefix) => `${prefix}${randomBytes(5).toString('hex')}`;

export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

export function hashesEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// Key order must never change a hash, so objects are serialized sorted.
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

// Each event commits to the one before it, so editing or dropping any entry
// breaks every later hash, and the head is written into the sealed certificate.
export function appendEvent(env, type, { actor, ip, ua, details, at = new Date().toISOString() } = {}) {
  const prev = env.events.at(-1)?.hash ?? '';
  const body = {
    seq: env.events.length + 1,
    at,
    type,
    actor: actor ?? { kind: 'system' },
    ...(ip ? { ip } : {}),
    ...(ua ? { ua } : {}),
    ...(details ? { details } : {}),
    prev,
  };
  env.events.push({ ...body, hash: sha256Hex(prev + canonicalJson(body)) });
}

export function verifyChain(events) {
  let prev = '';
  for (let i = 0; i < events.length; i++) {
    const { hash, ...body } = events[i];
    if (body.seq !== i + 1 || body.prev !== prev) return false;
    if (sha256Hex(prev + canonicalJson(body)) !== hash) return false;
    prev = hash;
  }
  return true;
}
