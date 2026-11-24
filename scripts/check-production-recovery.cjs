const assert = require('node:assert/strict');
const { chromium } = require('../staff-service/node_modules/playwright-core');

async function main() {
  const origin = process.argv[2];
  const live = origin === 'https://solariavc.com';
  assert.ok(live || /^https:\/\/owner-recovery---solariavc-[a-z0-9-]+\.a\.run\.app$/.test(origin));
  const browser = await chromium.launch({ channel: 'chrome' });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    if (!live) {
      // Tagged URLs cannot use the official site's restricted Firebase key.
      await page.route('https://identitytoolkit.googleapis.com/**', route => route.fulfill({
        status: 400, contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'EXPIRED_OOB_CODE' } }),
      }));
    }
    await page.goto(origin + '/staff#invite=expired-recovery-smoke');
    await page.getByRole('alert').filter({hasText: /expired or has already been used/i}).waitFor();
    const link = page.getByRole('link', {name:'Request a new invitation'});
    assert.equal(await link.getAttribute('target'), '_blank');
    const tab = page.waitForEvent('popup');
    await link.click();
    const recovery = await tab;
    await recovery.waitForURL(origin + '/staff?recover=1');
    await recovery.getByRole('heading', {name:'Recover your Team Login'}).waitFor();
    await page.getByRole('heading', {name:'Set your password'}).waitFor();
    console.log('PASS expired/invalid invitation opens recovery in a separate tab');
    await recovery.getByText('Enter a setup code from your email', {exact:true}).click();
    await recovery.getByLabel('Private setup code').fill('invalid-private-code-example');
    await recovery.getByRole('button', {name:'Continue to password setup'}).click();
    await recovery.getByRole('heading', {name:'Set your password'}).waitFor();
    await recovery.goto(origin + '/staff?recover=1');
    console.log('PASS private code entry opens password setup without sending the code in the URL path or query');
  } finally { await browser.close(); }
}
main().catch(err => { console.error(err.message); process.exitCode = 1; });
