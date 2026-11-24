import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { once } from 'node:events';
import { connectEmulator } from './provider.js';
import { passwordSignIn } from './fixtures.js';
import { staffServer } from './api.js';

test('empty project → approved Owner setup → first Board Admin invitation', async t => {
  const provider = connectEmulator(true);
  assert.equal((await provider.auth.listUsers()).users.length, 0);
  const email = 'first-owner@example.test';
  const command = (project, address, approved = email) => promisify(execFile)(process.execPath,
    ['owner-setup.js', '--project', project, '--email', address],
    { env: { ...process.env, TEAM_OWNER_EMAIL: approved, TEAM_AUTH_MODE: 'emulator-test' } });
  await assert.rejects(command('wrong', email), /project confirmation/);
  await assert.rejects(command(provider.projectId, 'wrong@example.test'), /approved Owner/);
  await command(provider.projectId, email);
  t.after(async () => {
    for (const address of [email, 'first-board@example.test']) {
      const user = await provider.auth.getUserByEmail(address).catch(() => null);
      if (user) await provider.auth.deleteUser(user.uid);
    }
  });
  await command(provider.projectId, email);
  await assert.rejects(command(provider.projectId, 'different@example.test', 'different@example.test'), /already exists/);
  const users = (await provider.auth.listUsers()).users;
  assert.equal(users.length, 1);
  assert.equal(users[0].customClaims.role, 'owner');
  const server = staffServer(provider).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  // Before an Owner exists the local operator reads Firebase's emulator inbox.
  const codes = async () => (await (await fetch(provider.base + '/emulator/v1/projects/' + provider.projectId + '/oobCodes')).json()).oobCodes;
  const code = (await codes()).filter(item => item.email === email).at(-1).oobCode;
  const password = 'First-local-password!';
  const accepted = await fetch(provider.identity + '/accounts:resetPassword?key=local-demo', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ oobCode: decodeURIComponent(code), newPassword: password })
  });
  assert.equal(accepted.status, 200);
  const login = await passwordSignIn(provider.identity, email, password);
  assert.equal(login.status, 200);
  const headers = { Authorization: 'Bearer ' + (await login.json()).idToken, 'Content-Type': 'application/json' };
  assert.equal((await (await fetch(base + '/me', { headers })).json()).role, 'owner');
  assert.match((await command(provider.projectId, email)).stdout, /already configured/);
  const added = await fetch(base + '/accounts', { method: 'POST', headers,
    body: JSON.stringify({ email: 'first-board@example.test', displayName: 'First Board', role: 'board-admin' }) });
  assert.equal(added.status, 201);
  assert.ok((await codes()).some(item => item.email === 'first-board@example.test'));
});
