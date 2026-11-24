// Test the opt-in hosted bundle without making any hosted Firebase requests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { guardTeamDestination } from '../server/team-access.mjs';
import { build, preview } from 'vite';
import { chromium } from 'playwright-core';
import { fixturePassword } from './fixtures.js';

test('opt-in built Owner portal and Sign routes on a local staging rehearsal', async t => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const previousDirectory = process.cwd();
  process.chdir(root); // Tailwind resolves its content globs from the website root.
  t.after(() => process.chdir(previousDirectory));
  const outDir = await mkdtemp(join(tmpdir(), 'solaria-team-build-'));
  const config = { root, logLevel: 'error', build: { outDir }, define: {
    'import.meta.env.VITE_TEAM_PORTAL_ENABLED': JSON.stringify('true'),
    'import.meta.env.VITE_TEAM_FIREBASE_API_KEY': JSON.stringify('offline-test'),
  } };
  let server, browser;
  t.after(async () => {
    await browser?.close();
    if (server) await new Promise(resolve => server.httpServer.close(resolve));
    await rm(outDir, { recursive: true, force: true });
  });
  await build(config);
  for (const asset of await readdir(join(outDir, 'assets'))) {
    if (!asset.endsWith('.js')) continue;
    assert.doesNotMatch(await readFile(join(outDir, 'assets', asset), 'utf8'), /portal-preview-view|127\.0\.0\.1:9099|8787\/outbox/);
  }
  server = await preview({ ...config, preview: { host: '127.0.0.1', port: 0, proxy: {
    '/staff/launch/': 'http://127.0.0.1:8787',
    '/staff/local-api': { target: 'http://127.0.0.1:8787', rewrite: p => p.slice('/staff/local-api'.length) },
    '/api/sign': 'http://127.0.0.1:8080',
  } }, plugins: [{ name: 'local-staging-pages', configurePreviewServer(vite) {
    vite.middlewares.use(async (req, res, next) => {
      if (await guardTeamDestination(req, res)) return;
      const path = req.url.split('?')[0];
      if (path === '/staff') req.url = '/staff.html';
      if (path === '/sign' || path.startsWith('/sign/')) req.url = '/sign.html';
      next();
    });
  } }] });
  const base = 'http://127.0.0.1:' + server.httpServer.address().port;
  browser = await chromium.launch({ channel: 'chrome' });
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === base) return route.continue();
      if (url.origin !== 'https://identitytoolkit.googleapis.com') return route.abort();
      const response = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com' + url.pathname + '?key=local-demo',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: route.request().postData() });
      await route.fulfill({ status: response.status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: await response.text() });
    });
    await page.goto(base + '/staff?preview=owner');
    await page.getByLabel('Email', { exact: true }).fill('owner@example.test');
    await page.getByLabel('Password', { exact: true }).fill(fixturePassword);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    for (const path of ['/sign', '/sign/verify', '/sign/team']) {
      const id = { '/sign': 'documents', '/sign/verify': 'verify', '/sign/team': 'sign-team' }[path];
      const opened = page.waitForEvent('popup');
      await page.locator('a[href="/staff/launch/' + id + '"]').click();
      const tool = await opened;
      const label = path.endsWith('verify') ? 'Choose a PDF' : 'Email me a link';
      await tool.getByRole('button', { name: label }).waitFor();
      await tool.close();
      t.diagnostic(width + 'px, built Owner → ' + path + ' → ' + label);
      await page.goto(base + '/staff');
    }
    await page.close();
  }
});
