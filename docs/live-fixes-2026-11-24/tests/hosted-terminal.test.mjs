// The website's sign-in check (staff-service/hosted-terminal.js), run against a fake
// database and a fake Google account service. Nothing here talks to Google.
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { hostedTerminal } from '../staff-service/hosted-terminal.js';

const T0 = Date.UTC(2026, 10, 24, 18, 0, 0);
const realNow = Date.now;
let now = T0;
Date.now = () => now;
after(() => { Date.now = realNow; });

const at = ms => ({ toMillis: () => ms });
const hash = value => createHash('sha256').update(value).digest('hex');
const cookie = n => String(n).padStart(43, 'c');

function fakeDb() {
  const rows = new Map();
  const counts = { get: 0, delete: 0 };
  const table = name => { if (!rows.has(name)) rows.set(name, new Map()); return rows.get(name); };
  return {
    counts, table,
    collection(name) {
      const t = table(name);
      return {
        doc(id) {
          return {
            async get() { counts.get++; const row = t.get(id); return { data: () => row }; },
            async delete() { counts.delete++; t.delete(id); },
            async create(value) { if (t.has(id)) throw new Error('exists'); t.set(id, value); },
          };
        },
      };
    },
  };
}

function fakeAuth() {
  const accounts = new Map();
  const counts = { getUser: 0 };
  return {
    accounts, counts,
    async getUser(uid) {
      counts.getUser++;
      const account = accounts.get(uid);
      if (!account) throw Object.assign(new Error('no user'), { code: 'auth/user-not-found' });
      return structuredClone(account);
    },
  };
}

let db, auth, portal;
function person(uid, role, n, { expires = T0 + 8 * 3600_000 } = {}) {
  auth.accounts.set(uid, {
    uid, email: uid + '@example.test', displayName: uid, disabled: false,
    customClaims: { role }, tokensValidAfterTime: new Date(T0 - 3600_000).toUTCString(),
  });
  db.table('teamBrowserSessions').set(hash(cookie(n)), { uid, authTime: (T0 - 60_000) / 1000, expires: at(expires) });
  return cookie(n);
}
const refused = status => err => err.status === status;

beforeEach(() => {
  now = T0;
  db = fakeDb();
  auth = fakeAuth();
  portal = hostedTerminal(auth, db, 'https://terminal.example.test');
});

test('a second look within 10 seconds asks Google nothing', async () => {
  const c = person('u1', 'owner', 1);
  assert.equal((await portal.user(c)).uid, 'u1');
  now += 9_999;
  assert.equal((await portal.user(c)).uid, 'u1');
  assert.equal(auth.counts.getUser, 1);
  assert.equal(db.counts.get, 1);
});

test('after 10 seconds it asks again', async () => {
  const c = person('u1', 'owner', 1);
  await portal.user(c);
  now += 10_000;
  await portal.user(c);
  assert.equal(auth.counts.getUser, 2);
});

test('the memory never outlives the session itself', async () => {
  const c = person('u1', 'owner', 1, { expires: T0 + 3_000 });
  await portal.user(c);
  now += 3_000;
  await assert.rejects(portal.user(c), refused(401));
  assert.equal(db.counts.get, 2);
});

test('a refusal is never remembered', async () => {
  const c = person('u1', 'owner', 1);
  auth.accounts.get('u1').disabled = true;
  await assert.rejects(portal.user(c), refused(403));
  auth.accounts.get('u1').disabled = false;
  now += 1_000;
  assert.equal((await portal.user(c)).uid, 'u1');
  assert.equal(auth.counts.getUser, 2);
});

test('signing out forgets at once', async () => {
  const c = person('u1', 'owner', 1);
  await portal.user(c);
  await portal.forget(c);
  assert.equal(db.counts.delete, 1);
  now += 1_000;
  await assert.rejects(portal.user(c), refused(401));
});

test('a fresh look always asks, and what it finds replaces the memory', async () => {
  const c = person('u1', 'board-admin', 1);
  await portal.user(c);
  auth.accounts.get('u1').customClaims.role = 'staff';
  assert.equal((await portal.user(c, true)).customClaims.role, 'staff');
  now += 1_000;
  assert.equal((await portal.user(c)).customClaims.role, 'staff');
  assert.equal(auth.counts.getUser, 2);
});

test('a fresh refusal wipes what was remembered', async () => {
  const c = person('u1', 'owner', 1);
  await portal.user(c);
  auth.accounts.get('u1').disabled = true;
  await assert.rejects(portal.user(c, true), refused(403));
  now += 1_000;
  await assert.rejects(portal.user(c), refused(403));
});

test('each sign-in is remembered on its own', async () => {
  const a = person('u1', 'owner', 1);
  const b = person('u2', 'staff', 2);
  assert.equal((await portal.user(a)).uid, 'u1');
  assert.equal((await portal.user(b)).uid, 'u2');
  now += 1_000;
  assert.equal((await portal.user(a)).uid, 'u1');
  assert.equal((await portal.user(b)).uid, 'u2');
  assert.equal(auth.counts.getUser, 2);
});

test('the memory stays small: past 1000 sign-ins it starts over', async () => {
  const cookies = [];
  for (let n = 1; n <= 1001; n++) cookies.push(person('u' + n, 'staff', n));
  for (const c of cookies) await portal.user(c);
  assert.equal(auth.counts.getUser, 1001);
  await portal.user(cookies[0]);      // dropped when the 1001st arrived: asked again
  await portal.user(cookies[1000]);   // the newest is still remembered
  assert.equal(auth.counts.getUser, 1002);
});

test('a malformed cookie is refused without asking anyone', async () => {
  await assert.rejects(portal.user('short'), refused(401));
  await assert.rejects(portal.user(undefined), refused(401));
  assert.equal(db.counts.get + auth.counts.getUser, 0);
});
