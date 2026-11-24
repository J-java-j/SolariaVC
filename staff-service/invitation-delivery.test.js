import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes } from 'node:crypto';
import { invite } from './invitations.js';

for (const accepted of [true, false]) {
  test('production invitation ' + (accepted ? 'validates the code before delivery' : 'withholds delivery on a recipient mismatch'), async t => {
    const original = { ...process.env };
    t.after(() => {
      for (const key of ['TEAM_AUTH_MODE', 'TEAM_FIREBASE_TENANT', 'TEAM_BROWSER_API_KEY']) {
        if (original[key] === undefined) delete process.env[key];
        else process.env[key] = original[key];
      }
    });
    const tenant = 'fixture-tenant';
    const origin = 'https://portal.example.test';
    const recipient = 'recipient@example.test';
    const code = randomBytes(24).toString('base64url');
    Object.assign(process.env, { TEAM_AUTH_MODE: 'production', TEAM_FIREBASE_TENANT: tenant, TEAM_BROWSER_API_KEY: 'fixture' });
    const action = new URL('/action', 'https://auth.example.test');
    action.search = new URLSearchParams({ tenantId: tenant, oobCode: code });
    const provider = {
      auth: { generatePasswordResetLink: async () => action.href },
      portalOrigin: origin, mail: { sender: 'service@example.test', key: 'fixture' },
    };
    const requests = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      requests.push(new URL(url).hostname);
      const body = JSON.parse(options.body);
      if (requests.length === 1) {
        // Check-only requests omit newPassword so the recipient can redeem the code.
        assert.deepEqual(body, { oobCode: code, tenantId: tenant });
        assert.equal(options.headers.Referer, origin + '/');
        return Response.json({ requestType: 'PASSWORD_RESET', email: accepted ? recipient : 'other@example.test' });
      }
      assert.deepEqual(body.to, [recipient]);
      assert.ok(body.text.includes(origin + '/staff?recover=1'));
      assert.ok(body.text.includes(code));
      return Response.json({});
    });
    if (accepted) await invite(provider, recipient);
    else await assert.rejects(invite(provider, recipient), /validate the new invitation/);
    assert.deepEqual(requests, accepted ? ['identitytoolkit.googleapis.com', 'api.resend.com'] : ['identitytoolkit.googleapis.com']);
  });
}
