import test from 'node:test';
import assert from 'node:assert/strict';
import { terminalHandoff } from './terminal-handoff.js';

function response() {
  return {
    writeHead(status, headers) { Object.assign(this, { status, headers }); },
    end(body) { this.body = body; },
  };
}

test('Terminal tickets are single use, scoped to an entry, and linked to sign-out', async () => {
  const bridge = terminalHandoff();
  const page = response();
  await bridge.launch(page, 'terminal-admin', 'test-cookie', async () => {});
  const ticket = /name="ticket" value="([^"]+)"/.exec(page.body)[1];
  const grant = bridge.exchange(ticket);
  assert.equal(grant.entry, '/admin');
  assert.equal(bridge.cookie(grant.handle), 'test-cookie');
  assert.equal(bridge.exchange(ticket), null);
  bridge.forget('test-cookie');
  assert.equal(bridge.cookie(grant.handle), undefined);
});

test('A launch waiting for Firebase cannot recreate a signed-out session', async () => {
  const bridge = terminalHandoff();
  const page = response();
  let resume;
  const pending = bridge.launch(page, 'terminal', 'test-cookie', () => new Promise(resolve => { resume = resolve; }));
  bridge.forget('test-cookie');
  resume();
  await pending;
  assert.equal(page.status, 303);
  assert.equal(page.headers.Location, '/staff?launch=terminal');
  assert.equal(page.body, undefined);
});
