// Solaria Sign's "Sign all" page in a real Chrome (headless, throwaway profile), against the real server on this
// Mac with a throwaway store and two test documents like the member paperwork (blanks and a signature).
//   APP=<folder holding server/, node_modules/ and dist/> node signall-browser.mjs
// A person types a long answer into a blank: all of it must stay in view in the box as it is typed, and the
// marked space on the document must show all of it (smaller or wrapped), as it will print. Then they sign both.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const APP = process.env.APP;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const LONG = 'Senior Portfolio Analyst at Northwind Research Partners, covering semiconductors and industrial automation since 2019';
const ADDRESS = '4500 Example Canyon Road, Building C, Suite 210, La Jolla, California 92037';

// ---- the server and its documents --------------------------------------------------------------
const dataDir = mkdtempSync(join(tmpdir(), 'sign-all-data-')) + '/';
const port = 5300 + Math.floor(Math.random() * 300), base = `http://127.0.0.1:${port}`;
const { PDFDocument, StandardFonts } = createRequire(join(APP, 'package.json'))('pdf-lib');
const { createSignService } = await import(pathToFileURL(join(APP, 'server/sign/envelopes.js')));
const { createLocalStore } = await import(pathToFileURL(join(APP, 'server/sign/store-local.js')));
const SENDER = { email: 'johnsonjiang@solariavc.com', name: 'Johnson Jiang' }, INFO = { ip: '203.0.113.7', ua: 'test' };
const mailed = [];
const svc = createSignService({ store: createLocalStore(dataDir), config: { baseUrl: base, tsaUrls: [] },
  mail: async m => { mailed.push(m); return 'm' + mailed.length; }, log: { error() {}, log() {} } });
const fy = pts => 1 - pts / 792;
const blank = (label, x, top, w) => ({ recipientId: 'a', type: 'text', page: 1, x: x / 612, y: fy(top), w: w / 612, h: 16 / 792, required: true, label });
const signature = top => ({ recipientId: 'a', type: 'signature', page: 1, x: 130 / 612, y: fy(top), w: 190 / 612, h: 30 / 792 });
async function make(title, lines, fields) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([612, 792]);
  page.drawText(title + ' (test copy)', { x: 72, y: 700, size: 13, font });
  for (const [text, y] of lines) page.drawText(text, { x: 72, y, size: 11, font });
  const made = await svc.createDraft(SENDER, title + '.pdf', Buffer.from(await doc.save()), INFO);
  await svc.updateDraft(made.id, { title: title + ' (test copy)', message: 'Please fill in and sign.', sequential: false, expiryDays: 30,
    recipients: [{ id: 'a', name: 'Bea Member', email: 'bea@example.test' }], fields });
  await svc.send(made.id, SENDER, INFO);
  return made.id;
}
const ids = [
  await make('LLC Investment Fund Sign-Up Form', [['Full legal name: ____________________________', 650], ['Mailing address: ______________________________________________', 620],
    ['Occupation and employer: ____________________________________', 590], ['Signature: ____________________________', 480]],
    [blank('Full legal name', 160, 662, 200), blank('Mailing address', 158, 632, 300), blank('Occupation and employer', 200, 602, 250), signature(502)]),
  await make('LLC Member Investment Agreement', [['Member name: ______________________________', 650], ['Signature: ____________________________', 540]],
    [blank('Member name', 146, 662, 200), signature(562)]),
];
const code = /\/sign#(\S+)/.exec(mailed[0].text)[1];

const server = spawn(process.execPath, ['server/index.js'], { cwd: APP, stdio: 'ignore',
  env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: 'production', PORT: String(port), SIGN_DATA_DIR: dataDir, SIGN_BASE_URL: base, SIGN_TSA_URLS: '' } });
