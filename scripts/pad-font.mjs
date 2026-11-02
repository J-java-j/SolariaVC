// Pads every glyph record in a TrueType font to an even length.
//
//   node scripts/pad-font.mjs <input.ttf> <output.ttf>
//
// fontkit's subsetter writes short loca offsets, which store offset / 2. A font with
// odd-length glyph records (Noto Sans SC has 15,284) loses a byte at each one, and
// the glyphs after it render blank until the next odd record realigns them, while
// text extraction still reports the right characters. Run this on any new font
// before shipping it; tests/sign-fonts.test.js fails on a font that needs it.
import { readFileSync, writeFileSync } from 'node:fs';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('usage: pad-font.mjs <input.ttf> <output.ttf>');

const font = readFileSync(input);
const numTables = font.readUInt16BE(4);
const tables = new Map();
for (let i = 0; i < numTables; i++) {
  const at = 12 + i * 16;
  const tag = font.toString('latin1', at, at + 4);
  const offset = font.readUInt32BE(at + 8);
  tables.set(tag, Buffer.from(font.subarray(offset, offset + font.readUInt32BE(at + 12))));
}

const head = tables.get('head');
const glyphCount = tables.get('maxp').readUInt16BE(4);
const longOffsets = head.readInt16BE(50) === 1;
const oldLoca = tables.get('loca');
const locaAt = (i) => (longOffsets ? oldLoca.readUInt32BE(i * 4) : oldLoca.readUInt16BE(i * 2) * 2);

const oldGlyf = tables.get('glyf');
const pieces = [];
const newLoca = Buffer.alloc((glyphCount + 1) * 4);
let cursor = 0;
for (let i = 0; i < glyphCount; i++) {
  newLoca.writeUInt32BE(cursor, i * 4);
  const record = oldGlyf.subarray(locaAt(i), locaAt(i + 1));
  pieces.push(record);
  cursor += record.length;
  if (record.length % 2) {
    pieces.push(Buffer.alloc(1));
    cursor += 1;
  }
}
newLoca.writeUInt32BE(cursor, glyphCount * 4);
tables.set('glyf', Buffer.concat(pieces));
tables.set('loca', newLoca);
head.writeInt16BE(1, 50);
head.writeUInt32BE(0, 8);

function checksum(data) {
  const padded = Buffer.concat([data, Buffer.alloc((4 - (data.length % 4)) % 4)]);
  let sum = 0;
  for (let i = 0; i < padded.length; i += 4) sum = (sum + padded.readUInt32BE(i)) >>> 0;
  return sum;
}

const tags = [...tables.keys()].sort();
const directory = Buffer.alloc(12 + numTables * 16);
font.copy(directory, 0, 0, 12);
let offset = directory.length;
const body = [];
tags.forEach((tag, i) => {
  const data = tables.get(tag);
  const at = 12 + i * 16;
  directory.write(tag, at, 'latin1');
  directory.writeUInt32BE(checksum(data), at + 4);
  directory.writeUInt32BE(offset, at + 8);
  directory.writeUInt32BE(data.length, at + 12);
  const padded = Buffer.concat([data, Buffer.alloc((4 - (data.length % 4)) % 4)]);
  body.push(padded);
  offset += padded.length;
});

const file = Buffer.concat([directory, ...body]);
const headOffset = directory.readUInt32BE(12 + tags.indexOf('head') * 16 + 8);
file.writeUInt32BE((0xb1b0afba - checksum(file)) >>> 0, headOffset + 8);
writeFileSync(output, file);
