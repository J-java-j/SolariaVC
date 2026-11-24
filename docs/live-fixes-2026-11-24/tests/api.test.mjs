// The portal's request handler (staff-service/api.js) end to end over local HTTP,
// with a fake database and a fake Google account service. Nothing here talks to Google.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { request } from 'node:http';

process.env.TEAM_SESSION_DATABASE = 'team-login-test';
process.env.TEAM_TERMINAL_ORIGIN = 'https://terminal.example.test';
delete process.env.FIRESTORE_EMULATOR_HOST;
const { staffServer } = await import('../staff-service/api.js');

const ORIGIN = 'https://portal.example.test';
const hash = value => createHash('sha256').update(value).digest('hex');
let COOKIE;   // each test signs in afresh, as a new browser session would

const rows = new Map();
const table = name => { if (!rows.has(name)) rows.set(name, new Map()); return rows.get(name); };
const db = {
  collection(name) {
    const t = table(name);
    return {
      doc(id) {
        return {
          async get() { const row = t.get(id); return { data: () => row }; },
          async delete() { t.delete(id); },
          async create(value) { if (t.has(id)) throw new Error('exists'); t.set(id, value); },
        };
      },
    };
  },
};
const accounts = new Map();
const reads = new Map();
const auth = {
  async getUser(uid) {
    reads.set(uid, (reads.get(uid) || 0) + 1);
    const account = accounts.get(uid);
    if (!account) throw Object.assign(new Error('no user'), { code: 'auth/user-not-found' });
    return structuredClone(account);
  },
};
const provider = {
  auth, app: { __db: db }, portalOrigin: ORIGIN, projectId: 'test', accepts: () => true,
  async updateAccount(user, fields) { return { ...user, ...fields }; },
};

function account(uid, role) {
  accounts.set(uid, {
    uid, email: uid + '@example.test', displayName: uid, disabled: false, providerData: [],
    customClaims: { role }, tokensValidAfterTime: new Date(Date.now() - 3600_000).toUTCString(),
  });
}

let server, port;
before(async () => {
  server = staffServer(provider);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  port = server.address().port;
});
after(() => server.close());

beforeEach(() => {
  for (const t of rows.values()) t.clear();   // empty the tables the server already holds
  accounts.clear(); reads.clear();
  account('u1', 'owner');
  account('u2', 'staff');
  COOKIE = randomBytes(32).toString('base64url');
  table('teamBrowserSessions').set(hash(COOKIE), {
    uid: 'u1', authTime: Math.floor(Date.now() / 1000) - 60, expires: { toMillis: () => Date.now() + 3600_000 },
  });
});

function call(method, path, body) {
  const headers = { cookie: '__Host-solaria_team=' + COOKIE };
  if (method !== 'GET') Object.assign(headers, { 'x-team-request': '1', origin: ORIGIN });
  const data = body === undefined ? undefined : JSON.stringify(body);
  if (data) Object.assign(headers, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) });
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, method, path, headers }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString() || '{}') }));
    });
    req.on('error', reject);
    req.end(data);
  });
}

test('two page loads in a row ask Google once', async () => {
  assert.equal((await call('GET', '/me')).status, 200);
  const second = await call('GET', '/me');
  assert.equal(second.status, 200);
  assert.equal(second.body.role, 'owner');
  assert.equal(reads.get('u1'), 1);
});

test('a change still checks the person fresh, even right after a page load', async () => {
  await call('GET', '/me');
  const res = await call('PATCH', '/accounts/u2', { displayName: 'New Name' });
  assert.equal(res.status, 200);
  assert.equal(res.body.displayName, 'New Name');
  assert.equal(reads.get('u1'), 3);   // the page load, then both checks inside the change
});

test('a demotion stops changes at once', async () => {
  account('u1', 'board-admin');
  assert.equal((await call('GET', '/me')).body.role, 'board-admin');
  accounts.get('u1').customClaims.role = 'staff';
  assert.equal((await call('PATCH', '/accounts/u2', { displayName: 'X' })).status, 403);
  assert.equal((await call('GET', '/me')).body.role, 'staff');
});

// The website checks every Sign page and Sign API call (writes included) with a GET to
// /guard/<id>, so guards must never use the memory.
test('the signing area is checked fresh every time, even right after a page load', async () => {
  await call('GET', '/me');
  assert.equal((await call('GET', '/guard/documents')).status, 204);
  assert.equal((await call('GET', '/guard/documents')).status, 204);
  assert.equal(reads.get('u1'), 3);
});

test('a demotion reaches the owner-only signing area at once', async () => {
  assert.equal((await call('GET', '/guard/sign-team')).status, 204);
  await call('GET', '/me');
  accounts.get('u1').customClaims.role = 'staff';
  assert.equal((await call('GET', '/guard/sign-team')).status, 403);
});

test('signing out forgets at once', async () => {
  assert.equal((await call('GET', '/me')).status, 200);
  assert.equal((await call('DELETE', '/session')).status, 200);
  assert.equal((await call('GET', '/me')).status, 401);
});
