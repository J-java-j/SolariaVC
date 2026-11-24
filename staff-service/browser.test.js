// Exercises the running review stack with independent browser sessions. Only
// the uniquely named invitee is modified. Seeded identities stay as supplied.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { connectEmulator } from './provider.js';
import { fixturePassword } from './fixtures.js';

const entry = 'http://127.0.0.1:5173/staff?mode=connected';
const managed = entry + '&section=staff';
const boardList = entry + '&section=board-admins';
const button = (page, name) => page.getByRole('button', { name, exact: true });
const heading = (page, name) => page.getByRole('heading', { name, exact: true });
const nav = page => page.getByRole('navigation', { name: 'Solaria Team Portal' });
const roleTag = (page, role) => page.getByText(role + ' dashboard', { exact: true }).waitFor();

test('narrow roster keeps actions, dialog focus and role-change feedback in place', async t => {
  const browser = await chromium.launch({ channel: 'chrome' });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 360, height: 480 }, reducedMotion: 'reduce' });
  await page.goto('http://127.0.0.1:5173/staff?preview=owner&section=staff');
  const edit = button(page, 'Edit Noah Bennett');
  await edit.scrollIntoViewIfNeeded();
  const bounds = await edit.boundingBox();
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 360);
  const initialScroll = await page.evaluate(() => scrollY);
  await edit.click();
  const dialog = page.getByRole('dialog');
  const name = dialog.getByLabel('Name', { exact: true });
  assert.ok(await name.evaluate(el => el === document.activeElement));
  await page.keyboard.press('Escape');
  assert.ok(await edit.evaluate(el => el === document.activeElement));
  await edit.click();
  await dialog.getByLabel('Role', { exact: true }).selectOption('board-admin');
  await button(dialog, 'Save sample changes').click();
  await page.getByRole('status').filter({ hasText: 'Account moved to Manage Board Admins.' }).waitFor();
  assert.equal(await edit.count(), 0);
  // Chrome rounds fractional scroll positions when a table row disappears.
  assert.ok(Math.abs(await page.evaluate(() => scrollY) - initialScroll) <= 1, 'roster viewport stays in place');
  assert.ok(await page.getByRole('region', { name: 'Account table' }).evaluate(el => el === document.activeElement));
});

async function login(page, email, password = fixturePassword) {
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await button(page, 'Sign in').click();
}

async function signOut(page) {
  await page.locator('.portal-user-trigger').click();
  await button(page, 'Sign out').click();
  await button(page, 'Sign in').waitFor();
}

