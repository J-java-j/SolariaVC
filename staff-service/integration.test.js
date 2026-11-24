import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { once } from 'node:events';
import { staffServer } from './api.js';
import { connectEmulator } from './provider.js';
import { seed, fixturePassword, passwordSignIn } from './fixtures.js';
import { invite as deliverInvite } from './invitations.js';

const provider = connectEmulator(true);
const server = staffServer(provider);
let base;
const sessions = {};

async function api(method, path, token, fields) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const response = await fetch(base + path, { method, headers, body: JSON.stringify(fields) });
  return { status: response.status, data: await response.json() };
}

async function signIn(email, password) {
  const response = await passwordSignIn(provider.identity, email, password);
  assert.equal(response.status, 200);
  return (await response.json()).idToken;
}

before(async () => {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = 'http://127.0.0.1:' + server.address().port;
  await seed(provider);
  await seed(provider);
  for (const role of ['staff', 'board-admin', 'owner']) {
    sessions[role] = await signIn(role + '@example.test', fixturePassword);
  }
});
after(async () => {
  await new Promise(resolve => server.close(resolve));
});

test('provider signs in each role and the API returns its own profile', async () => {
  for (const [role, token] of Object.entries(sessions)) {
    const { status, data } = await api('GET', '/me', token);
    assert.equal(status, 200);
    assert.equal(data.uid, 'seed-' + role);
    assert.equal(data.role, role);
    assert.equal(data.active, true);
  }
  assert.equal((await api('GET', '/me')).status, 401);
  assert.equal((await api('GET', '/me', 'invalid')).status, 401);
  assert.equal((await passwordSignIn(provider.identity, 'owner@example.test', 'Wrong-password')).ok, false);
});

test('a Firebase login without a portal role grants no portal access', async () => {
  await provider.auth.createUser({ email: 'outside@example.test', password: fixturePassword });
  const token = await signIn('outside@example.test', fixturePassword);
  assert.equal((await api('GET', '/me', token)).status, 403);
  assert.equal((await api('GET', '/accounts', token)).status, 403);
});

test('browser session exchange, launch decisions and cookie mutation checks', async () => {
  const headers = { Origin: provider.portalOrigin, Authorization: 'Bearer ' + sessions.staff, 'X-Team-Request': '1' };
  assert.equal((await fetch(base + '/session', { method: 'POST', headers: { ...headers, Origin: 'https://unrelated.example' } })).status, 403);
  const exchange = await fetch(base + '/session', { method: 'POST', headers });
  assert.equal(exchange.status, 200);
  const setCookie = exchange.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Lax/);
  const Cookie = setCookie.split(';')[0];
  assert.equal((await fetch(base + '/me', { headers: { Cookie } })).status, 200);
  assert.equal((await fetch(base + '/session', { method: 'DELETE', headers: { Cookie } })).status, 403);
  assert.equal((await fetch(base + '/staff/launch/terminal-admin', { headers: { Cookie } })).status, 403);
  assert.equal((await fetch(base + '/staff/launch/unknown', { headers: { Cookie } })).status, 404);
  const loggedOut = await fetch(base + '/session', { method: 'DELETE', headers: { Cookie, Origin: provider.portalOrigin, 'X-Team-Request': '1' } });
  assert.match(loggedOut.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await fetch(base + '/guard/sign-team', { redirect: 'manual' })).status, 401);
});

const staffInput = { email: 'invite@example.test', displayName: 'Taylor Ellis', role: 'staff' };
test('Staff cannot list, create, or edit accounts', async () => {
  assert.equal((await api('GET', '/accounts', sessions.staff)).status, 403);
  assert.equal((await api('POST', '/accounts', sessions.staff, staffInput)).status, 403);
  assert.equal((await api('PATCH', '/accounts/seed-staff', sessions.staff, { active: false })).status, 403);
});

test('Board Admin roster and management are limited to Staff, even when changing a target role', async () => {
  const board = sessions['board-admin'];
  const other = await api('POST', '/accounts', sessions.owner, { ...staffInput, email: 'second@example.test', role: 'board-admin' });
  assert.equal(other.status, 201);
  const roster = await api('GET', '/accounts', board);
  assert.equal(roster.status, 200);
  assert.deepEqual(roster.data.accounts.map(user => user.role), ['staff']);
  for (const target of [other.data.uid, 'seed-board-admin', 'seed-owner']) {
    for (const patch of [{ active: false }, { role: 'staff' }, { displayName: 'New name' }]) {
      assert.equal((await api('PATCH', '/accounts/' + target, board, patch)).status, 403);
    }
  }
  for (const role of ['board-admin', 'owner']) {
    assert.equal((await api('POST', '/accounts', board, { ...staffInput, role })).status, 403);
    assert.equal((await api('PATCH', '/accounts/seed-staff', board, { role })).status, 403);
  }
  assert.equal((await api('PATCH', '/accounts/seed-owner', sessions.owner, { active: false })).status, 403);
  assert.equal((await api('POST', '/accounts', sessions.owner, { ...staffInput, role: 'owner' })).status, 403);
  const ownerRoster = await api('GET', '/accounts', sessions.owner);
  assert.deepEqual(new Set(ownerRoster.data.accounts.map(row => row.role)), new Set(['staff', 'board-admin']));
});

