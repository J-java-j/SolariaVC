// The sign-in page's built files: the "Request password recovery" link must open the
// portal's own recovery page, under new file names (browsers keep /assets/* for a year).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ORIG = process.env.ORIG_DIST;          // the live image's dist folder, as downloaded
const NEW = new URL('../dist/', import.meta.url).pathname;
const OLD_STAFF = 'staff-D8cCkydr.js', NEW_STAFF = 'staff-RcvLnk01.js';
const OLD_PORTAL = 'ConnectedPortal-XbvD2RiI.js', NEW_PORTAL = 'ConnectedPortal-RcvLnk01.js';
const MAIL = 'href:"mailto:contact@solariavc.com?subject=Team%20Portal%20password%20recovery",children:"Request password recovery"';
const PAGE = 'href:"/staff?recover=1",children:"Request password recovery"';

const read = (root, rel) => readFileSync(join(root, rel), 'utf8');
const count = (text, part) => text.split(part).length - 1;
function files(root, rel = '') {
  return readdirSync(join(root, rel), { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? files(root, join(rel, entry.name)) : [join(rel, entry.name)]);
}

test('only staff.html and the staff chunk name the two chunks being renamed', () => {
  assert.ok(ORIG && existsSync(join(ORIG, 'staff.html')), 'set ORIG_DIST to the downloaded dist folder');
  const hits = {};
  for (const rel of files(ORIG)) {
    const text = readFileSync(join(ORIG, rel), 'latin1');
    for (const name of [OLD_STAFF, OLD_PORTAL]) {
      const n = count(text, name);
      if (n) hits[rel + ' -> ' + name] = n;
    }
  }
  assert.deepEqual(hits, {
    'staff.html -> staff-D8cCkydr.js': 1,
    'assets/staff-D8cCkydr.js -> ConnectedPortal-XbvD2RiI.js': 2,
  });
});

test('the new names are not already taken', () => {
  for (const name of [NEW_STAFF, NEW_PORTAL]) assert.equal(existsSync(join(ORIG, 'assets', name)), false);
});

test('staff.html loads the new staff chunk and is otherwise byte for byte the same', () => {
  const before = read(ORIG, 'staff.html'), after = read(NEW, 'staff.html');
  assert.equal(count(before, '/assets/' + OLD_STAFF), 1);
  assert.equal(count(after, '/assets/' + NEW_STAFF), 1);
  assert.equal(count(after, OLD_STAFF), 0);
  assert.equal(after.replace('/assets/' + NEW_STAFF, '/assets/' + OLD_STAFF), before);
});

test('the new staff chunk loads the new portal chunk and is otherwise the same', () => {
  const before = read(ORIG, 'assets/' + OLD_STAFF), after = read(NEW, 'assets/' + NEW_STAFF);
  assert.equal(count(before, OLD_PORTAL), 2);
  assert.equal(count(after, NEW_PORTAL), 2);
  assert.equal(count(after, OLD_PORTAL), 0);
  assert.equal(after.replaceAll(NEW_PORTAL, OLD_PORTAL), before);
});

test('the sign-in link opens the recovery page; the three other mail links are untouched', () => {
  const before = read(ORIG, 'assets/' + OLD_PORTAL), after = read(NEW, 'assets/' + NEW_PORTAL);
  assert.equal(count(before, MAIL), 1);
  assert.equal(count(after, MAIL), 0);
  assert.equal(count(after, PAGE), 1);
  assert.equal(count(before, 'mailto:'), 4);
  assert.equal(count(after, 'mailto:'), 3);
  assert.equal(after.replace(PAGE, MAIL), before);
});

test('the page the link opens is in the same bundle', () => {
  const after = read(NEW, 'assets/' + NEW_PORTAL);
  assert.ok(after.includes('new URLSearchParams(location.search).get("recover")==="1"'));
  assert.ok(after.includes('E("/recovery","POST",{email:r})'));
});

test('the new files are readable by everyone', () => {
  for (const rel of ['staff.html', 'assets/' + NEW_STAFF, 'assets/' + NEW_PORTAL]) {
    assert.equal(statSync(join(NEW, rel)).mode & 0o444, 0o444, rel);
  }
});