test('connected portal in Chrome, including cross-session access changes', { timeout: 120000 }, async t => {
  const provider = connectEmulator();
  const visit = randomUUID().slice(0, 8);
  const name = 'Portal Test ' + visit;
  const email = 'portal-' + visit + '@example.test';
  const password = 'Invitee-' + randomUUID();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  t.after(async () => {
    await browser.close();
    const invitee = await provider.auth.getUserByEmail(email).catch(error => {
      if (error.code !== 'auth/user-not-found') throw error;
    });
    if (invitee) await provider.auth.deleteUser(invitee.uid);
  });
  const errors = [];
  async function session(mobile = false) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    page.on('pageerror', err => errors.push(err.message));
    return page;
  }
  const staff = await session(true);
  await staff.goto('http://127.0.0.1:5173/');
  await staff.getByRole('link', { name: 'Team login', exact: true }).click();
  await login(staff, 'staff@example.test');
  await roleTag(staff, 'Staff');
  assert.equal(await nav(staff).getByRole('button').count(), 1);
  assert.equal(await staff.getByLabel('Development preview').count(), 0);
  assert.equal(new URL(staff.url()).pathname, '/staff');
  await staff.goto(boardList + '&preview=owner');
  await roleTag(staff, 'Staff');
  assert.equal(await nav(staff).getByRole('button').count(), 1);
  await staff.reload();
  await roleTag(staff, 'Staff');
  await signOut(staff);
  await staff.goto(managed);
  await button(staff, 'Sign in').waitFor();
  assert.equal(await nav(staff).count(), 0);
  t.diagnostic('Staff: mobile viewport, direct route guard, reload and sign-out');

  const board = await session();
  await board.goto('http://127.0.0.1:5173/');
  await board.getByRole('link', { name: 'Team login', exact: true }).click();
  await board.goto(managed);
  const seededBoard = await provider.auth.getUser('seed-board-admin');
  await login(board, seededBoard.disabled ? 'review-board@example.test' : seededBoard.email);
  await heading(board, 'Manage Staff').waitFor();
  await board.reload();
  await heading(board, 'Manage Staff').waitFor();
  assert.equal(await button(nav(board), 'Board Admins').count(), 0);
  await button(board, 'Add staff').click();
  await board.getByLabel('Name', { exact: true }).fill(name);
  await board.getByLabel('Email', { exact: true }).fill(email);
  await button(board, 'Send invitation').click();
  await board.getByText('Invitation created for ' + email + '.', { exact: false }).first().waitFor();
  const opened = board.waitForEvent('popup');
  await board.getByRole('link', { name: /Open local outbox/ }).click();
  const outbox = await opened;
  assert.equal(outbox.url(), 'http://127.0.0.1:5173/staff/outbox');
  const message = outbox.locator('p').filter({ hasText: email });
  const invite = await message.getByRole('link').getAttribute('href');
  await message.getByRole('link').click();
  await heading(outbox, 'Set your password').waitFor();
  await outbox.getByLabel('New password').fill(password);
  await outbox.getByLabel('Confirm password').fill(password + 'x');
  await button(outbox, 'Set password').click();
  await outbox.getByText('Passwords don’t match').waitFor();
  await outbox.getByLabel('Confirm password').fill(password);
  await button(outbox, 'Set password').click();
  await outbox.getByText('Your password is set.').waitFor();
  await button(outbox, 'Go to sign in').click();
  const member = outbox;
  await login(member, email, password);
  await roleTag(member, 'Staff');
  const reused = await session();
  await reused.goto(invite);
  await reused.getByText('This invitation has expired or has already been used.').waitFor();
  await reused.getByRole('link', { name: 'Request a new invitation' }).waitFor();
  // The emulator does not age its action codes. Exercise Firebase's expiry
  // response explicitly in addition to the real consumed-code check above.
  await reused.route('**/accounts:resetPassword?*', r => r.fulfill({ status: 400, contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: { message: 'EXPIRED_OOB_CODE' } }) }));
  await reused.reload();
  await reused.getByText('This invitation has expired or has already been used.').waitFor();
  await reused.close();
  await member.locator('.portal-user-trigger').click();
  await button(member, 'Settings').click();
  await member.getByLabel('Current password').fill('wrong-current-password');
  const changedPassword = password + 'New';
  await member.getByLabel('New password').fill(changedPassword);
  await member.getByLabel('Confirm password').fill(changedPassword + 'x');
  await button(member, 'Save password').click();
  await member.getByText('Passwords don’t match').waitFor();
  await member.getByLabel('Confirm password').fill(changedPassword);
  await button(member, 'Save password').click();
  await member.getByText(/Current password is incorrect/).waitFor();
  await member.getByLabel('Current password').fill(password);
  await button(member, 'Save password').click();
  await member.getByText('Your password has been changed.').waitFor();
  await signOut(member);
  await login(member, email, password);
  await member.getByText('Check your email and password.').waitFor();
  await login(member, email, changedPassword);
  await roleTag(member, 'Staff');
  // The invitee and inviter now share one browser cookie. End this browser session.
  await board.reload();
  await signOut(board);
  await member.reload();
  await login(member, email, changedPassword);
  t.diagnostic('Board Admin: direct navigation, invite, emulator outbox, recipient password setup and sign-in');

  const owner = await session();
  await owner.goto('http://127.0.0.1:5173/');
  await owner.getByRole('link', { name: 'Team login', exact: true }).click();
  await owner.goto(boardList);
  await login(owner, 'owner@example.test');
  await heading(owner, 'Manage Board Admins').waitFor();
  await button(nav(owner), 'Manage Staff').click();
  await button(owner, 'Edit ' + name).click();
  await owner.getByLabel('Role', { exact: true }).selectOption('board-admin');
  await button(owner, 'Save changes').click();
  await owner.getByText('Account moved to Manage Board Admins.').waitFor();
  await member.goto(managed);
  await heading(member, 'Manage Staff').waitFor();
  // Prepare a manager action before the Owner changes this open session's role.
  await member.getByRole('button', { name: /^Edit / }).first().click();
  await button(nav(owner), 'Board Admins').click();
  await button(owner, 'Edit ' + name).click();
  await owner.getByLabel('Role', { exact: true }).selectOption('staff');
  await button(owner, 'Save changes').click();
  await owner.getByText('Account moved to Manage Staff.').waitFor();
  const edit = member.waitForResponse(r => r.url().includes('/staff/local-api/accounts/') && r.request().method() === 'PATCH');
  await button(member, 'Save changes').click();
  assert.equal((await edit).status(), 403);
  await roleTag(member, 'Staff');
  assert.equal(await nav(member).getByRole('button').count(), 1);
  assert.equal((await member.request.get('http://127.0.0.1:5173/staff/launch/terminal-admin', { maxRedirects: 0 })).status(), 403);
  assert.equal(await member.getByRole('dialog').count(), 0);
  assert.equal(await member.getByRole('link', { name: 'Admin', exact: false }).count(), 0);
  t.diagnostic('Owner demotion: pending Board Admin edit received 403; same session showed Staff dashboard and lost admin controls');

  await button(nav(owner), 'Manage Staff').click();
  await button(owner, 'Deactivate ' + name).click();
  await button(owner.getByRole('dialog'), 'Deactivate').click();
  await owner.getByText('Account deactivated.').waitFor();
  const blocked = await member.context().newPage();
  await blocked.goto('http://127.0.0.1:5173/staff/launch/documents');
  await blocked.getByRole('heading', { name: 'Access denied' }).waitFor();
  await blocked.close();
  const profile = member.waitForResponse(r => r.url().endsWith('/staff/local-api/me'));
  await button(nav(member), 'Dashboard').click();
  assert.equal((await profile).status(), 403);
  await member.getByText('This account no longer has portal access.').waitFor();
  assert.equal(await nav(member).count(), 0);
  await member.reload();
  await button(member, 'Sign in').waitFor();
  await button(owner, 'Reactivate ' + name).click();
  await button(owner.getByRole('dialog'), 'Reactivate').click();
  await owner.getByText('Account reactivated.').waitFor();
  await login(member, email, changedPassword);
  await roleTag(member, 'Staff');
  t.diagnostic('Deactivation: next /me returned 403 and cleared the portal session; reactivation restored sign-in');
  await signOut(owner);

  await staff.goto('http://127.0.0.1:5173/staff?preview=owner');
  await staff.getByLabel('Development preview').selectOption('signin');
  await staff.getByLabel('Username').waitFor();
  for (const query of ['mode=connected&section=board-admins', 'preview=owner']) {
    await staff.goto('http://127.0.0.1:8080/staff?' + query);
    await heading(staff, 'Staff').waitFor();
    await staff.getByText(/Each tool has its own sign-in/).waitFor();
    assert.equal(await staff.getByLabel('Development preview').count(), 0);
    assert.equal(await button(staff, 'Sign in').count(), 0);
  }
  assert.deepEqual(errors, []);
  t.diagnostic('Mock switcher works separately. Both development queries render the launcher on the local production build.');
});
