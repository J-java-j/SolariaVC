// Text that can never crash sealing. pdf-lib's standard fonts throw on anything
// outside WinAnsi, which would turn a signer named 李明 into a failure after
// everyone had already signed. Noto covers Latin, Greek and Cyrillic; the CJK face
// is large, so it loads only when the envelope needs it. It must stay TrueType:
// pdf-lib's subsetter writes CFF fonts that viewers can't load. A character no font
// holds prints as "?" and the exact text stays in the audit record.
import { readFileSync } from 'node:fs';
import { degrees } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const cache = new Map();
function fontBytes(name) {
  if (!cache.has(name)) cache.set(name, readFileSync(new URL(`./fonts/${name}`, import.meta.url)));
  return cache.get(name);
}

const IGNORED = new Set([0x200b, 0x200c, 0x200d, 0xfe0e, 0xfe0f, 0xfeff]);

const printable = (text) => String(text ?? '').replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, ' ');

export async function createTypeset(doc, sample = '') {
  doc.registerFontkit(fontkit);
  const face = fontkit.create(fontBytes('NotoSans-Regular.ttf'));
  const regular = await doc.embedFont(fontBytes('NotoSans-Regular.ttf'), { subset: true });
  const bold = await doc.embedFont(fontBytes('NotoSans-Bold.ttf'), { subset: true });

  let cjkFace = null;
  let cjk = null;
  const wanted = new Set();
  for (const ch of printable(sample)) {
    const cp = ch.codePointAt(0);
    if (cp >= 0x2e80 && !IGNORED.has(cp) && !face.hasGlyphForCodePoint(cp)) wanted.add(cp);
  }
  if (wanted.size) {
    cjkFace = fontkit.create(fontBytes('NotoSansSC-Regular.ttf'));
    // Subsets use 16-bit glyph offsets, which a very large one would overflow.
    cjk = await doc.embedFont(fontBytes('NotoSansSC-Regular.ttf'), { subset: wanted.size <= 400 });
  }

  // Splits text into runs of a single font, so one missing glyph can't fail a line.
  function runs(text, useBold) {
    const primary = useBold ? bold : regular;
    const out = [];
    const push = (font, s) => {
      if (out.at(-1)?.font === font) out.at(-1).text += s;
      else out.push({ font, text: s });
    };
    for (const ch of printable(text)) {
      const cp = ch.codePointAt(0);
      if (IGNORED.has(cp)) continue;
      if (face.hasGlyphForCodePoint(cp)) push(primary, ch);
      else if (cjkFace?.hasGlyphForCodePoint(cp)) push(cjk, ch);
      else push(primary, '?');
    }
    return out;
  }

  const width = (text, size, useBold) =>
    runs(text, useBold).reduce((sum, r) => sum + r.font.widthOfTextAtSize(r.text, size), 0);

  // Advances along the baseline, so this also works rotated on a /Rotate page.
  function draw(page, text, { x, y, size, bold: useBold = false, color, rotate = 0 }) {
    const rad = (rotate * Math.PI) / 180;
    let cx = x;
    let cy = y;
    for (const r of runs(text, useBold)) {
      page.drawText(r.text, { x: cx, y: cy, size, font: r.font, color, rotate: degrees(rotate) });
      const w = r.font.widthOfTextAtSize(r.text, size);
      cx += w * Math.cos(rad);
      cy += w * Math.sin(rad);
    }
  }

  // Word wrap. A string with no spaces, such as a hash, breaks by character.
  function wrap(text, size, maxWidth, useBold) {
    const lines = [];
    let line = '';
    for (const word of printable(text).split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (width(next, size, useBold) <= maxWidth) {
        line = next;
        continue;
      }
      if (line) lines.push(line);
      line = '';
      for (const ch of word) {
        if (width(line + ch, size, useBold) > maxWidth && line) {
          lines.push(line);
          line = ch;
        } else {
          line += ch;
        }
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }

  return { regular, runs, width, draw, wrap };
}
