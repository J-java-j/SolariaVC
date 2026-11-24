// Run after npm run build, with npm run dev and npm run server running.
// Checks served artifacts and routes; this is not a browser/visual test.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const dev = 'http://127.0.0.1:5173';
const production = 'http://127.0.0.1:8080';
const views = ['signin', 'staff', 'board-admin', 'owner'];
async function get(url) {
  const response = await fetch(url);
  assert.equal(response.status, 200, url);
  return { text: await response.text(), type: response.headers.get('content-type') };
}
const source = await get(`${dev}/src/staff/main.tsx`);
assert.match(source.text, /"DEV": true/);
assert.match(source.text, /import\("\/src\/staff\/portal\/PortalPreview\.tsx(?:\?[^"]*)?"\)/);
assert.match(source.text, /import\("\/src\/staff\/portal\/ConnectedPortal\.tsx(?:\?[^"]*)?"\)/);
assert.match((await get(`${dev}/src/staff/portal/PortalPreview.tsx`)).text, /Development preview/);
assert.match((await get(`${dev}/src/components/Footer.tsx`)).text, /href: "\/staff"/);
for (const view of views) {
  assert.match((await get(`${dev}/staff?preview=${view}`)).text, /\/src\/staff\/main.tsx/);
}
console.log('PASS: local footer entry, preview module, and all four view URLs');

const builtStaff = await readFile(new URL('../dist/staff.html', import.meta.url), 'utf8');
const asset = builtStaff.match(/src="(\/assets\/staff-[^"]+\.js)"/)?.[1];
assert.ok(asset, 'production staff bundle exists');
const bundle = (await get(`${production}${asset}`)).text;
assert.match(bundle, /Everything the Solaria team works in/);
assert.match(bundle, /Each tool has its own sign-in/);
assert.doesNotMatch(bundle, /PortalPreview|URLSearchParams|Development preview|Avery Morgan/);
for (const filename of await readdir(new URL('../dist/assets/', import.meta.url))) {
  if (!/\.(js|css)$/.test(filename)) continue;
  const text = await readFile(new URL(`../dist/assets/${filename}`, import.meta.url), 'utf8');
  assert.doesNotMatch(text, /portal-preview-bar|Fictional sample accounts|Preview — sample data|solaria\.staff\.local\.idToken|staff\/local-api|127\.0\.0\.1:9099|ConnectedPortal/, filename);
}
for (const view of views) {
  assert.equal((await get(`${production}/staff?preview=${view}`)).text, builtStaff);
}
assert.equal((await get(production + '/staff?mode=connected&section=board-admins')).text, builtStaff);
console.log('PASS: production serves the launcher for mock and connected queries; development code/styles are excluded');

for (const [path, title] of [['/card', 'Johnson Jiang'], ['/card/karl', 'Karl Li']]) {
  const nodeCard = await get(`${production}${path}`);
  assert.ok(nodeCard.text.includes(`<title>${title}`));
  assert.equal((await get(`${dev}${path}`)).text, nodeCard.text, `original ${path} is proxied unchanged`);
}
for (const path of ['/card/johnson-jiang.vcf', '/card/karl-li.vcf']) {
  for (const base of [dev, production]) {
    const card = await get(`${base}${path}`);
    assert.match(card.type, /text\/vcard/);
    assert.match(card.text, /BEGIN:VCARD/);
  }
}
for (const path of ['/', '/sign', '/sign/verify']) await get(`${dev}${path}`);
for (const base of [dev, production]) {
  const team = await fetch(`${base}/sign/team`, { redirect: 'manual' });
  assert.equal(team.status, 303);
  assert.equal(new URL(team.headers.get('location'), base).href, dev + '/staff?launch=sign-team');
}
console.log('PASS: original card routes, vCards, public Sign entries, and signed-out Sign Team redirects');