test('Board Admin invites and edits Staff; recipient sets own password once in emulator', async () => {
  const board = sessions['board-admin'];
  const added = await api('POST', '/accounts', board, staffInput);
  assert.equal(added.status, 201);
  const uid = added.data.uid;
  assert.deepEqual(added.data, { uid, ...staffInput, active: true });
  assert.equal((await api('POST', '/accounts', board, staffInput)).status, 409);
  assert.equal((await api('POST', '/accounts/' + uid + '/invite', sessions.staff)).status, 403);
  assert.equal((await api('POST', '/accounts/seed-owner/invite', board)).status, 403);
  assert.equal((await api('POST', '/accounts/' + uid + '/invite', board)).status, 200);
  assert.equal((await passwordSignIn(provider.identity, staffInput.email, fixturePassword)).ok, false);
  const outbox = await fetch(provider.base + '/emulator/v1/projects/' + provider.projectId + '/oobCodes');
  const { oobCodes } = await outbox.json();
  const invite = oobCodes.filter(item => item.email === staffInput.email && item.requestType === 'PASSWORD_RESET').at(-1);
  assert.ok(invite);
  assert.equal(new URL(invite.oobLink).origin, provider.base);
  const password = 'Chosen-by-Taylor-123';
  const redeem = () => fetch(provider.identity + '/accounts:resetPassword?key=local-demo', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oobCode: invite.oobCode, newPassword: password })
  });
  assert.equal((await redeem()).status, 200);
  assert.equal((await redeem()).ok, false);
  const token = await signIn(staffInput.email, password);
  assert.equal((await api('POST', '/accounts/' + uid + '/invite', board)).status, 400);
  const path = '/accounts/' + uid;
  assert.equal((await api('PATCH', path, board, { displayName: 'Taylor Reed' })).status, 200);
  assert.equal((await api('GET', '/me', token)).data.displayName, 'Taylor Reed');
  assert.equal((await api('PATCH', path, board, { active: false })).status, 200);
  assert.equal((await api('GET', '/me', token)).status, 403);
  assert.equal((await passwordSignIn(provider.identity, staffInput.email, password)).ok, false);
  assert.equal((await api('PATCH', path, board, { active: true })).status, 200);
  assert.equal((await api('GET', '/me', await signIn(staffInput.email, password))).data.uid, uid);
});

test('staging invitation message links to the portal password form', async t => {
  const email = 'recipient@example.test';
  let mail;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    mail = JSON.parse(options.body);
    return new Response('{}');
  });
  await deliverInvite({ auth: { generatePasswordResetLink: async () => 'https://auth.example.test/?oobCode=fictional-mail-fixture' },
    portalOrigin: 'https://team.example.test', mail: { sender: 'sender@example.test', key: 'fixture' } }, email);
  assert.deepEqual(mail.to, [email]);
  assert.match(mail.html, /href="https:\/\/team\.example\.test\/staff#invite=fictional-mail-fixture"/);
  assert.ok(mail.text.includes('https://team.example.test/staff#invite=fictional-mail-fixture'));
});

test('Owner demotion and deactivation take effect on the next request with the same Board Admin token', async () => {
  const token = sessions['board-admin'];
  const before = (await api('GET', '/me', token)).data;
  const path = '/accounts/' + before.uid;
  assert.equal((await api('GET', '/accounts', token)).status, 200);
  const demoted = await api('PATCH', path, sessions.owner, { role: 'staff', displayName: 'Riley Morgan' });
  assert.equal(demoted.status, 200);
  assert.equal((await api('GET', '/accounts', token)).status, 403);
  assert.equal((await api('POST', '/accounts', token, staffInput)).status, 403);
  const me = await api('GET', '/me', token);
  assert.deepEqual(me.data, { ...before, role: 'staff', displayName: 'Riley Morgan' });
  assert.equal((await api('PATCH', path, sessions.owner, { role: 'board-admin' })).status, 200);
  assert.equal((await api('GET', '/accounts', token)).status, 200);
  assert.equal((await api('PATCH', path, sessions.owner, { active: false })).status, 200);
  assert.equal((await api('GET', '/accounts', token)).status, 403);
  assert.equal((await api('GET', '/me', token)).status, 403);
  assert.equal((await passwordSignIn(provider.identity, before.email, fixturePassword)).ok, false);
  assert.equal((await api('PATCH', path, sessions.owner, { active: true })).status, 200);
  const restored = await signIn(before.email, fixturePassword);
  assert.equal((await api('GET', '/me', restored)).data.uid, before.uid);
  assert.equal((await api('GET', '/accounts', restored)).status, 200);
});

test('invalid edits cannot change identity or partially update the account', async () => {
  for (const fields of [{ active: 'false' }, { uid: 'replaced' }, { displayName: ' ', active: false }, { role: 'owner' }]) {
    assert.ok((await api('PATCH', '/accounts/seed-staff', sessions.owner, fields)).status >= 400);
  }
  assert.equal((await api('GET', '/me', sessions.staff)).data.active, true);
});
