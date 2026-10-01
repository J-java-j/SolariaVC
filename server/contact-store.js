// Redis is the shared authority for quotas and one-time verification claims.
// All transitions are atomic and TTLs survive application instance restarts.
export const RATE_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[2]) end
if count > tonumber(ARGV[1]) then return redis.call('PTTL', KEYS[1]) end
return 0`;

export const CLAIM_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return cjson.encode({status='missing'}) end
local r = cjson.decode(raw)
if r.attempts >= 5 then return cjson.encode({status='locked'}) end
if r.codeHash ~= ARGV[1] then
  r.attempts = r.attempts + 1
  redis.call('SET', KEYS[1], cjson.encode(r), 'KEEPTTL')
  return cjson.encode({status='invalid'})
end
if r.status == 'sent' then return cjson.encode({status='sent'}) end
local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
if r.status == 'sending' and r.leaseUntil > now then return cjson.encode({status='busy'}) end
if r.verified and redis.call('PTTL', KEYS[1]) <= 30000 then return cjson.encode({status='expired'}) end
r.status = 'sending'
r.owner = ARGV[2]
r.leaseUntil = now + 30000
-- A correct code has now proved ownership. Keep a five-minute delivery/retry
-- window even if the original code was entered just before its expiry.
if not r.verified then
  r.verified = true
  local retention = math.max(redis.call('PTTL', KEYS[1]), 300000)
  redis.call('SET', KEYS[1], cjson.encode(r), 'PX', retention)
else
  redis.call('SET', KEYS[1], cjson.encode(r), 'KEEPTTL')
end
return cjson.encode({status='claimed', encrypted=r.encrypted})`;

export const FINISH_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local r = cjson.decode(raw)
if r.owner ~= ARGV[1] or r.status ~= 'sending' then return 0 end
r.status = ARGV[2]
r.owner = nil
r.leaseUntil = nil
if r.status == 'sent' then r.encrypted = nil end
redis.call('SET', KEYS[1], cjson.encode(r), 'KEEPTTL')
return 1`;

export function createRedisStore({ url, token, fetchImpl = fetch }) {
  const endpoint = new URL(url);
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new Error('Redis REST endpoint must use HTTPS without URL credentials');
  }
  async function command(args) {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(5000),
      redirect: 'error',
    });
    if (!response.ok) throw new Error('contact store unavailable');
    const data = await response.json();
    if (data.error || !Object.hasOwn(data, 'result')) throw new Error('contact store command failed');
    return data.result;
  }
  return {
    rateLimit: (key, limit, windowMs) => command(['EVAL', RATE_SCRIPT, '1', `solaria:rate:${key}`, String(limit), String(windowMs)]),
    async put(id, record, ttlMs) {
      const result = await command(['SET', `solaria:verification:${id}`, JSON.stringify(record), 'NX', 'PX', String(ttlMs)]);
      if (result !== 'OK') throw new Error('could not save verification');
    },
    async claim(id, codeHash, owner) {
      return JSON.parse(await command(['EVAL', CLAIM_SCRIPT, '1', `solaria:verification:${id}`, codeHash, owner]));
    },
    finish: (id, owner, status) => command(['EVAL', FINISH_SCRIPT, '1', `solaria:verification:${id}`, owner, status]),
  };
}

// Explicit local-development/test adapter only. Never selected in production.
export function createMemoryStore({ now = Date.now, maxEntries = 5000 } = {}) {
  const entries = new Map();
  function get(key) {
    const entry = entries.get(key);
    if (entry && entry.expiresAt > now()) return entry;
    entries.delete(key);
  }
  function set(key, value, ttlMs) {
    for (const [key, entry] of entries) if (entry.expiresAt <= now()) entries.delete(key);
    if (entries.size >= maxEntries) throw new Error('contact store full');
    entries.set(key, { value, expiresAt: now() + ttlMs });
  }
  return {
    async rateLimit(key, limit, windowMs) {
      const k = `rate:${key}`;
      let entry = get(k);
      if (!entry) { set(k, 0, windowMs); entry = get(k); }
      entry.value++;
      return entry.value > limit ? entry.expiresAt - now() : 0;
    },
    async put(id, record, ttlMs) {
      if (get(id)) throw new Error('duplicate verification');
      set(id, structuredClone(record), ttlMs);
    },
    async claim(id, hash, owner) {
      const entry = get(id);
      const r = entry?.value;
      if (!r) return { status: 'missing' };
      if (r.attempts >= 5) return { status: 'locked' };
      if (r.codeHash !== hash) { r.attempts++; return { status: 'invalid' }; }
      if (r.status === 'sent') return { status: 'sent' };
      if (r.status === 'sending' && r.leaseUntil > now()) return { status: 'busy' };
      if (r.verified && entry.expiresAt - now() <= 30000) return { status: 'expired' };
      Object.assign(r, { status: 'sending', owner, leaseUntil: now() + 30000 });
      if (!r.verified) {
        r.verified = true;
        entry.expiresAt = Math.max(entry.expiresAt, now() + 300000);
      }
      return { status: 'claimed', encrypted: r.encrypted };
    },
    async finish(id, owner, status) {
      const r = get(id)?.value;
      if (!r || r.owner !== owner || r.status !== 'sending') return 0;
      r.status = status;
      delete r.owner;
      delete r.leaseUntil;
      if (status === 'sent') delete r.encrypted;
      return 1;
    },
  };
}
