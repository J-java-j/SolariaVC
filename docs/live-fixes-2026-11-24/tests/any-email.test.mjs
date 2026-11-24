// Who may be given a portal account (staff-service/provider.js, approvedEmails). TEAM_INVITE_EMAILS used to be
// an exact list, so the Owner could add nobody who wasn't already in a deploy setting. A "*" entry now approves
// any well-formed address; without it the list is as strict as before. The second half creates accounts
// through the real request handler over local HTTP, with a fake Google account service.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { request } from 'node:http';

process.env.TEAM_SESSION_DATABASE = 'team-login-test';
process.env.TEAM_TERMINAL_ORIGIN = 'https://terminal.example.test';
delete process.env.FIRESTORE_EMULATOR_HOST;
const { approvedEmails } = await import('../staff-service/provider.js');
const { staffServer } = await import('../staff-service/api.js');

test('a named list approves exactly those addresses', () => {
  const accepts = approvedEmails('Owner@Solaria.example, it@school.example');
  assert.equal(accepts('owner@solaria.example'), true);
  assert.equal(accepts('it@school.example'), true);
  assert.equal(accepts('someone@solaria.example'), false);
  assert.equal(accepts('anyone@elsewhere.example'), false);
});

test('a * entry approves any well-formed address, and nothing that is not one', () => {
  const accepts = approvedEmails('*, owner@solaria.example');
  for (const email of ['owner@solaria.example', 'new.person@gmail.example', 'a+b@sub.school.example']) {
    assert.equal(accepts(email), true, email);
  }
  for (const not of ['', '*', 'not an email', 'two@@signs', 'spa ce@x.example', 'no-at-sign', '@nobody', 'nobody@',
    'x'.repeat(250) + '@x.example', undefined, null, 42]) {
    assert.equal(accepts(not), false, String(not));
  }
});

test('without a * entry a list that merely looks open stays closed', () => {
  for (const list of ['*@solaria.example', 'owner@solaria.example,**', ' ']) {
    assert.equal(approvedEmails(list)('anyone@elsewhere.example'), false, list);
  }
});

// ---- through the request handler -------------------------------------------------------------------
const ORIGIN = 'https://portal.example.test';
const hash = value => createHash('sha256').update(value).digest('hex');
const rows = new Map();
const table = name => { if (!rows.has(name)) rows.set(name, new Map()); return rows.get(name); };
const db = {
  collection(name) {
    const t = table(name);
    return { doc(id) { return {
      async get() { const row = t.get(id); return { data: () => row }; },
      async delete() { t.delete(id); },
      async create(value) { if (t.has(id)) throw new Error('exists'); t.set(id, value); },
    }; } };
  },
};
const accounts = new Map();
const invited = [];
const auth = {
  async getUser(uid) {
    const account = accounts.get(uid);
    if (!account) throw Object.assign(new Error('no user'), { code: 'auth/user-not-found' });
    return structuredClone(account);
  },
  async createUser({ email, displayName }) {
    if ([...accounts.values()].some(a => a.email === email)) throw Object.assign(new Error('taken'), { code: 'auth/email-already-exists' });
    const made = { uid: 'made-' + accounts.size, email, displayName, disabled: false, providerData: [], customClaims: {},
      tokensValidAfterTime: new Date(Date.now() - 3600_000).toUTCString() };
    accounts.set(made.uid, made);
    return structuredClone(made);
  },
  async setCustomUserClaims(uid, claims) { accounts.get(uid).customClaims = claims; },
  async generatePasswordResetLink(email) { invited.push(email); return 'https://example.test/action?oobCode=' + 'c'.repeat(32); },
};
const provider = { auth, app: { __db: db }, portalOrigin: ORIGIN, projectId: 'test', accepts: approvedEmails('*'),
  async updateAccount(user, fields) { return { ...user, ...fields }; } };
const cookies = {};

let server, port;
before(async () => {
  server = staffServer(provider);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  port = server.address().port;
});
after(() => server.close());

beforeEach(() => {
  for (const t of rows.values()) t.clear();
  accounts.clear(); invited.length = 0;
  provider.accepts = approvedEmails('*');
  for (const [uid, role] of [['owner1', 'owner'], ['admin1', 'board-admin'], ['staff1', 'staff']]) {
    accounts.set(uid, { uid, email: uid + '@solaria.example', displayName: uid, disabled: false, providerData: [],
      customClaims: { role }, tokensValidAfterTime: new Date(Date.now() - 3600_000).toUTCString() });
    cookies[uid] = randomBytes(32).toString('base64url');
    table('teamBrowserSessions').set(hash(cookies[uid]), {
      uid, authTime: Math.floor(Date.now() / 1000) - 60, expires: { toMillis: () => Date.now() + 3600_000 } });
  }
});

function create(as, fields) {
  const data = JSON.stringify(fields);
  const headers = { cookie: '__Host-solaria_team=' + cookies[as], 'x-team-request': '1', origin: ORIGIN,
    'content-type': 'application/json', 'content-length': Buffer.byteLength(data) };
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, method: 'POST', path: '/accounts', headers }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString() || '{}') }));
    });
    req.on('error', reject);
    req.end(data);
  });
}

test('with * the Owner adds a person at any address, and the invitation goes there', async () => {
  const made = await create('owner1', { displayName: 'New Person', email: ' New.Person@Gmail.example ', role: 'staff' });
  assert.equal(made.status, 201);
  assert.deepEqual([made.body.email, made.body.role, made.body.active], ['new.person@gmail.example', 'staff', true]);
  assert.deepEqual(invited, ['new.person@gmail.example']);
});

test('with * a Board Admin adds staff anywhere, but still no Board Admin', async () => {
  assert.equal((await create('admin1', { displayName: 'A', email: 'a@school.example', role: 'staff' })).status, 201);
  assert.equal((await create('admin1', { displayName: 'B', email: 'b@school.example', role: 'board-admin' })).status, 403);
});

test('with * a staff member still adds no one, and a bad address is still refused', async () => {
  assert.equal((await create('staff1', { displayName: 'C', email: 'c@school.example', role: 'staff' })).status, 403);
  const bad = await create('owner1', { displayName: 'D', email: 'not an email', role: 'staff' });
  assert.deepEqual([bad.status, bad.body.error], [400, 'Use an approved team email.']);
  assert.equal(accounts.size, 3);
  assert.deepEqual(invited, []);
});

test('without * the Owner is held to the named list, as before', async () => {
  provider.accepts = approvedEmails('owner1@solaria.example,named@school.example');
  const refused = await create('owner1', { displayName: 'E', email: 'e@school.example', role: 'staff' });
  assert.deepEqual([refused.status, refused.body.error], [400, 'Use an approved team email.']);
  assert.equal((await create('owner1', { displayName: 'F', email: 'named@school.example', role: 'staff' })).status, 201);
});
