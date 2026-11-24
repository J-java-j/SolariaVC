import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { fixturePassword } from './fixtures.js';

test('Sign shortcuts render their independent signed-out screens', async t => {
  const browser = await chromium.launch({ channel: 'chrome' });
  t.after(() => browser.close());
  const failures = [];
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const diagnostics = [];
    page.on('pageerror', e => diagnostics.push(e.message));
    page.on('console', m => { if (m.type() === 'error') diagnostics.push(m.text()); });
    page.on('response', r => { if (r.status() >= 400) diagnostics.push(r.status() + ' ' + new URL(r.url()).pathname); });
    page.on('requestfailed', r => diagnostics.push(new URL(r.url()).pathname + ' ' + r.failure()?.errorText));
    for (const port of [5173, 8080]) {
      const base = 'http://127.0.0.1:' + port;
      for (const path of ['/sign', '/sign/verify', '/sign/team']) {
        await page.goto(base + '/staff?mode=connected');
        if (port === 5173 && path === '/sign') {
          await page.getByLabel('Email', { exact: true }).fill('owner@example.test');
          await page.getByLabel('Password', { exact: true }).fill(fixturePassword);
          await page.getByRole('button', { name: 'Sign in', exact: true }).click();
        }
        const id = { '/sign': 'documents', '/sign/verify': 'verify', '/sign/team': 'sign-team' }[path];
        const link = page.locator('a[href="' + (port === 5173 ? '/staff/launch/' + id : path) + '"]');
        let target = page;
        if (port === 5173) {
          const opened = page.waitForEvent('popup');
          await link.click();
          target = await opened;
        } else await link.click();
        await target.waitForURL(base + path);
        const expected = path.endsWith('verify') ? 'Choose a PDF' : 'Email me a link';
        try {
          await target.getByRole('button', { name: expected }).waitFor({ timeout: 3500 });
          t.diagnostic([width, port, path, await target.locator('h1').innerText(), expected].join(' | '));
        } catch {
          failures.push([width, port, path, (await target.locator('body').innerText()).slice(0, 120), ...diagnostics].join(' | '));
        }
        if (target !== page) await target.close();
        diagnostics.length = 0;
      }
    }
    await page.close();
  }
  assert.deepEqual(failures, []);
});
