// The team portal page in a real Chrome (headless, throwaway profile), against a local stand-in
// for its API that answers as slowly as the live site did for Johnson (/me 0.30 s, the account
// list 0.45 s). Every address outside this Mac is blocked, so nothing leaves it.
//   node tests/portal-browser.mjs live   the page files live now (recovery-link fix, slow clicks)
//   node tests/portal-browser.mjs fast   the instant-click files
// Env: ORIG_DIST = the full live build; LIVE_DIST / FAST_DIST = the changed files laid over it.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';

const MODE = process.argv[2] === 'fast' ? 'fast' : 'live';
const ORIG = process.env.ORIG_DIST, OVER = MODE === 'fast' ? process.env.FAST_DIST : process.env.LIVE_DIST;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };

// ---- the stand-in API: fictional people only --------------------------------------------
const person = (uid, displayName, role) => ({ uid, displayName, email: uid + '@example.test', role, active: true });
const people = { 'u-owner': person('u-owner', 'Olive Owner', 'owner'), 'u-owner2': person('u-owner2', 'Oscar Other', 'owner'), 'u-staff': person('u-staff', 'Sam Staff', 'staff') };
const rosters = {
  'u-owner': [people['u-owner'], person('b1', 'Bea Board', 'board-admin'), person('b2', 'Ben Board', 'board-admin'), person('s1', 'Stella Staff', 'staff'), person('s2', 'Sid Staff', 'staff')],
  'u-owner2': [people['u-owner2'], person('z1', 'Zara Zed', 'staff')],
};
const delay = { me: 300, accounts: 450, 'accounts:u-owner2': 2000 };
let me = 'u-owner';
const seen = [];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };
const json = (res, status, body) => res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }).end(JSON.stringify(body));
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  seen.push(req.method + ' ' + url.pathname + url.search);
  const api = url.pathname.replace(/^\/staff\/local-api/, '');
  if (api !== url.pathname) {
    if (api === '/me' && req.method === 'GET') { await sleep(delay.me); return me ? json(res, 200, people[me]) : json(res, 401, { error: 'Team login required.' }); }
    if (api === '/accounts' && req.method === 'GET') {
      await sleep(delay['accounts:' + me] ?? delay.accounts);
      if (!me) return json(res, 401, { error: 'Team login required.' });
      if (people[me].role === 'staff') return json(res, 403, { error: 'Access denied.' });
      return json(res, 200, { accounts: rosters[me] });
    }
    if (api === '/session' && req.method === 'DELETE') { me = null; return json(res, 200, {}); }
    return json(res, 404, { error: 'Not found.' });
  }
  let file = url.pathname === '/staff' ? '/staff.html' : normalize(url.pathname);
  const local = [OVER, ORIG].map(root => join(root, file)).find(p => existsSync(p) && !p.endsWith('/'));
  if (!local || file.includes('..')) return res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not Found');
  res.writeHead(200, { 'Content-Type': TYPES[extname(local)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }).end(readFileSync(local));
});
const SERVE = process.argv[3] === '--serve' ? Number(process.argv[4]) : 0;   // only the stand-in, for tests/wk_page.swift
await new Promise(r => server.listen(SERVE, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
if (SERVE) { console.log('serving ' + base + '/staff'); await new Promise(() => {}); }

// ---- Chrome -------------------------------------------------------------------------------
const port = 9600 + Math.floor(Math.random() * 150), profile = mkdtempSync(join(tmpdir(), 'portal-ui-'));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1',
  '--window-size=1280,900', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', detached: true });
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
const waiting = new Map(), outside = new Set(), errors = [];
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
  if (m.method === 'Network.requestWillBeSent') { const u = new URL(m.params.request.url); if (u.hostname !== '127.0.0.1' && u.protocol.startsWith('http')) outside.add(u.hostname); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails?.exception?.description?.split('\n')[0] || 'error');
});
const send = (method, params = {}) => new Promise(r => { const n = ++id; waiting.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const evaluate = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;
const until = async (expression, ms = 8000) => {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(50)) { try { if (await evaluate(expression)) return true; } catch {} }
  return false;
};
// Click, then measure in the page how long until the condition holds (-1: not within the limit).
const timed = (click, condition, limit = 6000) => evaluate(`new Promise(done => {
  const ok = () => { try { return Boolean(${condition}); } catch { return false; } };
  const t0 = performance.now();
  (${click})();
  const poll = () => ok() ? done(Math.round(performance.now() - t0)) : performance.now() - t0 > ${limit} ? done(-1) : setTimeout(poll, 5);
  poll();
})`);
const nav = label => `() => [...document.querySelectorAll('.portal-nav button')].find(b => b.textContent.trim() === ${JSON.stringify(label)}).click()`;
const main = text => `document.querySelector('#portal-main')?.innerText.includes(${JSON.stringify(text)})`;
const title = start => `document.title.startsWith(${JSON.stringify(start)})`;
const accountsAsked = () => seen.filter(s => s === 'GET /staff/local-api/accounts').length;
await send('Network.enable');
await send('Runtime.enable');
await send('Page.enable');

console.log(`-- ${MODE}: the page files ${MODE === 'fast' ? 'with instant clicks' : 'live now'}`);
await send('Page.navigate', { url: base + '/staff' });
check('the owner\'s dashboard opens', await until(`document.querySelector('.portal-nav') && ${title('Owner dashboard')}`));
await sleep(1500);   // a person reads the dashboard for a moment

const INSTANT = 150;   // ms: no visible wait
const staff = await timed(nav('Manage Staff'), `${main('Stella Staff')} && ${title('Manage Staff')}`);
check(`Manage Staff shows its list at once (${staff} ms)`, staff >= 0 && staff < INSTANT);
const boards = await timed(nav('Board Admins'), `${main('Bea Board')} && ${title('Manage Board Admins')}`);
check(`Board Admins shows its list at once (${boards} ms)`, boards >= 0 && boards < INSTANT);
const dash = await timed(nav('Dashboard'), `${main('Administration')} && !${main('Bea Board')} && ${title('Owner dashboard')}`);
check(`Dashboard comes back at once (${dash} ms)`, dash >= 0 && dash < INSTANT);
const viaCard = await timed(`() => [...document.querySelectorAll('.portal-admin-grid button')].find(b => b.textContent.includes('Manage Board Admins')).click()`, `${main('Bea Board')} && ${title('Manage Board Admins')}`);
check(`the dashboard's Manage Board Admins card opens at once (${viaCard} ms)`, viaCard >= 0 && viaCard < INSTANT);

// A change made elsewhere shows up on its own after the page has switched.
rosters['u-owner'][3] = { ...rosters['u-owner'][3], displayName: 'Stella Renamed' };
const fresh = await timed(nav('Manage Staff'), main('Stella Renamed'));
check(`a change made elsewhere shows up on its own (${fresh} ms)`, fresh >= 0 && fresh < 2500);

// Someone else in the same tab: the first person's list must never show for them.
await timed(nav('Dashboard'), title('Owner dashboard'));
me = 'u-owner2';
await evaluate(`window.dispatchEvent(new Event('focus')), 1`);
check('the page notices the other person', await until(`document.querySelector('.portal-user-name')?.textContent.includes('Oscar Other')`));
const leaked = await evaluate(`new Promise(done => { let saw = false; const t0 = performance.now(); (${nav('Manage Staff')})();
  const poll = () => { if (${main('Stella')}) saw = true; performance.now() - t0 > 800 ? done(saw) : setTimeout(poll, 5); }; poll(); })`);
check('the first person\'s list never shows for the second', leaked === false);
check('the second person\'s own list arrives', await until(main('Zara Zed')));

// A staff member has no management pages: nothing loads the account list for them.
me = 'u-staff';
let mark = accountsAsked();
await evaluate(`window.dispatchEvent(new Event('focus')), 1`);
check('a staff member gets the dashboard', await until(`document.querySelector('.portal-user-name')?.textContent.includes('Sam Staff') && ${title('Staff dashboard')}`));
await sleep(1500);
check('and nothing asks for the account list for them', accountsAsked() === mark, `${accountsAsked() - mark} asked`);
check('a staff member sees no Manage Staff button', await evaluate(`![...document.querySelectorAll('.portal-nav button')].some(b => b.textContent.includes('Manage'))`));

// Signing out, then the recovery link.
await evaluate(`document.querySelector('.portal-user-trigger').click(), 1`);
await until(`[...document.querySelectorAll('.portal-user-panel button')].some(b => b.textContent.includes('Sign out'))`, 2000);
await evaluate(`[...document.querySelectorAll('.portal-user-panel button')].find(b => b.textContent.includes('Sign out')).click(), 1`);
check('signing out shows the sign-in page', await until(`document.querySelector('#signin-heading')?.textContent === 'Team sign-in'`));
const link = await evaluate(`[...document.querySelectorAll('a')].find(a => a.textContent.trim() === 'Request password recovery')?.getAttribute('href')`);
check(`"Request password recovery" opens the recovery page (${link})`, link === '/staff?recover=1');
mark = seen.length;
await evaluate(`[...document.querySelectorAll('a')].find(a => a.textContent.trim() === 'Request password recovery').click(), 1`);
check('clicking it opens "Recover your Team Login" from the website', await until(`document.body.innerText.includes('Email me a password link')`) && seen.slice(mark).includes('GET /staff?recover=1'));

check('no script errors on the page', errors.length === 0, errors.slice(0, 3).join(' | '));
check('nothing reached outside this Mac (only the font links tried, and were blocked)', [...outside].every(h => /fonts\.(googleapis|gstatic)\.com|api\.fontshare\.com/.test(h)), [...outside].join(', '));
const failed = results.filter(ok => !ok).length;
console.log(failed ? `${failed} of ${results.length} failed` : `all ${results.length} passed`);
ws.close(); server.close();
process.exit(failed ? 1 : 0);
