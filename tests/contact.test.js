import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createContactHandler, clientIdentity, loadContactConfig, normalizeEmail, emailRateIdentity, withStoreDeadline } from '../server/contact.js';
import { createMemoryStore, createRedisStore } from '../server/contact-store.js';
import { createEmailSender } from '../server/contact-email.js';

const env = {
  CONTACT_STORE: 'redis',
  NODE_ENV: 'production', RESEND_API_KEY: 'test-only', CONTACT_FROM_EMAIL: 'Solaria <contact@solariavc.com>',
  TURNSTILE_SITE_KEY: 'test-site', TURNSTILE_SECRET_KEY: 'test-secret',
  UPSTASH_REDIS_REST_URL: 'https://test.upstash.io', UPSTASH_REDIS_REST_TOKEN: 'test-token',
  CONTACT_VERIFICATION_SECRET: 'test-only-verification-key-32-bytes-long',
};
const payload = { name: 'Test Visitor', email: 'visitor@example.com', message: 'A genuine inquiry.', kind: 'founder', website: '', turnstileToken: 'test-human' };

async function fixture(t, options = {}) {
  let time = options.time ?? Date.UTC(2026, 9, 1, 12);
  const now = () => time;
  const sent = [];
  const logs = [];
  const botCalls = [];
  const store = options.store || createMemoryStore({ now });
  const handler = createContactHandler({
    env: { ...env, ...options.env }, now, store,
    fetchImpl: async (...args) => { botCalls.push(args); return Response.json(options.botResult || { success: true, hostname: 'solariavc.com', action: 'contact' }); },
    sendEmail: options.sendEmail || (async (email, key) => sent.push({ email, key })),
    logger: { error: value => logs.push(value) },
    ...options.dependencies,
  });
  const server = http.createServer((req, res) => handler(req, res, new URL(req.url, 'http://localhost').pathname));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(path, body, headers = {}) {
    const response = await fetch(base + path, { method: 'POST', headers: { Origin: 'https://solariavc.com', 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
    return { status: response.status, headers: response.headers, body: await response.json() };
  }
  async function start(overrides = {}) {
    const result = await request('/api/contact', { ...payload, ...overrides });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    const code = sent.at(-1)?.email.text.match(/code is (\d{6})/)?.[1];
    return { verificationId: result.body.verificationId, code };
  }
  return { request, start, sent, logs, botCalls, store, base, advance: ms => { time += ms; } };
}

test('production fails closed without any one required dependency or with test sender', async t => {
  for (const field of ['RESEND_API_KEY', 'CONTACT_FROM_EMAIL', 'TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'CONTACT_VERIFICATION_SECRET']) {
    assert.equal(loadContactConfig({ ...env, [field]: '' }).available, false, field);
  }
  assert.equal(loadContactConfig({ ...env, CONTACT_FROM_EMAIL: 'onboarding@resend.dev' }).available, false);
  assert.equal(loadContactConfig({ ...env, CONTACT_LOCAL_DEV: 'true' }).local, false);
  assert.equal(loadContactConfig({ ...env, NODE_ENV: 'development', K_SERVICE: 'cloud-service', CONTACT_LOCAL_DEV: 'true' }).local, false);
  const f = await fixture(t, { env: { TURNSTILE_SECRET_KEY: '' } });
  assert.equal((await f.request('/api/contact', payload)).status, 503);
  assert.equal((await (await fetch(f.base + '/api/contact/config')).json()).available, false);
  assert.equal(f.sent.length, 0);
  assert.equal(loadContactConfig(env).emailDailyLimit, 80);
  for (const value of ['0', '1', '-1', '2.5', 'Infinity', 'invalid', '100001']) assert.equal(loadContactConfig({ ...env, CONTACT_EMAIL_DAILY_LIMIT: value }).available, false);
});

test('Firestore is the default shared store without requiring Redis credentials', () => {
  const config = loadContactConfig({ ...env, CONTACT_STORE: '', UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '' });
  assert.equal(config.storeType, 'firestore');
  assert.equal(config.available, true);
  assert.equal(config.firestoreDatabase, '(default)');
  assert.equal(config.firestoreCollection, 'solaria_contact');
  assert.equal(loadContactConfig({ ...env, CONTACT_STORE: 'unknown' }).available, false);
  assert.equal(loadContactConfig({ ...env, CONTACT_STORE: 'firestore', CONTACT_FIRESTORE_COLLECTION: '../other' }).available, false);
  assert.equal(loadContactConfig({ ...env, CONTACT_STORE: 'firestore', CONTACT_FIRESTORE_PROJECT_ID: 'not/a/project' }).available, false);
  assert.equal(loadContactConfig({ ...env, CONTACT_STORE: 'firestore', CONTACT_FIRESTORE_DATABASE_ID: '../database' }).available, false);
  assert.equal(loadContactConfig({ ...env, CONTACT_STORE: 'firestore', FIRESTORE_EMULATOR_HOST: 'localhost:8085' }).available, false);
  assert.equal(loadContactConfig({ ...env, NODE_ENV: 'development', K_SERVICE: 'solariavc', CONTACT_STORE: 'firestore', FIRESTORE_EMULATOR_HOST: 'localhost:8085' }).available, false);
});

test('Firestore service identity configuration omits static credentials', () => {
  let settings;
  createContactHandler({
    env: { ...env, CONTACT_STORE: 'firestore', CONTACT_FIRESTORE_PROJECT_ID: 'gen-lang-client-0188652481' },
    firestoreFactory: options => {
      settings = options;
      return { collection: () => ({ doc: () => ({}) }), runTransaction: async () => {} };
    },
  });
  assert.deepEqual(settings, { projectId: 'gen-lang-client-0188652481', databaseId: '(default)' });
  assert.ok(!Object.hasOwn(settings, 'credentials'));
  assert.ok(!Object.hasOwn(settings, 'keyFilename'));
});

test('store deadline fails closed without continuing to downstream work', async () => {
  let finishOperation;
  let dispatched = false;
  const store = withStoreDeadline({ rateLimit: () => new Promise(resolve => { finishOperation = resolve; }) }, 5);
  await assert.rejects((async () => { await store.rateLimit('key', 1, 1000); dispatched = true; })(), /deadline/);
  finishOperation(0);
  await Promise.resolve();
  assert.equal(dispatched, false);
});

test('invalid human proofs, fabricated IDs and honeypots cannot cause shared-store reads', async t => {
  let operations = 0;
  const store = Object.fromEntries(['rateLimit', 'reserveEmails', 'put', 'claim', 'finish', 'cleanupExpired'].map(name => [name, async () => { operations++; throw new Error(`unexpected ${name}`); }]));
  const f = await fixture(t, { store, botResult: { success: false } });
  assert.equal((await f.request('/api/contact', { ...payload, name: {} })).status, 400);
  assert.equal((await f.request('/api/contact', { ...payload, turnstileToken: '' })).status, 400);
  assert.equal((await f.request('/api/contact', payload)).status, 400);
  const honeypot = await f.request('/api/contact', { ...payload, website: 'bot.example' });
  assert.equal(honeypot.status, 200);
  assert.equal((await f.request('/api/contact/verify', { verificationId: honeypot.body.verificationId, code: '123456' })).status, 400);
  assert.equal((await f.request('/api/contact/verify', { verificationId: `${'a'.repeat(48)}.${Date.UTC(2026, 9, 1, 12, 20)}.${'b'.repeat(64)}`, code: '123456' })).status, 400);
  assert.equal(operations, 0);
  assert.equal(f.sent.length, 0);
});

test('a modified issued verification ID fails before accessing the shared store', async t => {
  const store = createMemoryStore();
  const f = await fixture(t, { store });
  const challenge = await f.start();
  let operations = 0;
  store.rateLimit = async () => { operations++; throw new Error('unexpected read'); };
  const value = challenge.verificationId;
  const tampered = value.slice(0, -1) + (value.endsWith('a') ? 'b' : 'a');
  assert.equal((await f.request('/api/contact/verify', { ...challenge, verificationId: tampered })).status, 400);
  assert.equal(operations, 0);
});

test('expired signed verification IDs fail before accessing the shared store', async t => {
  const store = createMemoryStore();
  const f = await fixture(t, { store });
  const challenge = await f.start();
  let operations = 0;
  store.rateLimit = async () => { operations++; throw new Error('unexpected read'); };
  f.advance(20 * 60_000);
  assert.equal((await f.request('/api/contact/verify', challenge)).status, 400);
  assert.equal(operations, 0);
});

test('Firestore cleanup is best-effort and runs only after a successful human check', async t => {
  const store = createMemoryStore();
  let cleaned = 0;
  store.cleanupExpired = async () => { cleaned++; throw new Error('cleanup delayed'); };
  const f = await fixture(t, { store });
  await f.start();
  assert.equal(cleaned, 1);
  assert.equal(f.sent.length, 1);
  assert.ok(f.logs.some(message => message.includes('cleanup deferred')));
});

test('daily budget reserves code and team delivery together, including at exhaustion', async t => {
  const f = await fixture(t, { env: { CONTACT_EMAIL_DAILY_LIMIT: '2' } });
  const challenge = await f.start();
  const denied = await f.request('/api/contact', { ...payload, email: 'second@example.com' });
  assert.equal(denied.status, 429);
  assert.ok(Number(denied.headers.get('retry-after')) > 0);
  assert.equal(f.sent.length, 1);
  // The original team delivery already owns its budget slot.
  assert.equal((await f.request('/api/contact/verify', challenge)).status, 200);
  assert.equal(f.sent.length, 2);
});

test('concurrent instances cannot oversubscribe the shared email budget', async t => {
  const store = createMemoryStore();
  const options = { store, env: { CONTACT_EMAIL_DAILY_LIMIT: '2' } };
  const a = await fixture(t, options);
  const b = await fixture(t, options);
  const results = await Promise.all([a.request('/api/contact', payload), b.request('/api/contact', { ...payload, email: 'another@example.com' })]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 429]);
  assert.equal(a.sent.length + b.sent.length, 1);
});

test('provider-idempotent retries reuse both email reservations without taking new slots', async t => {
  const attempts = [];
  const failures = new Set();
  const f = await fixture(t, { env: { CONTACT_EMAIL_DAILY_LIMIT: '2' }, dependencies: { sendEmail: async (email, key) => {
    attempts.push({ email, key });
    if (!failures.has(key)) { failures.add(key); throw new Error('ambiguous provider timeout'); }
  } } });
  const start = await f.request('/api/contact', payload);
  assert.equal(start.status, 200);
  const challenge = { verificationId: start.body.verificationId, code: attempts[0].email.text.match(/code is (\d{6})/)[1] };
  assert.equal((await f.request('/api/contact/verify', challenge)).status, 503);
  assert.equal((await f.request('/api/contact/verify', challenge)).status, 200);
  assert.equal(attempts.length, 4);
  assert.equal(new Set(attempts.map(a => a.key)).size, 2);
  assert.deepEqual(attempts[0], attempts[1]);
  assert.deepEqual(attempts[2], attempts[3]);
  assert.equal((await f.request('/api/contact', { ...payload, email: 'second@example.com' })).status, 429);
  assert.equal(attempts.length, 4);
});

test('a delivery crossing midnight is also budgeted on its actual UTC sending day', async t => {
  const f = await fixture(t, { env: { CONTACT_EMAIL_DAILY_LIMIT: '2' }, time: Date.UTC(2026, 9, 1, 23, 58, 50) });
  const challenge = await f.start();
  f.advance(70_001);
  assert.equal((await f.request('/api/contact/verify', challenge)).status, 200);
  // Yesterday's delivery used one slot today, so a new two-email pair cannot fit.
  assert.equal((await f.request('/api/contact', { ...payload, email: 'second@example.com' })).status, 429);
  assert.equal(f.sent.length, 2);
});

test('UTC rollover guard pauses sends and resumes after reset without using email cooldown', async t => {
  const f = await fixture(t, { time: Date.UTC(2026, 9, 1, 23, 59, 30) });
  const result = await f.request('/api/contact', payload);
  assert.equal(result.status, 429);
  assert.equal(result.headers.get('retry-after'), '30');
  assert.equal(f.sent.length, 0);
  f.advance(30_001);
  assert.equal((await f.request('/api/contact', payload)).status, 200);
  assert.equal(f.sent.length, 1);
});

test('Redis delay cannot start a provider request inside the UTC rollover guard', async t => {
  const store = createMemoryStore();
  const reserve = store.reserveEmails;
  let reservations = 0;
  let f;
  store.reserveEmails = async (...args) => {
    const result = await reserve(...args);
    if (++reservations === 2) f.advance(2_000);
    return result;
  };
  f = await fixture(t, { store, time: Date.UTC(2026, 9, 1, 23, 58, 59) });
  assert.equal((await f.request('/api/contact', payload)).status, 429);
  assert.equal(f.sent.length, 0);
});

test('a UTC day change while reserving cannot send solely on the previous day budget', async t => {
  const store = createMemoryStore();
  const dayTwo = Date.UTC(2026, 9, 2, 0, 0, 50);
  await store.reserveEmails(['other-mail-a', 'other-mail-b'], 2, dayTwo);
  const reserve = store.reserveEmails;
  let reservations = 0;
  let f;
  store.reserveEmails = async (...args) => {
    const result = await reserve(...args);
    if (++reservations === 2) f.advance(120_000);
    return result;
  };
  f = await fixture(t, { store, env: { CONTACT_EMAIL_DAILY_LIMIT: '2' }, time: Date.UTC(2026, 9, 1, 23, 58, 50) });
  assert.equal((await f.request('/api/contact', payload)).status, 429);
  assert.equal(f.sent.length, 0);
});

test('email budget store failure cannot send a verification email', async t => {
  const store = createMemoryStore();
  store.reserveEmails = async () => { throw new Error('budget unavailable'); };
  const f = await fixture(t, { store });
  assert.equal((await f.request('/api/contact', payload)).status, 503);
  assert.equal(f.sent.length, 0);
});

test('atomic budget denial makes no partial reservation and resets by UTC day', async () => {
  const day = Date.UTC(2026, 9, 1, 12);
  const store = createMemoryStore({ now: () => day });
  assert.equal(await store.reserveEmails(['first-code', 'first-team'], 3, day), 0);
  assert.ok(await store.reserveEmails(['second-code', 'second-team'], 3, day) > 0);
  assert.equal(await store.reserveEmails(['third-email'], 3, day), 0);
  assert.equal(await store.reserveEmails(['first-code'], 3, day), 0);
  assert.ok(await store.reserveEmails(['second-code'], 3, day) > 0, 'denied pairs must not mark either email as reserved');
  assert.equal(await store.reserveEmails(['second-code', 'second-team'], 3, day + 86400000), 0);
});

test('verification gates team delivery and replays do not send duplicates', async t => {
  const f = await fixture(t);
  const challenge = await f.start();
  assert.equal(f.sent.length, 1);
  assert.deepEqual(f.sent[0].email.to, [payload.email]);
  assert.ok(!f.sent[0].email.text.includes(payload.message));
  assert.ok(!f.sent[0].email.text.includes(payload.name));
  assert.ok(f.botCalls.length === 1);
  assert.match(challenge.verificationId, /^[a-f0-9]{48}\.[0-9]{13}\.[a-f0-9]{64}$/);
  assert.equal((await f.request('/api/contact/verify', { ...challenge, email: 'attacker@evil.example', message: 'overwritten', kind: 'card', cardId: 'karl-li' })).status, 200);
  assert.equal(f.sent.length, 2);
  assert.deepEqual(f.sent[1].email.to, ['contact@solariavc.com']);
  assert.equal(f.sent[1].email.reply_to, payload.email);
  assert.ok(f.sent[1].email.text.includes(payload.message));
  assert.equal((await f.request('/api/contact/verify', challenge)).body.sent, true);
  assert.equal(f.sent.length, 2);
});

test('both digital cards preserve allowlisted recipients and require ownership', async t => {
  for (const [cardId, recipient] of [['johnson-jiang', 'JohnsonJiang@solariavc.com'], ['karl-li', 'kal126@ucsd.edu']]) {
    const f = await fixture(t);
    const challenge = await f.start({ kind: 'card', cardId });
    assert.equal(f.sent.length, 1);
    assert.equal((await f.request('/api/contact/verify', challenge)).status, 200);
    assert.deepEqual(f.sent[1].email.to, [recipient]);
  }
});

test('code cannot be used for another request and only five wrong attempts are allowed', async t => {
  const f = await fixture(t);
  const challenge = await f.start();
  const wrongCode = challenge.code === '000000' ? '111111' : '000000';
  const responses = await Promise.all(Array.from({ length: 5 }, () => f.request('/api/contact/verify', { ...challenge, code: wrongCode })));
  assert.ok(responses.every(r => r.status === 400));
  assert.equal((await f.request('/api/contact/verify', challenge)).status, 400);
  assert.equal((await f.request('/api/contact/verify', { ...challenge, verificationId: 'a'.repeat(48) })).status, 400);
  assert.equal(f.sent.length, 1);
});

test('verification expires in ten minutes', async t => {
  const f = await fixture(t);
  const challenge = await f.start();
  f.advance(600_001);
  assert.equal((await f.request('/api/contact/verify', challenge)).status, 400);
  assert.equal(f.sent.length, 1);
});

test('a correct code entered at the deadline retains time to finish sending', async () => {
  let time = 0;
  const store = createMemoryStore({ now: () => time });
  await store.put('id', { codeHash: 'code', encrypted: 'ciphertext', attempts: 0, status: 'pending' }, 600000);
  time = 599999;
  assert.equal((await store.claim('id', 'code', 'sender')).status, 'claimed');
  time = 600001;
  assert.equal(await store.finish('id', 'sender', 'sent'), 1);
  assert.equal((await store.claim('id', 'code', 'retry')).status, 'sent');
  time = 900000;
  assert.equal((await store.claim('id', 'code', 'retry')).status, 'missing');
});

test('verification email ambiguity retries the same code and provider key once', async t => {
  const attempts = [];
  const f = await fixture(t, { dependencies: { sendEmail: async (email, key) => {
    attempts.push({ email, key });
    if (attempts.length === 1) throw new Error('ambiguous timeout');
  } } });
  assert.equal((await f.request('/api/contact', payload)).status, 200);
  assert.equal(attempts.length, 2);
  assert.deepEqual(attempts[0], attempts[1]);
});

test('delivery retries cannot renew the fixed verified-request retention', async () => {
  let time = 0;
  const store = createMemoryStore({ now: () => time });
  await store.put('id', { codeHash: 'code', encrypted: 'ciphertext', attempts: 0, status: 'pending' }, 600000);
  time = 590000;
  assert.equal((await store.claim('id', 'code', 'first')).status, 'claimed');
  await store.finish('id', 'first', 'pending');
  time = 850000;
  assert.equal((await store.claim('id', 'code', 'retry')).status, 'claimed');
  await store.finish('id', 'retry', 'pending');
  time = 880000;
  assert.equal((await store.claim('id', 'code', 'too-late')).status, 'expired');
  time = 890001;
  assert.equal((await store.claim('id', 'code', 'last')).status, 'missing');
});

test('successful provider send followed by store failure retries without changing provider request', async t => {
  const store = createMemoryStore();
  const finish = store.finish;
  let fail = true;
  store.finish = async (...args) => {
    if (args[2] === 'sent' && fail) { fail = false; throw new Error('store temporarily unavailable'); }
    return finish(...args);
  };
  const f = await fixture(t, { store });
  const challenge = await f.start();
  assert.equal((await f.request('/api/contact/verify', challenge)).status, 503);
  assert.equal((await f.request('/api/contact/verify', challenge)).status, 200);
  assert.deepEqual(f.sent[1], f.sent[2]);
});

test('forged, missing, failed, wrong-host and wrong-action bot proofs fail closed', async t => {
  for (const botResult of [{ success: false }, { success: true, hostname: 'evil.example', action: 'contact' }, { success: true, hostname: 'solariavc.com', action: 'other' }]) {
    const f = await fixture(t, { botResult });
    assert.equal((await f.request('/api/contact', payload)).status, 400);
    assert.equal(f.sent.length, 0);
  }
  const f = await fixture(t);
  for (const turnstileToken of ['', null, [], 'a'.repeat(2049)]) assert.equal((await f.request('/api/contact', { ...payload, turnstileToken })).status, 400);
  assert.equal(f.sent.length, 0);
});

test('honeypot silently returns a fake challenge without mailing', async t => {
  const f = await fixture(t);
  const result = await f.request('/api/contact', { ...payload, website: 'bot.example' });
  assert.equal(result.status, 200);
  assert.equal(result.body.verificationRequired, true);
  assert.equal(f.sent.length, 0);
  assert.equal(f.botCalls.length, 0);
});

test('strict JSON, body size, origin, encoding, and field validation', async t => {
  const f = await fixture(t);
  for (const body of ['null', '[]', '{oops', { ...payload, email: ['visitor@example.com'] }, { ...payload, name: 'Test\r\nBcc: bad@example.com' }, { ...payload, phone: 123 }, { ...payload, message: 'x'.repeat(8001) }, { ...payload, name: 'x'.repeat(121) }, { ...payload, kind: 'constructor' }, { ...payload, kind: 'card', cardId: '__proto__' }]) assert.equal((await f.request('/api/contact', body)).status, 400);
  assert.equal((await f.request('/api/contact', 'x'.repeat(20_001))).status, 413);
  assert.equal((await f.request('/api/contact', payload, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await f.request('/api/contact', payload, { Origin: '' })).status, 403);
  assert.equal((await f.request('/api/contact', payload, { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  assert.equal((await f.request('/api/contact', payload, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await f.request('/api/contact', payload, { 'Content-Encoding': 'gzip' })).status, 415);
  assert.equal(f.sent.length, 0);
});

test('email normalization validates syntax and groups common mailbox aliases', () => {
  assert.equal(normalizeEmail(' Person+pitch@EXAMPLE.COM '), 'Person+pitch@example.com');
  for (const value of ['a..b@example.com', '.a@example.com', 'x@-example.com', 'x@example', 'x@example.com\r\nBcc:evil@example.com', 'x@evil,example.com', {}, 'x@localhost', 'x@@example.com']) assert.equal(normalizeEmail(value), null);
  assert.equal(emailRateIdentity('a.b+one@googlemail.com'), 'ab@gmail.com');
});

test('spoofed forwarded headers do not change default client identity; IPv6 variants share /64', () => {
  const req = { socket: { remoteAddress: '::ffff:192.0.2.1' }, headers: { 'x-forwarded-for': '203.0.113.2, 198.51.100.1' } };
  assert.equal(clientIdentity(req), '192.0.2.1');
  assert.equal(clientIdentity(req, 1), '198.51.100.1');
  assert.equal(clientIdentity(req, 2), '203.0.113.2');
  assert.throws(() => clientIdentity(req, 3));
  assert.equal(clientIdentity({ socket: { remoteAddress: '2001:db8:0:1::abcd' }, headers: {} }), clientIdentity({ socket: { remoteAddress: '2001:0db8:0000:0001:abcd::' }, headers: {} }));
});

test('shared email cooldown blocks parallel and alias requests across instances', async t => {
  const store = createMemoryStore();
  const a = await fixture(t, { store });
  const b = await fixture(t, { store });
  const results = await Promise.all([a.request('/api/contact', { ...payload, email: 'a.b+one@gmail.com' }), b.request('/api/contact', { ...payload, email: 'ab+two@googlemail.com' })]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 429]);
  assert.ok(Number(results.find(r => r.status === 429).headers.get('retry-after')) > 0);
  assert.equal(a.sent.length + b.sent.length, 1);
});

test('a second instance can verify the stored encrypted request', async t => {
  const store = createMemoryStore();
  const a = await fixture(t, { store });
  const b = await fixture(t, { store });
  const challenge = await a.start();
  assert.equal((await b.request('/api/contact/verify', challenge)).status, 200);
  assert.equal(b.sent.length, 1);
  assert.deepEqual(b.sent[0].email.to, ['contact@solariavc.com']);
});

test('per-IP quotas resist forged XFF values and reset after the full window', async t => {
  const f = await fixture(t);
  for (let i = 0; i < 5; i++) assert.equal((await f.request('/api/contact', { ...payload, email: `visitor${i}@example.com` }, { 'X-Forwarded-For': `192.0.2.${i}` })).status, 200);
  assert.equal((await f.request('/api/contact', { ...payload, email: 'visitor5@example.com' }, { 'X-Forwarded-For': '203.0.113.99' })).status, 429);
  f.advance(600_001);
  assert.equal((await f.request('/api/contact', { ...payload, email: 'visitor5@example.com' })).status, 200);
});

test('provider timeouts can retry the exact payload and stable idempotency key', async t => {
  const attempts = [];
  let fail = true;
  const f = await fixture(t, { dependencies: { sendEmail: async (email, key) => {
    attempts.push({ email, key });
    if (key.startsWith('solaria-contact/') && fail) { fail = false; throw new Error('timeout'); }
  } } });
  const initial = await f.request('/api/contact', payload);
  const challenge = { verificationId: initial.body.verificationId, code: attempts[0].email.text.match(/code is (\d{6})/)[1] };
  assert.equal((await f.request('/api/contact/verify', challenge)).status, 503);
  f.advance(1000);
  assert.equal((await f.request('/api/contact/verify', challenge)).status, 200);
  assert.deepEqual(attempts[1], attempts[2]);
  assert.ok(!f.logs.join('').includes(payload.email));
});

test('concurrent correct-code claims permit only one active delivery', async t => {
  let release;
  let started;
  const startedPromise = new Promise(resolve => { started = resolve; });
  const sent = [];
  const f = await fixture(t, { dependencies: { sendEmail: async (email, key) => {
    sent.push({ email, key });
    if (key.startsWith('solaria-contact/')) { started(); await new Promise(resolve => { release = resolve; }); }
  } } });
  const initial = await f.request('/api/contact', payload);
  const challenge = { verificationId: initial.body.verificationId, code: sent[0].email.text.match(/code is (\d{6})/)[1] };
  const first = f.request('/api/contact/verify', challenge);
  await startedPromise;
  assert.equal((await f.request('/api/contact/verify', challenge)).status, 429);
  release();
  assert.equal((await first).status, 200);
  assert.equal(sent.length, 2);
});

test('processing leases recover after process death and ignore stale owners', async () => {
  let time = 0;
  const store = createMemoryStore({ now: () => time });
  await store.put('id', { attempts: 0, codeHash: 'hash', encrypted: 'ciphertext', status: 'pending' }, 600000);
  assert.equal((await store.claim('id', 'hash', 'dead-process')).status, 'claimed');
  assert.equal((await store.claim('id', 'hash', 'new-process')).status, 'busy');
  time = 30001;
  assert.equal((await store.claim('id', 'hash', 'new-process')).status, 'claimed');
  assert.equal(await store.finish('id', 'dead-process', 'sent'), 0);
  assert.equal(await store.finish('id', 'new-process', 'sent'), 1);
  assert.equal((await store.claim('id', 'hash', 'third-process')).status, 'sent');
});

test('dependency outages do not bypass verification or leak exceptions', async t => {
  const f = await fixture(t, { dependencies: { fetchImpl: async () => { throw new Error('secret token should never leak'); } } });
  const result = await f.request('/api/contact', payload);
  assert.equal(result.status, 503);
  assert.equal(f.sent.length, 0);
  assert.ok(!JSON.stringify(result).includes('secret token'));
  const g = await fixture(t, { store: { rateLimit: async () => { throw new Error('redis offline'); } } });
  assert.equal((await g.request('/api/contact', payload)).status, 503);
  assert.equal(g.sent.length, 0);
});

test('Redis REST transport uses atomic commands, TLS, timeouts, and fails closed', async () => {
  assert.throws(() => createRedisStore({ url: 'http://example.com', token: 'test' }));
  const commands = [];
  const store = createRedisStore({ url: 'https://test.upstash.io', token: 'test', fetchImpl: async (_url, options) => { commands.push(JSON.parse(options.body)); return Response.json({ result: 0 }); } });
  assert.equal(await store.rateLimit('test', 1, 60_000), 0);
  assert.equal(commands[0][0], 'EVAL');
  const bad = createRedisStore({ url: 'https://test.upstash.io', token: 'test', fetchImpl: async () => Response.json({ error: 'NOAUTH' }) });
  await assert.rejects(bad.rateLimit('test', 1, 60_000));
});

test('Resend adapter supplies bounded timeout and idempotency, handles rejected/malformed responses', async () => {
  const calls = [];
  const send = createEmailSender({ apiKey: 'test', fetchImpl: async (_url, opts) => { calls.push(opts); return Response.json({ id: 'mock-id' }); } });
  await send({ to: ['visitor@example.com'], text: 'test' }, 'key');
  assert.equal(calls[0].headers['Idempotency-Key'], 'key');
  assert.equal(calls[0].redirect, 'error');
  assert.ok(calls[0].signal instanceof AbortSignal);
  for (const response of [Response.json({}, { status: 502 }), Response.json({})]) await assert.rejects(createEmailSender({ apiKey: 'test', fetchImpl: async () => response })({}, 'key'));
});
