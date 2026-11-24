import { fixtures, fixturePassword, passwordSignIn } from './fixtures.js';

for (const { email } of fixtures) {
  const login = await passwordSignIn('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1', email, fixturePassword);
  if (!login.ok) throw new Error(email + ': emulator sign-in failed (' + login.status + ').');
  const { idToken } = await login.json();
  const headers = { Authorization: 'Bearer ' + idToken };
  const me = await fetch('http://127.0.0.1:8787/me', { headers });
  if (!me.ok) throw new Error(email + ': profile request failed (' + me.status + ').');
  const account = await me.json();
  const roster = await fetch('http://127.0.0.1:8787/accounts', { headers });
  console.log(email, '| role:', account.role, '| GET /me:', me.status, '| GET /accounts:', roster.status);
  if (roster.status !== (account.role === 'staff' ? 403 : 200)) process.exitCode = 1;
}
