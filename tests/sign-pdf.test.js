// What lands in the file. Positions are measured in rendered pixels using pdf.js's
// own viewport as the browser would, because a field drawn somewhere other than
// where the signer saw it would be a defect in the signed record itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { crc32, deflateSync } from 'node:zlib';
import { PDFDocument, PDFName, PDFNumber, degrees, rgb } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { mapRect, readPageGeometry } from '../server/sign/geometry.js';
import { sealDocument } from '../server/sign/pdf.js';
import { checkEmbeddedTimestamp } from '../server/sign/timestamp.js';
import { draft, harness, linkIn, INFO, SENDER, makePdf, makePng, signAs } from './sign-helpers.js';

const hasTool = (name) => spawnSync('which', [name]).status === 0;
const DPI = 100;

function readPpm(file) {
  const data = readFileSync(file);
  let at = 0;
  const token = () => {
    while (data[at] === 0x20 || data[at] === 0x0a) at++;
    const start = at;
    while (data[at] !== 0x20 && data[at] !== 0x0a) at++;
    return data.toString('latin1', start, at);
  };
  token();
  const width = Number(token());
  const height = Number(token());
  token();
  at += 1;
  return { width, height, data, offset: at };
}

function bounds(image, matches) {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -1, -1];
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const p = image.offset + (y * image.width + x) * 3;
      if (matches(image.data[p], image.data[p + 1], image.data[p + 2])) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    }
  }
  return { x0, y0, x1, y1 };
}

function rasterize(dir, name, bytes) {
  const file = path.join(dir, `${name}.pdf`);
  writeFileSync(file, bytes);
  execFileSync('pdftoppm', ['-r', String(DPI), '-cropbox', '-singlefile', file, path.join(dir, name)], { stdio: 'ignore' });
  return readPpm(path.join(dir, `${name}.ppm`));
}

const CASES = [
  { name: 'plain', media: [0, 0, 612, 792], rotate: 0 },
  { name: 'rotate 90', media: [0, 0, 612, 792], rotate: 90 },
  { name: 'rotate 180', media: [0, 0, 612, 792], rotate: 180 },
  { name: 'rotate 270', media: [0, 0, 612, 792], rotate: 270 },
  { name: 'offset media box', media: [50, 100, 662, 892], rotate: 0 },
  { name: 'crop box', media: [0, 0, 612, 792], crop: [40, 60, 560, 740], rotate: 0 },
  { name: 'crop box rotated', media: [0, 0, 612, 792], crop: [40, 60, 560, 740], rotate: 90 },
  { name: 'crop box rotated 270', media: [20, 30, 640, 820], crop: [60, 90, 580, 760], rotate: 270 },
  { name: 'crop larger than media', media: [0, 0, 612, 792], crop: [-30, -30, 700, 900], rotate: 0 },
  { name: 'negative rotate', media: [0, 0, 612, 792], rotate: -90 },
];

