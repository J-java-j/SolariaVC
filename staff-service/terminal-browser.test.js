import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { randomBytes } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { connectEmulator, provision } from './provider.js';
import { fixturePassword, fixtures } from './fixtures.js';

const hosted = process.env.TEAM_BROWSER_STAGING === '1';
const site = hosted ? process.env.TEAM_PORTAL_ORIGIN : 'http://127.0.0.1:5173';
const tool = hosted ? process.env.TEAM_TERMINAL_ORIGIN : 'http://localhost:8790';
const password = hosted ? randomBytes(32).toString('base64url') : fixturePassword;
const teamPassword = hosted ? process.env.STAGING_TEAM_PASSWORD : 'Fictional-team-2026!';
const adminPassword = hosted ? process.env.STAGING_ADMIN_PASSWORD : 'Fictional-admin-2026!';
const api = { 'X-Terminal': '1' };
const staffLogin = '/staff/launch/terminal';
const endpoint = admin => admin ? '/api/admin/state' : '/api/evidence';

async function enter(page, path, email) {
  await page.goto(tool + path);
  await page.waitForURL(site + '/staff?launch=' + (path === '/admin' ? 'terminal-admin' : 'terminal'));
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

test('Direct Terminal entries, password layers, role updates and portal sign-out in Chrome', async t => {
  const browser = await chromium.launch(hosted ? {} : { channel: 'chrome' });
  t.after(() => browser.close());
  let provider, accounts = fixtures;
  if (hosted) {
    assert.match(site, /^https:\/\/solaria-team-staging-web-183999986614\.[a-z0-9-]+\.run\.app$/);
    assert.match(tool, /^https:\/\/solaria-team-staging-terminal-183999986614\.[a-z0-9-]+\.run\.app$/);
    assert.match(process.env.TEAM_FIREBASE_TENANT || '', /^staging-[a-zA-Z0-9-]+$/);
    assert.ok(teamPassword && adminPassword && !process.env.FIREBASE_AUTH_EMULATOR_HOST);
    const accessToken = process.env.STAGING_OPERATOR_TOKEN;
    assert.ok(accessToken, 'A temporary Cloud Shell operator token is required.');
    const credential = { getAccessToken: async () => ({ access_token: accessToken, expires_in: 1800 }) };
    const app = initializeApp({ projectId: 'gen-lang-client-0188652481', credential });
    provider = { auth: getAuth(app).tenantManager().authForTenant(process.env.TEAM_FIREBASE_TENANT) };
    accounts = [];
    for (const { role, displayName } of fixtures) {
      const email = role + '-' + Date.now() + '@example.test';
      const account = await provision(provider, { displayName, email, password }, role);
      t.after(() => provider.auth.deleteUser(account.uid));
      accounts.push({ role, email });
    }
  } else provider = connectEmulator();
  for (const { role, email } of accounts) {
    for (const admin of [false, true]) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      page.setDefaultTimeout(10000);
      const path = admin ? '/admin' : '/';
      const request = () => ctx.request.get(tool + endpoint(admin), { headers: api });
      assert.equal((await request()).status(), 401);
      await enter(page, path, email);
      if (admin && role === 'staff') {
        await page.getByRole('heading', { name: 'Access denied' }).waitFor();
        await page.goto(tool + '/');
        await page.getByLabel('Team password').waitFor();
        assert.equal((await page.goto(tool + '/admin')).status(), 403);
        assert.equal((await request()).status(), 403);
      } else {
        await page.getByLabel(admin ? 'Admin password' : 'Team password', { exact: true }).waitFor();
        assert.equal(page.url(), tool + (admin ? '/admin' : '/login'));
        assert.equal((await request()).status(), 401);
        const toolPassword = admin ? adminPassword : teamPassword;
        const unlock = value => ctx.request.post(tool + (admin ? '/api/admin/login' : '/api/login'), {
          headers: api, data: { password: value },
        });
        assert.equal((await unlock('incorrect')).status(), 401);
        assert.equal((await unlock(toolPassword)).status(), 200);
        assert.equal((await request()).status(), 200);
        const portal = await ctx.newPage();
        await portal.goto(site + '/staff');
        const link = portal.locator('a[href="' + staffLogin + (admin ? '-admin' : '') + '"]').first();
        const opened = portal.waitForEvent('popup');
        await link.click();
        const tab = await opened;
        await tab.waitForURL(tool + path);
        assert.equal(portal.url(), site + '/staff');
        await tab.close();
        const handoff = await ctx.request.get(site + staffLogin);
        const ticket = /name="ticket" value="([^"]+)"/.exec(await handoff.text())?.[1];
        assert.ok(ticket, 'portal issued a handoff');
        const redeem = () => ctx.request.post(tool + '/team/session', { headers: { Origin: site }, form: { ticket }, maxRedirects: 0 });
        const attempts = await Promise.all([redeem(), redeem()]);
        assert.deepEqual(attempts.map(r => r.status()).sort(), [303, 401]);
        await portal.locator('.portal-user-trigger').click();
        await portal.getByRole('button', { name: 'Sign out' }).click();
        await portal.getByLabel('Email', { exact: true }).waitFor();
        assert.equal((await request()).status(), 401);
        await page.goto(tool + path);
        await page.getByLabel('Email', { exact: true }).waitFor();
      }
      await ctx.close();
      t.diagnostic(role + ' copied ' + path + ' passed');
    }
  }
  const email = 'terminal-' + Date.now() + '@example.test';
  const account = await provision(provider, { email, password, displayName: 'Terminal test' }, 'board-admin');
  t.after(() => provider.auth.deleteUser(account.uid));
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await enter(page, '/admin', email);
  await page.getByLabel('Admin password', { exact: true }).waitFor();
  for (const [path, password] of [['/api/login', teamPassword], ['/api/admin/login', adminPassword]]) {
    assert.equal((await ctx.request.post(tool + path, { headers: api, data: { password } })).status(), 200);
  }
  const owner = await browser.newContext();
  const control = await owner.newPage();
  await enter(control, '/admin', accounts.find(a => a.role === 'owner').email);
  await control.getByLabel('Admin password', { exact: true }).waitFor();
  const update = fields => owner.request.patch(site + '/staff/local-api/accounts/' + account.uid, {
    headers: { 'X-Team-Request': '1', Origin: site }, data: fields,
  });
  assert.equal((await update({ role: 'staff' })).status(), 200);
  assert.equal((await ctx.request.get(tool + endpoint(true), { headers: api })).status(), 403);
  assert.equal((await page.goto(tool + '/admin')).status(), 403);
  assert.equal((await ctx.request.get(tool + endpoint(false), { headers: api })).status(), 200);
  assert.equal((await ctx.request.post(tool + '/api/settings', { headers: api, data: { mode: 'test' } })).status(), 403);
  assert.equal((await update({ active: false })).status(), 200);
  assert.equal((await ctx.request.get(tool + endpoint(false), { headers: api })).status(), 403);
  assert.equal((await page.goto(tool + '/')).status(), 403);
  t.diagnostic('Demotion and deactivation enforced with both Terminal passwords already satisfied');
});
