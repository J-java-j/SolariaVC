// Render a page of the site in headless Chrome and print what a search engine that runs scripts would read:
// title, description, headings, text length, images and links. Usage: node render.mjs URL [--html]
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const url = process.argv[2];
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const port = 9300 + Math.floor(Math.random() * 300), profile = mkdtempSync(join(tmpdir(), 'seo-'));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1',
  '--window-size=1280,900', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', detached: true });
process.on('exit', () => { try { process.kill(-chrome.pid, 'SIGKILL'); } catch {} try { rmSync(profile, { recursive: true, force: true }); } catch {} });
let target;
for (let i = 0; i < 60 && !target; i++) { await sleep(200); try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page'); } catch {} }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let id = 0; const waiting = new Map();
ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); } });
const send = (method, params = {}) => new Promise(r => { const n = ++id; waiting.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const evaluate = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;
await send('Page.enable');
await send('Page.navigate', { url });
await sleep(3500);
const out = await evaluate(`(() => {
  const meta = n => document.querySelector('meta[name="' + n + '"], meta[property="' + n + '"]')?.content ?? null;
  const text = document.body.innerText.replace(/\\s+/g, ' ').trim();
  const heads = [...document.querySelectorAll('h1, h2, h3')].map(h => h.tagName + ': ' + h.innerText.replace(/\\s+/g, ' ').trim().slice(0, 90));
  const imgs = [...document.querySelectorAll('img')];
  const links = [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href'));
  return { title: document.title, description: meta('description'), canonical: document.querySelector('link[rel=canonical]')?.href ?? null, robots: meta('robots'),
    ogTitle: meta('og:title'), ogDescription: meta('og:description'), h1: document.querySelectorAll('h1').length, headings: heads.slice(0, 40), words: text.split(' ').length,
    firstWords: text.slice(0, 260), images: imgs.length, imagesWithoutAlt: imgs.filter(i => !i.getAttribute('alt')).length,
    internalLinks: [...new Set(links.filter(h => h.startsWith('/') || h.startsWith('#')))].slice(0, 30), externalLinks: [...new Set(links.filter(h => /^https?:/.test(h)))].slice(0, 20),
    jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')].length };
})()`);
console.log(JSON.stringify(out, null, 1));
process.exit(0);