for (const c of CASES) {
  test(`a field lands where the signer saw it: ${c.name}`, { skip: !hasTool('pdftoppm') }, async (t) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'sign-geo-'));
    const doc = await PDFDocument.create();
    const page = doc.addPage(c.media.slice(2).map((v, i) => v - c.media[i]));
    page.setMediaBox(c.media[0], c.media[1], c.media[2] - c.media[0], c.media[3] - c.media[1]);
    if (c.crop) page.node.set(PDFName.of('CropBox'), doc.context.obj(c.crop));
    page.node.set(PDFName.of('Rotate'), PDFNumber.of(c.rotate));

    // A blue target in raw page space, which only the viewport can translate.
    const view = c.crop ?? c.media;
    const target = { x: view[0] + 130, y: view[1] + 210, width: 140, height: 46 };
    page.drawRectangle({ ...target, color: rgb(0, 0, 1) });
    const source = await doc.save();

    const loaded = await getDocument({ data: new Uint8Array(source), verbosity: 0 }).promise;
    const vp = (await loaded.getPage(1)).getViewport({ scale: 1 });
    const [a, b, e, f] = vp.convertToViewportRectangle([target.x, target.y, target.x + target.width, target.y + target.height]);
    const rect = {
      x: Math.min(a, e) / vp.width,
      y: Math.min(b, f) / vp.height,
      w: Math.abs(e - a) / vp.width,
      h: Math.abs(f - b) / vp.height,
    };
    await loaded.destroy();

    const reopened = await PDFDocument.load(source);
    const p = reopened.getPages()[0];
    const m = mapRect(readPageGeometry(p), rect);
    p.drawRectangle({ x: m.x, y: m.y, width: m.width, height: m.height, rotate: degrees(m.rotate), color: rgb(1, 0, 0) });

    const before = rasterize(dir, 'before', source);
    const after = rasterize(dir, 'after', await reopened.save());
    const blue = bounds(before, (r, g, bl) => bl > 200 && r < 80 && g < 80);
    const red = bounds(after, (r, g, bl) => r > 200 && g < 80 && bl < 80);
    const leftover = bounds(after, (r, g, bl) => bl > 200 && r < 80 && g < 80);
    t.diagnostic(`blue ${JSON.stringify(blue)} red ${JSON.stringify(red)}`);

    assert.ok(Number.isFinite(blue.x0), 'the target is visible');
    for (const edge of ['x0', 'y0', 'x1', 'y1']) {
      assert.ok(Math.abs(blue[edge] - red[edge]) <= 1, `${edge} is off by ${Math.abs(blue[edge] - red[edge])}px`);
    }
    assert.equal(leftover.x1, -1, 'the target is fully covered');
  });
}

test('a mark stays upright on a rotated page', { skip: !hasTool('pdftoppm') }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'sign-upright-'));
  // Left half red, right half green, so a turned image is obvious.
  const size = 40;
  const row = Buffer.alloc(size * 3 + 1);
  for (let x = 0; x < size; x++) row.set(x < size / 2 ? [255, 0, 0] : [0, 255, 0], 1 + x * 3);
  const chunk = (type, body) => {
    const full = Buffer.concat([Buffer.from(type), body]);
    const out = Buffer.alloc(body.length + 12);
    out.writeUInt32BE(body.length, 0);
    full.copy(out, 4);
    out.writeUInt32BE(crc32(full), body.length + 8);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const bytes = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(Array.from({ length: size }, () => row)))),
    chunk('IEND', Buffer.alloc(0)),
  ]);

  for (const rotate of [0, 90, 180, 270]) {
    const doc = await PDFDocument.create();
    const page = doc.addPage([612, 792]);
    page.node.set(PDFName.of('Rotate'), PDFNumber.of(rotate));
    const image = await doc.embedPng(bytes);
    const m = mapRect(readPageGeometry(page), { x: 0.3, y: 0.4, w: 0.2, h: 0.2 });
    page.drawImage(image, { x: m.x, y: m.y, width: m.width, height: m.height, rotate: degrees(m.rotate) });
    const shot = rasterize(dir, `up${rotate}`, await doc.save());
    const red = bounds(shot, (r, g, b) => r > 200 && g < 80 && b < 80);
    const green = bounds(shot, (r, g, b) => g > 200 && r < 80 && b < 80);
    assert.ok(red.x1 < green.x1 && red.x0 < green.x0, `rotate ${rotate}: red should be left of green`);
  }
});

test('without a timestamp the file still completes, with no empty signature field', async (t) => {
  const { svc, store, sent } = harness(t, { tsaUrls: ['http://127.0.0.1:9/never'] });
  const env = await draft(svc, { recipients: [{ id: 'a', name: 'Ada', email: 'ada@example.com' }] });
  await svc.send(env.id, SENDER, INFO);
  await signAs(svc, linkIn(sent[0]));
  const view = await svc.getEnvelope(env.id);
  assert.equal(view.status, 'completed');
  assert.equal(view.sealed.timestamp, null);
  const stored = await store.getBlob(view.sealed.key);
  assert.equal(stored.includes('/ByteRange'), false);
  assert.equal(checkEmbeddedTimestamp(Buffer.concat([stored])), false);
});

async function digicertReachable() {
  try {
    await fetch('http://timestamp.digicert.com', { method: 'HEAD', signal: AbortSignal.timeout(4000) });
    return true;
  } catch {
    return false;
  }
}

