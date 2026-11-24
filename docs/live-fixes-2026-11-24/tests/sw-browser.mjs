// dist/service-worker.js in a real Chrome (headless, throwaway profile), against a local server
// that answers /service-worker.js the way solariavc.com does: today a web page (its fallback to
// index.html), after the fix this file. Run: node tests/sw-browser.mjs
//   1. An "old site" worker of the worst kind installs: once it has saved a page, it never asks
//      the website for it again.
//   2. The fault: the site changes, the page stays the saved copy, and the worker can't update.
//   3. The fix: one more visit, and the page reloads itself from the website; the worker and its
//      saved copies are gone, and the browser stops asking for /service-worker.js.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FIX = readFileSync(new URL('../dist/service-worker.js', import.meta.url), 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok || !detail ? '' : ' — ' + detail}`); };

const OLD = `
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.open('old-site').then(async (box) => {
    const hit = await box.match(e.request);
    if (hit) return hit;
    const res = await fetch(e.request);
    if (res.ok) await box.put(e.request, res.clone());
    return res;
  }));
});`;

let version = 1;
let worker = OLD;   // what /service-worker.js answers: OLD, null (a web page, as the site does today) or FIX
const seen = [];
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  seen.push(url.pathname);
  if (url.pathname === '/service-worker.js') {
    if (worker === null) res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }).end('<!doctype html><title>Solaria Capital</title>');
    else res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-cache' }).end(worker);
    return;
  }
  if (url.pathname === '/staff') {
    const register = url.searchParams.has('register') ? "<script>navigator.serviceWorker.register('/service-worker.js')</script>" : '';
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' })
      .end(`<!doctype html><meta charset="utf-8"><title>v${version}</title><p id="v">${version}</p>${register}`);
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not Found');
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const port = 9800 + Math.floor(Math.random() * 150), profile = mkdtempSync(join(tmpdir(), 'sw-fix-'));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', detached: true });
chrome.on('error', () => {});
process.on('exit', () => {
  try { process.kill(-chrome.pid, 'SIGKILL'); } catch { chrome.kill('SIGKILL'); }
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch {}
});
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => process.exit(130));
let target;
for (let i = 0; i < 60 && !target; i++) {
  await sleep(200);
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page'); } catch {}
}
if (!target) { console.error("Chrome didn't start: " + CHROME); process.exit(2); }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let id = 0;
const waiting = new Map();
ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); } });
const send = (method, params = {}) => new Promise(r => { const n = ++id; waiting.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const evaluate = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;
const go = async path => { await send('Page.navigate', { url: base + path }); await sleep(700); };
const until = async (expression, ms = 20000) => {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(250)) { try { if (await evaluate(expression)) return true; } catch {} }
  return false;
};
const shown = () => evaluate('document.getElementById("v")?.textContent');
const count = (path, from = 0) => seen.slice(from).filter(p => p === path).length;
await send('Page.enable');
await send('Runtime.enable');

// 1. the old site's worker
await go('/staff?register=1');
check("the old site's worker installs and takes over the page", await until('navigator.serviceWorker.controller !== null'));
await go('/staff');
check('it saves version 1 of the page', await until('document.getElementById("v")?.textContent === "1"'));

// 2. the fault, with /service-worker.js answered the way solariavc.com answers it today
version = 2; worker = null;
let mark = seen.length;
await go('/staff');
await sleep(2500);
check('the fault: the site now has version 2, but the page still shows the saved version 1', (await shown()) === '1' && count('/staff', mark) === 0, `shown ${await shown()}, website asked ${count('/staff', mark)}×`);
check('the browser asks /service-worker.js for an update and gets a web page', count('/service-worker.js', mark) >= 1);
check('so the old worker stays installed', (await evaluate('navigator.serviceWorker.getRegistrations().then(r => r.length)')) === 1);

// 3. the fix
worker = FIX;
mark = seen.length;
await go('/staff');
check('on the next visit the browser takes the fix, which reloads the page from the website: version 2', await until('document.getElementById("v")?.textContent === "2"'), `shown ${await shown()}`);
check('the website was asked for the page again', count('/staff', mark) >= 1);
check('no service worker is left', await until('navigator.serviceWorker.getRegistrations().then(r => r.length === 0)', 5000));
check('no saved copies are left', await until('caches.keys().then(k => k.length === 0)', 5000));

// 4. afterwards
version = 3;
mark = seen.length;
await go('/staff');
await sleep(2500);
check('later visits come straight from the website (version 3)', (await shown()) === '3' && count('/staff', mark) === 1, `shown ${await shown()}`);
check('and the browser no longer asks for /service-worker.js', count('/service-worker.js', mark) === 0);

const failed = results.filter(ok => !ok).length;
console.log(failed ? `${failed} of ${results.length} failed` : `all ${results.length} passed`);
ws.close(); server.close();
process.exit(failed ? 1 : 0);
