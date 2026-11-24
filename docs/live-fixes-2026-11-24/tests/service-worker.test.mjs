// dist/service-worker.js replaces a service worker an older solariavc.com installed in some
// browsers. Run here with fake browser objects; tests/sw-browser.mjs runs it in a real Chrome.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const DIST = new URL('../dist/', import.meta.url);
const SOURCE = readFileSync(new URL('service-worker.js', DIST), 'utf8');

function load({ saved = ['old-pages', 'old-assets'], pages = ['https://solariavc.com/staff', 'https://solariavc.com/staff?section=staff'], keysFail = false, navigateFails = false } = {}) {
  const log = [];
  const listeners = {};
  const caches = {
    async keys() { if (keysFail) throw new Error('storage unavailable'); return [...saved]; },
    async delete(name) { log.push(['delete', name]); return true; },
  };
  const windows = pages.map(url => ({
    url,
    async navigate(to) { log.push(['navigate', to]); if (navigateFails) throw new TypeError('not controlled'); return this; },
  }));
  const self = {
    addEventListener(type, fn) { listeners[type] = fn; },
    skipWaiting() { log.push(['skipWaiting']); return Promise.resolve(); },
    registration: { async unregister() { log.push(['unregister']); return true; } },
    clients: { async matchAll(options) { log.push(['matchAll', JSON.stringify(options)]); return windows; } },
  };
  vm.runInNewContext(SOURCE, { self, caches, Promise });
  return { listeners, log };
}

async function activate(sw) {
  let work;
  sw.listeners.activate({ waitUntil(promise) { work = promise; } });
  assert.ok(work, 'activation hands its work to waitUntil, so the browser keeps the worker alive for it');
  await work;
}

test('it takes over at once, without waiting for every open tab to close', () => {
  const sw = load();
  sw.listeners.install({ waitUntil() {} });
  assert.deepEqual(sw.log, [['skipWaiting']]);
});

test('it deletes every saved copy, removes itself, then reloads each open page from the website', async () => {
  const sw = load();
  await activate(sw);
  assert.deepEqual(sw.log, [
    ['delete', 'old-pages'], ['delete', 'old-assets'],
    ['unregister'],
    ['matchAll', '{"type":"window"}'],
    ['navigate', 'https://solariavc.com/staff'],
    ['navigate', 'https://solariavc.com/staff?section=staff'],
  ]);
});

test('it still removes itself and reloads the pages when the saved copies cannot be read', async () => {
  const sw = load({ keysFail: true });
  await activate(sw);
  assert.deepEqual(sw.log.map(entry => entry[0]), ['unregister', 'matchAll', 'navigate', 'navigate']);
});

test('a page that refuses to reload does not stop the others', async () => {
  const sw = load({ navigateFails: true });
  await activate(sw);   // must not reject
  assert.equal(sw.log.filter(entry => entry[0] === 'navigate').length, 2);
});

test('it answers no requests itself, so nothing can come from a saved copy again', () => {
  const sw = load();
  assert.deepEqual(Object.keys(sw.listeners).sort(), ['activate', 'install']);
});

// If any page registered /service-worker.js again, every visit would register, remove and
// reload in a loop. No page of the site may register a service worker.
test('no page or script of the site registers a service worker', () => {
  const root = process.env.ORIG_DIST;
  assert.ok(root, 'ORIG_DIST must point at the full built site');
  const hits = [];
  const walk = dir => {
    for (const name of readdirSync(dir)) {
      const file = join(dir, name);
      if (statSync(file).isDirectory()) walk(file);
      else if (/\.(html|js|mjs)$/.test(name) && /serviceWorker\s*\.\s*register|serviceWorker\[/.test(readFileSync(file, 'utf8'))) hits.push(file);
    }
  };
  walk(root);
  walk(new URL('.', DIST).pathname);
  assert.deepEqual(hits, []);
});