test('a real timestamp seals the whole file and any change breaks it', { timeout: 60_000 }, async (t) => {
  if (!(await digicertReachable())) return t.skip('no route to the timestamp authority');
  const { svc, store, sent } = harness(t, {
    tsaUrls: ['http://127.0.0.1:9/down-first', 'http://timestamp.digicert.com'],
  });
  const env = await draft(svc);
  await svc.send(env.id, SENDER, INFO);
  await signAs(svc, linkIn(sent[0]), { name: 'Ada Investor' });
  await signAs(svc, linkIn(sent[1]), { name: 'Karl Partner' });

  const view = await svc.getEnvelope(env.id);
  assert.equal(view.status, 'completed');
  assert.equal(view.sealed.timestamp.embedded, true);
  assert.equal(view.sealed.timestamp.tsa, 'timestamp.digicert.com', 'the dead authority was skipped');
  assert.ok(Math.abs(Date.parse(view.sealed.timestamp.genTime) - Date.now()) < 120_000);

  const sealed = await store.getBlob(view.sealed.key);
  assert.equal(checkEmbeddedTimestamp(sealed), true);

  // Each region on purpose, because the slot holding the token is most of a small file.
  const slotEnd = Number(/\/ByteRange\s*\[\s*0\s+\d+\s+(\d+)/.exec(sealed.toString('latin1'))[1]);
  const flipped = (offset) => {
    const copy = Buffer.from(sealed);
    copy[offset] ^= 1;
    return copy;
  };
  assert.equal(checkEmbeddedTimestamp(flipped(100)), false, 'a changed byte before the timestamp');
  assert.equal(checkEmbeddedTimestamp(flipped(sealed.length - 100)), false, 'a changed byte after it');
  assert.equal(checkEmbeddedTimestamp(flipped(slotEnd - 10)), false, 'a changed byte in the blank end of the slot');
  assert.equal(checkEmbeddedTimestamp(Buffer.concat([sealed, Buffer.from('\n%%appended\n')])), false, 'bytes added after sealing');

  // The token also has to stand up outside this code.
  if (hasTool('qpdf')) {
    const dir = mkdtempSync(path.join(tmpdir(), 'sign-seal-'));
    const file = path.join(dir, 'sealed.pdf');
    writeFileSync(file, sealed);
    assert.equal(spawnSync('qpdf', ['--check', file]).status, 0);
    await PDFDocument.load(sealed);
  }
});

test('sealing works on a document with a filled-in form', async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const form = doc.getForm();
  const field = form.createTextField('entity');
  field.setText('Acme Holdings');
  field.addToPage(page, { x: 72, y: 600, width: 200, height: 24 });
  form.createCheckBox('accredited').addToPage(page, { x: 72, y: 560, width: 16, height: 16 });
  const bytes = Buffer.from(await doc.save());
  const env = {
    id: 'AAAABBBBCCCC', title: 'Form', sentAt: new Date().toISOString(), sequential: false,
    sender: { name: 'J', email: 'j@x.co' },
    document: { fileName: 'f.pdf', pages: 1, sha256: 'x' },
    recipients: [{
      id: 'r1', role: 'signer', name: 'Ada', email: 'a@x.co', delivery: 'email', signedAt: new Date().toISOString(),
      viewedAt: new Date().toISOString(), consent: { version: 'v', at: new Date().toISOString() }, signature: { method: 'draw', name: 'Ada' },
    }],
    fields: [{ recipientId: 'r1', type: 'signature', page: 1, x: 0.1, y: 0.5, w: 0.3, h: 0.05 }],
    events: [{ type: 'recipient.signed', at: new Date().toISOString(), hash: 'abc' }],
  };
  const images = new Map([['r1:signature', makePng()]]);
  const { pdf } = await sealDocument(env, bytes, images, []);
  const flattened = await PDFDocument.load(pdf);
  assert.equal(flattened.getForm().getFields().length, 0, 'no field stays editable after signing');
  assert.equal(flattened.getPageCount(), 3);
});

test('rejected documents never reach storage', async (t) => {
  const { svc, store } = harness(t);
  await assert.rejects(svc.createDraft(SENDER, 'x.pdf', Buffer.from('nope, not a pdf, not even close'), INFO));
  assert.deepEqual(await store.listEnvelopes(10), []);
  assert.ok((await makePdf()).length);
});
