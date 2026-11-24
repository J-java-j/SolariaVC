// What the public site gives search engines, checked against the real server (server/index.js) and built pages.
//   APP=<folder holding server/, node_modules/ and dist/> node --test site-search.test.mjs
// The site is one page. Until 2026-11-24 every address that didn't exist answered 200 with a copy of the home page
// (Google was fetching /news/, /blog/ and /wp-json/ from the WordPress site this domain once held, and getting it),
// the sitemap listed one page with a date from April, and the link preview described a different company.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const APP = process.env.APP || '.';
const SITE = 'https://solariavc.com';
const port = 5400 + Math.floor(Math.random() * 400);
const dataDir = mkdtempSync(join(tmpdir(), 'site-search-')) + '/';
let server;

function get(path, host = 'solariavc.com', method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, method, path, headers: { host } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.end();
  });
}
const noindex = (res) => /noindex/i.test(String(res.headers['x-robots-tag'] ?? '')) || /<meta[^>]+name=["']robots["'][^>]+noindex/i.test(res.body);
const head = () => readFileSync(join(APP, 'dist/index.html'), 'utf8').replace(/\r/g, '');
const meta = (html, key) => new RegExp(`<meta\\s+(?:name|property)="${key}"\\s+content="([^"]*)"`, 's').exec(html)?.[1];

before(async () => {
  assert.ok(existsSync(join(APP, 'dist/index.html')), 'build the site first: dist/index.html is missing');
  server = spawn(process.execPath, ['server/index.js'], { cwd: APP, stdio: 'ignore',
    env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: 'production', PORT: String(port), SIGN_DATA_DIR: dataDir, SIGN_TSA_URLS: '' } });
  for (let i = 0; i < 80; i++) {
    await new Promise((r) => setTimeout(r, 120));
    try { if ((await get('/healthz')).status === 200) return; } catch { /* not up yet */ }
  }
  throw new Error('the server did not start');
});
after(() => { server?.kill('SIGKILL'); rmSync(dataDir, { recursive: true, force: true }); });

test('an address that does not exist is a 404 with its own small page, not a copy of the home page', async () => {
  for (const path of ['/news/', '/blog/wp-json/', '/wp-json/', '/.env', '/does-not-exist', '/sql.zip', '/xmlrpc.php', '/assets/nope-12345678.js',
    '/research/nope.pdf', '/team/nobody.png', '/team/', '/assets/', '/card/nobody', '/llms.txt', '/.well-known/security.txt']) {
    const res = await get(path);
    assert.equal(res.status, 404, path);
    assert.match(res.headers['content-type'], /^text\/html/, path);
    assert.ok(noindex(res), path + ' must not be indexed');
    assert.match(res.body, /Page not found/, path);
    assert.match(res.body, /href="\/"/, path + ' links home');
    assert.doesNotMatch(res.body, /<div id="root">/, path + ' is not the home page');
  }
});

test('everything real still answers, including every address the site, the portal and the emails link to', async () => {
  const ok = ['/', '/robots.txt', '/sitemap.xml', '/logo.png', '/favicon.svg', '/service-worker.js', '/healthz',
    '/research/solaria-family-model-m5v3.pdf', '/research/solaria-family-model-m5v3.html', '/card', '/card/', '/card/karl',
    '/card/johnson-jiang.vcf', '/card/karl-li.vcf', '/sign', '/sign/login', '/sign/verify', '/sign/team', '/sign/queue', '/s', '/staff'];
  const html = head();
  for (const asset of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) ok.push(asset[1]);
  const shortcuts = JSON.parse(readFileSync(join(APP, 'staff-service/destinations.json'), 'utf8'));
  for (const item of Object.values(shortcuts)) if (item.href.startsWith('/') && !item.local) ok.push(item.href);
  for (const path of new Set(ok)) assert.equal((await get(path)).status, 200, path);
});

test('the old default icon addresses lead to the real icons, and /index.html to /', async () => {
  for (const [from, to] of [['/favicon.ico', '/favicon.svg'], ['/apple-touch-icon.png', '/logo.png'], ['/apple-touch-icon-precomposed.png', '/logo.png'], ['/index.html', '/']]) {
    const res = await get(from);
    assert.deepEqual([res.status, res.headers.location], [301, to], from);
    assert.equal((await get(to)).status, 200, to);
  }
});

