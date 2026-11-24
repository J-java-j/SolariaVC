const assert = require('node:assert/strict');
const { chromium } = require('../staff-service/node_modules/playwright-core');

async function main() {
  const origin = process.argv[2];
  const host = new URL(origin).hostname;
  assert.ok(host === 'solariavc.com' || /^owner-(onboarding|recovery)---solariavc-[a-z0-9-]+\.a\.run\.app$/.test(host));
  const browser = await chromium.launch({ channel: 'chrome' });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(30000);
    const home = await page.goto(origin);
    assert.equal(home.status(), 200);
    await page.getByRole('link', { name: /staff login|team login/i }).first().waitFor({state:'attached'});
    await page.goto(origin + '/staff');
    await page.getByLabel('Email', { exact: true }).waitFor();
    await page.getByLabel('Password', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'Request password recovery' }).getAttribute('href'), '/staff?recover=1');
    const api = await page.request.get(origin + '/staff/local-api/me');
    assert.equal(api.status(), 401);
    for (const entry of ['terminal', 'terminal-admin']) {
      const res = await page.request.get(origin + '/staff/launch/' + entry, {maxRedirects:0});
      assert.equal(res.status(), 303);
      assert.equal(res.headers().location, '/staff?launch=' + entry);
    }
    console.log('PASS homepage, footer entry, Team Login form, signed-out API, both protected shortcuts');
    if (process.argv.includes('--terminal-live')) {
      assert.equal(origin, 'https://solariavc.com');
      for (const [path, destination] of [['/', 'terminal'], ['/admin', 'terminal-admin']]) {
        const clean = await browser.newContext();
        try {
          const direct = await clean.newPage();
          await direct.goto('https://terminal.solariavc.com' + path);
          await direct.waitForURL(origin + '/staff?launch=' + destination);
          await direct.getByLabel('Email', {exact:true}).waitFor();
          await direct.getByRole('button', {name:'Sign in', exact:true}).waitFor();
          console.log('PASS fresh browser direct', path, 'resumes as', destination);
        } finally { await clean.close(); }
      }
    }
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
