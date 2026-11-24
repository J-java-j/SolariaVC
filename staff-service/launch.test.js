import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { fixturePassword } from './fixtures.js';
import destinations from './destinations.json' with { type: 'json' };
import { connectEmulator } from './provider.js';

const base = 'http://127.0.0.1:5173';
const launch = id => '/staff/launch/' + id;
async function login(page, email) {
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(fixturePassword);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

async function stopExternalRedirects(context) {
  // Observe the local redirect and stop before contacting the external service.
  await context.route('**/staff/launch/*', async route => {
    const entry = destinations[new URL(route.request().url()).pathname.split('/').at(-1)];
    if (!entry?.href.startsWith('https:')) return route.continue();
    const response = await route.fetch({ maxRedirects: 0 });
    if (response.status() !== 303 || response.headers().location !== entry.href) return route.fulfill({ response });
    return route.fulfill({ status: 200, contentType: 'text/plain', body: 'Verified external redirect: ' + entry.href });
  });
}

test('shortcut first requests, normal browser actions and copied destinations', { timeout: 150000 }, async t => {
  const browser = await chromium.launch({ channel: 'chrome' });
  t.after(() => browser.close());
  const provider = connectEmulator();
  const board = await provider.auth.getUser('seed-board-admin');
  for (const [role, email] of [['staff', 'staff@example.test'], ['board-admin', board.disabled ? 'review-board@example.test' : board.email], ['owner', 'owner@example.test']]) {
    const context = await browser.newContext();
    await stopExternalRedirects(context);
    const portal = await context.newPage();
    await portal.goto(base + launch('sign-team'));
    await portal.waitForURL(base + '/staff?launch=sign-team');
    await login(portal, email);
    if (role === 'owner') {
      await portal.waitForURL(base + '/sign/team');
      await portal.getByRole('button', { name: 'Email me a link' }).waitFor();
    } else {
      await portal.getByRole('heading', { name: 'Access denied' }).waitFor();
    }
    await portal.goto(base + '/staff');
    await portal.getByRole('heading', { name: 'Solaria Terminal' }).waitFor();
    const cookie = (await context.cookies(base)).find(c => c.name === 'solaria_team_local');
    assert.ok(cookie?.httpOnly && cookie.sameSite === 'Lax');
    assert.equal(await portal.evaluate(() => sessionStorage.getItem('solaria.staff.local.idToken')), null);
    for (const [id, dest] of Object.entries(destinations)) {
      if (['outbox', 'sign-queue'].includes(id)) continue; // Outbox is on the invitation screen.
      const links = portal.locator('a[href="' + launch(id) + '"]');
      if (dest.roles && !dest.roles.includes(role)) {
        assert.equal(await links.count(), 0);
        const denied = await context.request.get(base + launch(id));
        assert.equal(denied.status(), 403);
        continue;
      }
      const link = links.first();
      await link.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
      const y = await portal.evaluate(() => scrollY);
      if (dest.action === 'download') {
        const receiving = portal.waitForEvent('download');
        await link.click();
        assert.equal((await receiving).suggestedFilename(), dest.href.split('/').at(-1));
      } else if (dest.action === 'mail') {
        const response = await context.request.get(base + launch(id), { maxRedirects: 0 });
        assert.equal(response.status(), 303);
        assert.equal(response.headers().location, dest.href);
      } else {
        assert.equal(await link.getAttribute('target'), '_blank');
        assert.equal(await link.getAttribute('rel'), 'noopener noreferrer');
        const opened = portal.waitForEvent('popup');
        await link.focus();
        await link.press('Enter');
        const tool = await opened;
        if (dest.href.startsWith('https:')) await tool.getByText('Verified external redirect: ' + dest.href, { exact: true }).waitFor();
        else await tool.waitForURL(url => url.href.replace(/\/$/, '') === new URL(dest.href, base).href.replace(/\/$/, ''));
        assert.equal(await tool.evaluate(() => window.opener === null), true);
        if (['documents', 'sign-team', 'verify'].includes(id)) {
          await tool.getByRole('button', { name: id === 'verify' ? 'Choose a PDF' : 'Email me a link' }).waitFor();
        }
        await tool.close();
      }
      assert.equal(portal.url(), base + '/staff');
      assert.equal(await portal.evaluate(() => scrollY), y, role + ' scroll position after ' + id);
    }
    const peer = await context.newPage();
    await peer.goto(base + '/staff');
    await peer.getByRole('heading', { name: 'Solaria Terminal' }).waitFor();
    await portal.locator('.portal-user-trigger').click();
    await portal.getByRole('button', { name: 'Sign out' }).click();
    await portal.getByLabel('Email', { exact: true }).waitFor();
    await peer.goto(base + launch('documents'));
    await peer.waitForURL(base + '/staff?launch=documents');
    await login(peer, email);
    await peer.waitForURL(base + '/sign');
    await peer.getByRole('button', { name: 'Email me a link' }).waitFor();
    await context.close();
    t.diagnostic(role + ': new tabs, scroll, vCards, mail handoff, role decisions and cross-tab sign-out');
  }
  for (const [id, email, allowed] of [
    ['terminal', 'staff@example.test', true],
    ['terminal-admin', 'staff@example.test', false],
    ['terminal-admin', 'owner@example.test', true],
    ['karl-card', 'staff@example.test', true],
    ['johnson-contact', 'staff@example.test', true],
    ['outbox', 'owner@example.test', true],
  ]) {
    const context = await browser.newContext();
    await stopExternalRedirects(context);
    const tab = await context.newPage();
    await tab.goto(base + launch(id));
    await tab.waitForURL(base + '/staff?launch=' + id);
    const downloading = id === 'johnson-contact' ? tab.waitForEvent('download') : null;
    await login(tab, email);
    if (!allowed) await tab.getByRole('heading', { name: 'Access denied' }).waitFor();
    else if (downloading) assert.equal((await downloading).suggestedFilename(), 'johnson-jiang.vcf');
    else if (id === 'karl-card') await tab.waitForURL(url => url.pathname.replace(/\/$/, '') === '/card/karl');
    else if (id === 'outbox') await tab.getByRole('heading', { name: 'Local invitation outbox' }).waitFor();
    else await tab.getByText('Verified external redirect: ' + destinations[id].href, { exact: true }).waitFor();
    await context.close();
  }
  const clean = await browser.newContext();
  const page = await clean.newPage();
  await page.goto(base + '/sign');
  await page.getByRole('button', { name: 'Email me a link' }).waitFor();
  await page.goto(base + '/sign/verify');
  await page.getByRole('button', { name: 'Choose a PDF' }).waitFor();
  for (const origin of [base, 'http://127.0.0.1:8080']) {
    await page.goto(origin + '/sign/my#fictional-recipient-link');
    await page.waitForURL(origin + '/sign#fictional-recipient-link');
    await page.getByRole('button', { name: 'Continue', exact: true }).waitFor();
    await page.goto(origin + '/s');
    await page.getByRole('link', { name: 'Go to my documents' }).waitFor();
  }
  for (const [path, id] of [['/sign/team', 'sign-team'], ['/staff/outbox', 'outbox'], ['/sign/queue', 'sign-queue'], ['/sign/e/ABCDEFGHIJKL', 'envelope-ABCDEFGHIJKL']]) {
    await page.goto(base + path);
    await page.waitForURL(base + '/staff?launch=' + id);
    await page.getByLabel('Email', { exact: true }).waitFor();
  }
  for (const origin of [base, 'http://127.0.0.1:8080']) {
    for (const path of ['/api/sign/team', '/api/sign/envelopes/ABCDEFGHIJKL/original', '/api/sign/folders']) {
      assert.equal((await clean.request.get(origin + path)).status(), 401);
    }
  }
  await page.goto(base + '/sign/team');
  await login(page, 'owner@example.test');
  await page.waitForURL(base + '/sign/team');
  await page.getByRole('button', { name: 'Email me a link' }).waitFor();
  assert.equal((await clean.request.get(base + '/api/sign/team')).status(), 401, 'Sign still requires its own login');
  for (const path of ['/sign/queue', '/sign/e/ABCDEFGHIJKL']) {
    await page.goto(base + path);
    await page.getByRole('button', { name: 'Email me a link' }).waitFor();
  }
  await clean.close();
});