test('the sitemap lists every page meant for search, each answers 200 and none says noindex', async () => {
  const res = await get('/sitemap.xml');
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /xml/);
  const entries = [...res.body.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)].map((m) => ({ loc: m[1], lastmod: m[2] }));
  assert.equal(entries.length, (res.body.match(/<url>/g) ?? []).length, 'every entry has a place and a date');
  const paths = entries.map((e) => e.loc.replace(SITE, ''));
  assert.ok(entries.every((e) => e.loc.startsWith(SITE + '/')), 'all on https://solariavc.com');
  assert.ok(paths.includes('/') && paths.includes('/research/solaria-family-model-m5v3.pdf'), paths.join(' '));
  assert.equal(new Set(paths).size, paths.length, 'no address twice');
  for (const { loc, lastmod } of entries) {
    assert.match(lastmod, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(new Date(lastmod) <= new Date() && new Date(lastmod) > new Date('2026-06-01'), `${loc} dated ${lastmod}`);
    const page = await get(loc.replace(SITE, ''));
    assert.equal(page.status, 200, loc);
    assert.equal(noindex(page), false, loc + ' is listed, so it must be indexable');
  }
  for (const path of ['/staff', '/sign', '/card', '/research/solaria-family-model-m5v3.html']) assert.equal(paths.includes(path), false, path + ' is not for search');
});

test('robots.txt lets search engines read the pages that say noindex, and names the sitemap', async () => {
  const robots = (await get('/robots.txt')).body.replace(/\r/g, '');
  assert.match(robots, /^Sitemap: https:\/\/solariavc\.com\/sitemap\.xml$/m);
  assert.match(robots, /^Disallow: \/api\/$/m);
  const blocked = [...robots.matchAll(/^Disallow: (.+)$/gm)].map((m) => m[1]);
  for (const path of ['/', '/staff', '/sign', '/s', '/research/solaria-family-model-m5v3.pdf']) {
    assert.equal(blocked.some((rule) => path.startsWith(rule.replace(/\$$/, ''))), false, path + ' must stay readable');
  }
  // A page kept out of search says so itself; robots.txt must not hide that from the search engine.
  for (const path of ['/staff', '/sign', '/sign/login', '/s', '/card', '/research/solaria-family-model-m5v3.html']) assert.ok(noindex(await get(path)), path);
});

test('the home page says one thing about the company: title, description, link preview and hidden description agree', () => {
  const html = head();
  const title = /<title>([^<]+)<\/title>/.exec(html)[1];
  const description = meta(html, 'description');
  assert.ok(title.startsWith('Solaria Capital') && title.length <= 60, `${title.length}: ${title}`);
  assert.ok(description.startsWith('Solaria Capital') && description.length >= 110 && description.length <= 170, `${description.length}`);
  assert.equal(meta(html, 'og:title'), title);
  assert.equal(meta(html, 'twitter:title'), title);
  assert.equal(meta(html, 'og:description'), description);
  assert.equal(meta(html, 'twitter:description'), description);
  assert.equal(/<link rel="canonical" href="([^"]+)"/.exec(html)[1], SITE + '/');
  assert.equal(meta(html, 'og:url'), SITE + '/');
  assert.match(meta(html, 'robots'), /^index, follow/);
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  const things = blocks.flatMap((b) => b['@graph'] ?? [b]);
  const company = things.find((t) => t['@type'] === 'Organization');
  assert.equal(company.name, 'Solaria Capital');
  assert.equal(company.url, SITE + '/');
  assert.equal(company.description, description);
  assert.ok(things.some((t) => t['@type'] === 'WebSite' && t.name === 'Solaria Capital' && t.url === SITE + '/'));
  for (const old of [/Medallion/i, /Quantitative investment/i, /Solaria VC\b/, /student-led venture platform/i]) assert.doesNotMatch(html.split('</head>')[0], old);
  for (const word of [/private company/, /student-funded fund/, /spinout/, /university research and patents/]) assert.match(description, word);
});

test('the link preview picture is a real picture on the site', async () => {
  const image = meta(head(), 'og:image');
  assert.ok(image.startsWith(SITE + '/'));
  const res = await get(image.replace(SITE, ''));
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /^image\//);
});

test('solariavc.com is the one address for search: www goes to it, and the service\'s own addresses say noindex', async () => {
  const www = await get('/research/solaria-family-model-m5v3.pdf?x=1', 'www.solariavc.com');
  assert.deepEqual([www.status, www.headers.location], [301, SITE + '/research/solaria-family-model-m5v3.pdf?x=1']);
  assert.equal((await get('/', 'www.solariavc.com', 'HEAD')).status, 301);
  const run = await get('/', 'solariavc-ii6s6mknua-ew.a.run.app');
  assert.equal(run.status, 200);
  assert.match(String(run.headers['x-robots-tag']), /noindex/);
  const main = await get('/');
  assert.equal(main.status, 200);
  assert.equal(noindex(main), false, 'the home page on solariavc.com is indexable');
  assert.match(main.body, /<div id="root">/);
});
