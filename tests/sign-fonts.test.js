// Text on a signed document must be visibly there, not just extractable. Blank
// glyphs pass pdftotext, so this compares actual pixels.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { createTypeset } from '../server/sign/fonts.js';

const fontPath = (name) => new URL(`../server/sign/fonts/${name}`, import.meta.url);
const FONTS = ['NotoSans-Regular.ttf', 'NotoSans-Bold.ttf', 'NotoSansSC-Regular.ttf'];

test('every shipped font has even glyph offsets, which subsetting depends on', () => {
  for (const name of FONTS) {
    const { offsets } = fontkit.create(readFileSync(fontPath(name))).loca;
    assert.equal(offsets.filter((o) => o % 2).length, 0, `${name}: run scripts/pad-font.mjs on it`);
  }
});

async function render(dir, name, text, subset) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(readFileSync(fontPath('NotoSansSC-Regular.ttf')), { subset });
  const page = doc.addPage([640, 660]);
  const chars = [...text];
  for (let row = 0; row * 24 < chars.length; row++) {
    page.drawText(chars.slice(row * 24, (row + 1) * 24).join(''), { x: 10, y: 630 - row * 26, size: 24, font, color: rgb(0, 0, 0) });
  }
  const file = path.join(dir, `${name}.pdf`);
  writeFileSync(file, await doc.save());
  execFileSync('pdftoppm', ['-r', '60', '-gray', '-singlefile', file, path.join(dir, name)], { stdio: 'ignore' });
  return readFileSync(path.join(dir, `${name}.pgm`));
}

test('a subset CJK font draws the same pixels as the whole font', { skip: spawnSync('which', ['pdftoppm']).status !== 0 }, async () => {
  const face = fontkit.create(readFileSync(fontPath('NotoSansSC-Regular.ttf')));
  let sample = '北京市朝阳区李明上海深圳';
  for (let cp = 0x4e00; cp < 0x9fa5 && sample.length < 480; cp += 43) {
    if (face.hasGlyphForCodePoint(cp)) sample += String.fromCodePoint(cp);
  }
  const dir = mkdtempSync(path.join(tmpdir(), 'sign-font-'));
  const subset = await render(dir, 'subset', sample, true);
  const whole = await render(dir, 'whole', sample, false);
  assert.equal(subset.length, whole.length);
  assert.ok(subset.equals(whole), 'some glyphs render differently when subset');
});

test('a character no font holds degrades to a mark and never throws', async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 100]);
  const text = 'A 李 Ж محمد 👍‍️\u0000\n';
  const ts = await createTypeset(doc, text);
  assert.doesNotThrow(() => ts.draw(page, text, { x: 10, y: 50, size: 12, color: rgb(0, 0, 0) }));
  assert.ok(ts.width(text, 12) > 0);
  await doc.save();
});
