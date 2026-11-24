import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import {
  createSampleAccounts, parsePreview, saveSampleAccount, toggleSampleStatus,
} from '../src/staff/portal/accounts.ts';

test('preview views default safely to sign-in', () => {
  for (const value of [null, '', 'admin', 'invalid']) assert.equal(parsePreview(value), 'signin');
  for (const value of ['staff', 'board-admin', 'owner']) assert.equal(parsePreview(value), value);
});

test('sample staff can be added, edited, deactivated and reactivated without changing the fixtures', () => {
  const seed = createSampleAccounts();
  const added = saveSampleAccount(seed, 'board-admin', { name: ' Casey Demo ', username: ' CASEY.DEMO ', role: 'staff' });
  assert.equal(seed.length, 7);
  const person = added.at(-1);
  assert.equal(person.name, 'Casey Demo');
  assert.equal(person.username, 'casey.demo');
  const edited = saveSampleAccount(added, 'board-admin', { name: 'Casey Sample', username: 'casey.sample', role: 'staff' }, person.id);
  assert.equal(edited.at(-1).name, 'Casey Sample');
  const inactive = toggleSampleStatus(edited, 'board-admin', person.id);
  assert.equal(inactive.at(-1).status, 'inactive');
  assert.equal(toggleSampleStatus(inactive, 'board-admin', person.id).at(-1).status, 'active');
  assert.deepEqual(createSampleAccounts(), seed, 'a new mount restores the sample records');
});

test('Board Admin sample actions are restricted to staff; Owner can also manage board admins', () => {
  const seed = createSampleAccounts();
  const input = { name: 'Casey Demo', username: 'casey.demo', role: 'board-admin' };
  assert.throws(() => saveSampleAccount(seed, 'staff', { ...input, role: 'staff' }));
  assert.throws(() => saveSampleAccount(seed, 'board-admin', input));
  assert.throws(() => saveSampleAccount(seed, 'board-admin', { ...input, role: 'staff' }, 'demo-5'));
  assert.throws(() => toggleSampleStatus(seed, 'board-admin', 'demo-5'));
  const added = saveSampleAccount(seed, 'owner', input);
  assert.equal(added.at(-1).role, 'board-admin');
  assert.equal(toggleSampleStatus(seed, 'owner', 'demo-5')[4].status, 'inactive');
  assert.throws(() => toggleSampleStatus(seed, 'owner', 'demo-7'), /cannot manage/);
  assert.throws(() => saveSampleAccount(seed, 'owner', { ...input, role: 'owner' }));
});

test('sample validation catches duplicate usernames and invalid fields', () => {
  const seed = createSampleAccounts();
  assert.throws(() => saveSampleAccount(seed, 'owner', { name: 'Demo', username: 'AVERY.MORGAN', role: 'staff' }), /already used/);
  assert.throws(() => saveSampleAccount(seed, 'owner', { name: ' ', username: 'demo', role: 'staff' }), /name/);
  assert.throws(() => saveSampleAccount(seed, 'owner', { name: 'Demo', username: 'two words', role: 'staff' }), /username/);
  assert.throws(() => saveSampleAccount(seed, 'owner', { name: 'Demo', username: 'demo', role: 'staff' }, 'missing'), /cannot manage/);
  assert.equal(saveSampleAccount(seed, 'owner', { name: 'Avery Updated', username: 'avery.morgan', role: 'staff' }, 'demo-1')[0].name, 'Avery Updated');
});

// Render actual React components without a browser to check link semantics and
// role-specific placement. This does not replace desktop/mobile visual QA.
let server;
after(async () => { await server?.close(); });
test('dashboards retain original shortcut destinations and link behavior in every applicable role', async () => {
  server = await createServer({ configFile: false, cacheDir: 'node_modules/.vite-staff-tests', server: { middlewareMode: true }, appType: 'custom', esbuild: { jsx: 'automatic' } });
  const { Dashboard } = await server.ssrLoadModule('/src/staff/portal/PortalScreens.tsx');
  const { tools } = await server.ssrLoadModule('/src/staff/Staff.tsx');
  assert.deepEqual(tools.flatMap((tool) => tool.links.map(({ label, href }) => [label, href])), [
    ['Documents', '/sign'], ['Check a signed document', '/sign/verify'], ['Team', '/sign/team'],
    ['Terminal', 'https://terminal.solariavc.com'], ['Admin', 'https://terminal.solariavc.com/admin'],
    ['Johnson Jiang', '/card'], ['Karl Li', '/card/karl'],
    ['Johnson’s contact', '/card/johnson-jiang.vcf'], ['Karl’s contact', '/card/karl-li.vcf'],
    ['Webmail', 'https://app.titan.email'], ['Contact inbox', 'mailto:contact@solariavc.com'],
    ['Website', '/'], ['Linktree', 'https://linktr.ee/solariaventure'],
  ], 'the shortcut inventory is preserved');
  for (const role of ['staff', 'board-admin', 'owner']) {
    const html = renderToStaticMarkup(createElement(Dashboard, { role, onManage: () => {} }));
    assert.ok(html.indexOf('id="terminal-heading"') < html.indexOf('id="sign-heading"'));
    assert.ok(html.indexOf('id="sign-heading"') < html.indexOf('id="quick-heading"'));
    for (const tool of tools) for (const link of tool.links) {
      const expected = link.href === '/sign/team' ? role === 'owner'
        : link.href === 'https://terminal.solariavc.com/admin' ? role !== 'staff' : true;
      const anchor = html.match(new RegExp(`<a\\b[^>]*href="${link.href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>.*?</a>`, 's'))?.[0];
      assert.equal(Boolean(anchor), expected, `${role}: ${link.href}`);
      if (!anchor) continue;
      assert.ok(anchor.includes(link.label), `${role}: exact label ${link.label}`);
      assert.equal(anchor.includes('target="_blank"'), link.href.startsWith('http'));
      if (link.href.startsWith('http')) assert.ok(anchor.includes('rel="noopener noreferrer"'));
      assert.equal(anchor.includes('download=""'), Boolean(link.download));
    }
    assert.equal(html.includes('Manage Staff'), role !== 'staff');
    assert.equal(html.includes('Manage Board Admins'), role === 'owner');
  }
});
