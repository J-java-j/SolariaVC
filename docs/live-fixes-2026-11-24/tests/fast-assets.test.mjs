// The instant-click page files (tools/make_fast.py) are the live files with exactly the listed
// edits, under names the site doesn't use yet. ORIG_DIST: the live build; FAST_DIST: the output.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const ORIG = process.env.ORIG_DIST, FAST = process.env.FAST_DIST;
const TOOL = new URL('../../tools/make_fast.py', import.meta.url).pathname;
const spec = JSON.parse(execFileSync('python3', ['-I', TOOL, '--print-edits'], { encoding: 'utf8' }));
const [OLD_STAFF, NEW_STAFF] = spec.staff, [OLD_PORTAL, NEW_PORTAL] = spec.portal;
const read = (root, file) => readFileSync(join(root, file), 'utf8');
const count = (text, part) => text.split(part).length - 1;
const FILES = ['staff.html', 'assets/' + NEW_STAFF, 'assets/' + NEW_PORTAL];

test('the new names are not used by any file of the live site', () => {
  for (const name of [NEW_STAFF, NEW_PORTAL]) assert.equal(existsSync(join(ORIG, 'assets', name)), false, name);
});

test('staff.html only points at the new entry file', () => {
  const page = read(FAST, 'staff.html');
  assert.equal(count(page, '/assets/' + NEW_STAFF), 1);
  assert.equal(page.replace('/assets/' + NEW_STAFF, '/assets/' + OLD_STAFF), read(ORIG, 'staff.html'));
});

test('the entry file only points at the new portal file (both places)', () => {
  const entry = read(FAST, 'assets/' + NEW_STAFF);
  assert.equal(count(entry, NEW_PORTAL), 2);
  assert.equal(entry.replaceAll(NEW_PORTAL, OLD_PORTAL), read(ORIG, 'assets/' + OLD_STAFF));
});

test('the portal file is the live one with exactly the listed edits', () => {
  let portal = read(FAST, 'assets/' + NEW_PORTAL);
  for (const [old, now] of [...spec.edits].reverse()) {
    assert.equal(count(portal, now), 1, now.slice(0, 70));
    portal = portal.replace(now, old);
  }
  assert.equal(portal, read(ORIG, 'assets/' + OLD_PORTAL));
});

test('the recovery link opens the recovery page; the other three email links stay', () => {
  const portal = read(FAST, 'assets/' + NEW_PORTAL);
  assert.equal(count(read(ORIG, 'assets/' + OLD_PORTAL), 'mailto:'), 4);
  assert.equal(count(portal, 'mailto:'), 3);
  assert.equal(count(portal, 'href:"/staff?recover=1",children:"Request password recovery"'), 1);
});

test('the recovery page says "Requesting…" while it sends, not "Requesting?"', () => {
  const portal = read(FAST, 'assets/' + NEW_PORTAL);
  assert.equal(count(read(ORIG, 'assets/' + OLD_PORTAL), '"Requesting?"'), 1);
  assert.equal(count(portal, '"Requesting?"'), 0);
  assert.equal(count(portal, '"Requesting\u2026"'), 1);
  assert.equal(count(portal, '"Signing in\u2026"'), 1);          // written the way the page's other labels are
});

test('both scripts parse as modules', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fast-check-'));
  try {
    for (const file of FILES.slice(1)) {
      const copy = join(dir, file.split('/').pop().replace(/\.js$/, '.mjs'));
      writeFileSync(copy, read(FAST, file));
      execFileSync(process.execPath, ['--check', copy]);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the files are readable by everyone, as the live ones are', () => {
  for (const file of FILES) assert.equal(statSync(join(FAST, file)).mode & 0o777, 0o644, file);
});
