// The Team Portal's check in front of Solaria Sign's team pages (server/team-access.mjs). Since 2026-11-24 it
// answered Sign's "who is signed in?" with nobody for any browser without a Team Portal session, so a team
// member who signed in with Sign's own emailed link was sent round in a loop. TEAM_SIGN_GATE=off takes the
// check off Sign (Sign's own sign-in then decides, as before); anything else leaves it on, as Daniel built it.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { guardTeamDestination } from '../server/team-access.mjs';

const realFetch = globalThis.fetch;
let asked, verdict;
beforeEach(() => {
  asked = []; verdict = 401;
  globalThis.fetch = async (url, options) => { asked.push([String(url), options?.headers?.cookie ?? '']); return { status: verdict }; };
});
afterEach(() => { globalThis.fetch = realFetch; delete process.env.TEAM_SIGN_GATE; });

function visit(url, cookie = '') {
  const res = { headers: {}, status: null, body: null,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    writeHead(status, headers = {}) { this.status = status; for (const [k, v] of Object.entries(headers)) this.headers[k.toLowerCase()] = v; return this; },
    end(body = '') { this.body = String(body); } };
  return guardTeamDestination({ url, headers: { cookie } }, res, '', 'http://127.0.0.1:1').then(handled => ({ handled, res }));
}

const TEAM_PATHS = ['/api/sign/me', '/api/sign/envelopes', '/api/sign/envelopes/ABCDEFGHJKLM', '/api/sign/folders',
  '/api/sign/team', '/sign/team', '/sign/queue', '/sign/e/ABCDEFGHJKLM'];

test('with the check on, a browser without a Team Portal session is told nobody is signed in to Sign', async () => {
  const { handled, res } = await visit('/api/sign/me', 'sign_session=a-valid-sign-session');
  assert.equal(handled, true);
  assert.deepEqual([res.status, res.body], [200, '{"user":null}']);       // the loop: Sign's own session is never asked
  assert.equal(asked.length, 1);
  assert.equal(asked[0][1], '');                                            // only the portal's cookie is passed on
});

test('with the check on, the other team pages are refused or sent to the portal sign-in', async () => {
  assert.equal((await visit('/api/sign/envelopes')).res.status, 401);
  const page = await visit('/sign/queue');
  assert.deepEqual([page.res.status, page.res.headers.location], [303, '/staff?launch=sign-queue']);
  verdict = 403;
  assert.equal((await visit('/sign/team')).res.status, 403);
  verdict = 204;
  assert.equal((await visit('/api/sign/envelopes')).handled, false);        // the portal session passes: Sign answers
});

test('TEAM_SIGN_GATE=off takes the check off every Sign team path, and asks the portal nothing', async () => {
  process.env.TEAM_SIGN_GATE = 'off';
  for (const path of TEAM_PATHS) {
    const { handled, res } = await visit(path, 'sign_session=a-valid-sign-session');
    assert.equal(handled, false, path);                                      // Sign's own sign-in decides, as before
    assert.equal(res.status, null, path);
  }
  assert.deepEqual(asked, []);
});

test('only the exact value off turns it off', async () => {
  for (const value of ['', 'on', 'OFF', 'false', '0', 'no']) {
    process.env.TEAM_SIGN_GATE = value;
    assert.equal((await visit('/api/sign/envelopes')).handled, true, JSON.stringify(value));
  }
});

test('paths that were never checked stay unchecked either way', async () => {
  for (const setting of [undefined, 'off']) {
    if (setting) process.env.TEAM_SIGN_GATE = setting; else delete process.env.TEAM_SIGN_GATE;
    for (const path of ['/', '/sign', '/s', '/sign/verify', '/sign/login', '/api/sign/my', '/api/sign/auth/request', '/api/sign/auth/verify']) {
      assert.equal((await visit(path)).handled, false, path);
    }
  }
  assert.deepEqual(asked, []);
});