const cdp = 9800 + Math.floor(Math.random() * 150), profile = mkdtempSync(join(tmpdir(), 'sign-all-ui-'));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1',
  '--window-size=1280,900', `--remote-debugging-port=${cdp}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', detached: true });
chrome.on('error', () => {});
process.on('exit', () => {
  try { server.kill('SIGKILL'); } catch {}
  try { process.kill(-chrome.pid, 'SIGKILL'); } catch { try { chrome.kill('SIGKILL'); } catch {} }
  for (const dir of [profile, dataDir]) try { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch {}
});
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => process.exit(130));
for (let i = 0; i < 60; i++) { await sleep(150); try { if ((await fetch(base + '/healthz')).ok) break; } catch {} }
let target;
for (let i = 0; i < 60 && !target; i++) {
  await sleep(200);
  try { target = (await (await fetch(`http://127.0.0.1:${cdp}/json`)).json()).find(t => t.type === 'page'); } catch {}
}
if (!target) { console.error("Chrome didn't start: " + CHROME); process.exit(2); }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let id = 0;
const waiting = new Map(), outside = new Set(), errors = [];
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
  if (m.method === 'Network.requestWillBeSent') { const u = new URL(m.params.request.url); if (u.hostname !== '127.0.0.1' && u.protocol.startsWith('http')) outside.add(u.hostname); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails?.exception?.description?.split('\n')[0] || 'error');
});
const send = (method, params = {}) => new Promise(r => { const n = ++id; waiting.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const evaluate = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;
const until = async (expression, ms = 10000) => {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(60)) { try { if (await evaluate(expression)) return true; } catch {} }
  return false;
};
const button = text => `[...document.querySelectorAll('button')].find(b => b.innerText.trim().startsWith(${JSON.stringify(text)}))`;
const has = text => `Boolean(${button(text)})`;
const click = text => evaluate(`${button(text)}?.click(), true`);
// The box for the blank with this label, and the marked space on the document with the same number.
const BOX = label => `[...document.querySelectorAll('.queue-answer')].find(l => l.innerText.includes(${JSON.stringify(label)}))?.querySelector('input, textarea')`;
const typeInto = async (label, text) => {
  await evaluate(`(() => { const box = ${BOX(label)}; box.focus(); box.select(); })()`);
  await send('Input.insertText', { text });
  await sleep(250);
};
const measure = label => evaluate(`(() => {
  const row = [...document.querySelectorAll('.queue-answer')].find(l => l.innerText.includes(${JSON.stringify(label)}));
  const box = row.querySelector('input, textarea'), number = row.querySelector('.queue-num').innerText.trim();
  const spot = [...document.querySelectorAll('[data-answer]')].find(s => s.querySelector('.queue-num')?.innerText.trim() === number);
  const r = box.getBoundingClientRect();
  // What is drawn in the marked space: every piece of its text (not the number badge) must lie inside the space,
  // and inside whatever clips it. Measured on the text itself, not on line boxes.
  const edge = spot.getBoundingClientRect();
  const pieces = [];
  const walker = document.createTreeWalker(spot, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement.closest('.queue-num') || !node.textContent.trim()) continue;
    const range = document.createRange(); range.selectNodeContents(node);
    for (const rect of range.getClientRects()) pieces.push({ rect, size: parseFloat(getComputedStyle(node.parentElement).fontSize), text: node.textContent });
  }
  const outside = pieces.filter(({ rect }) => rect.left < edge.left - 1.5 || rect.right > edge.right + 1.5 ||
    (rect.top + rect.bottom) / 2 < edge.top - 1 || (rect.top + rect.bottom) / 2 > edge.bottom + 1);
  return { tag: box.tagName, value: box.value, boxClipped: box.scrollWidth > box.clientWidth + 1 || box.scrollHeight > box.clientHeight + 1,
    boxHeight: Math.round(r.height), boxRight: Math.round(r.right), boxWidth: Math.round(r.width),
    spot: Boolean(spot), spotClipped: outside.length > 0, spotSize: Math.round(edge.width) + '×' + Math.round(edge.height),
    spotText: [...new Set(pieces.map(p => p.text))].join(' ').replace(/\\s+/g, ' ').trim(),
    spotFont: pieces.length ? Math.min(...pieces.map(p => p.size)) : 0 };
})()`);

await send('Network.enable'); await send('Runtime.enable'); await send('Page.enable');
await send('Page.navigate', { url: `${base}/sign#${code}` });
check('the signer\'s page opens from the emailed link', await until(has('Continue')));
await click('Continue');
check('both documents can be signed together', await until(has('Sign all 2')));
await click('Sign all 2');
check('the Sign all page shows the first document and its blanks', await until(`document.querySelectorAll('.queue-answer').length >= 1 && Boolean(document.querySelector('[data-answer]'))`, 15000));
const first = await evaluate(`document.querySelector('.queue h1')?.innerText`);
const LABEL = first.includes('Sign-Up') ? 'Occupation and employer' : 'Member name';

await typeInto(LABEL, LONG);
let m = await measure(LABEL);
check('a long answer stays whole in its box as it is typed', m.value === LONG && !m.boxClipped, `${m.tag.toLowerCase()} ${m.boxWidth}×${m.boxHeight}, ${m.boxClipped ? 'part of it out of sight' : 'all in view'}`);
check('the marked space on the document shows the whole answer', m.spot && !m.spotClipped && m.spotText === LONG, m.spotClipped ? `cut off at the edge of the space (${m.spotSize})` : `${m.spotFont.toFixed(1)}px in ${m.spotSize}`);
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
await sleep(150);
m = await measure(LABEL);
check('Enter adds no line break to an answer', m.value === LONG);
await typeInto(LABEL, 'Analyst');
m = await measure(LABEL);
check('a short answer keeps a small box', m.value === 'Analyst' && !m.boxClipped && m.boxHeight <= 60, `${m.boxHeight}px high`);
check('and shows at a normal size in its space', !m.spotClipped && m.spotText === 'Analyst' && m.spotFont >= 9, `${m.spotFont.toFixed(1)}px in ${m.spotSize}${m.spotClipped ? ', cut off' : ''}`);

// A phone: nothing runs off the side, and the long answer is still all in view.
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await sleep(500);
await typeInto(LABEL, LONG);
m = await measure(LABEL);
const page = await evaluate(`({ wide: document.documentElement.scrollWidth, view: innerWidth })`);
check('on a phone the long answer is all in view in its box', !m.boxClipped && m.boxRight <= page.view, `${m.boxWidth}×${m.boxHeight}`);
check('on a phone the page does not run off the side', page.wide <= page.view + 1, `${page.wide} of ${page.view}`);
check('on a phone the marked space still shows the whole answer', !m.spotClipped && m.spotText === LONG, `${m.spotFont.toFixed(1)}px in ${m.spotSize}${m.spotClipped ? ', cut off' : ''}${m.spotText === LONG ? '' : ', text: ' + m.spotText.slice(0, 60)}`);
await send('Emulation.clearDeviceMetricsOverride');
await sleep(300);

// Fill in the rest, adopt a typed signature and sign both documents.
const fill = async () => {
  for (const label of await evaluate(`[...document.querySelectorAll('.queue-answer')].map(l => l.innerText.split('·')[0].replace(/^\\d+\\s*/, '').trim())`)) {
    await typeInto(label, label === 'Mailing address' ? ADDRESS : label === LABEL || label === 'Occupation and employer' ? LONG : 'Bea Member');
  }
};
await fill();
await evaluate(`document.querySelector('.queue-check input').click()`);
await click('Adopt your signature');
await until(has('Type'));
await click('Type');
await sleep(200);
await click('Adopt and sign');
check('the first document can be finished once its blanks are filled', await until(`(() => { const b = ${button('Finish and sign')}; return b && !b.disabled; })()`, 15000));
await click('Finish and sign');
check('the first document is signed', await until(has('Next document'), 30000));
await click('Next document');
await until(`document.querySelector('.queue h1')?.innerText !== ${JSON.stringify(first)} && document.querySelectorAll('.queue-answer').length >= 1`, 15000);
await fill();
await until(`(() => { const b = ${button('Finish and sign')}; return b && !b.disabled; })()`, 15000);
await click('Finish and sign');
check('the second document is signed', await until(has('Done'), 30000));

const stored = [];
for (const envId of ids) {
  const env = await svc.getEnvelope(envId);
  stored.push({ status: env.status, values: Object.fromEntries(env.fields.filter(f => f.type === 'text').map(f => [f.label, f.value])) });
}
check('both documents are completed', stored.every(s => s.status === 'completed'), stored.map(s => s.status).join(', '));
const form = stored.find(s => 'Mailing address' in s.values).values;
const exact = form['Occupation and employer'] === LONG && form['Mailing address'] === ADDRESS && form['Full legal name'] === 'Bea Member';
check('the long answers are stored exactly as typed', exact, exact ? '' : JSON.stringify(form));
check('no script errors on the page', errors.length === 0, errors.slice(0, 2).join(' | '));
check('nothing was asked of any address outside this Mac', outside.size === 0, [...outside].join(', '));
const failed = results.filter(ok => !ok).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
