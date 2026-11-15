// Fits an answer into its box: as large as it can be, up to a cap, wrapping onto
// more lines when the box is tall enough and shrinking when it is not, so the
// whole answer always shows. The signing page uses the same rule (src/sign/fit.ts).
const LEADING = 1.15;

function wrap(text, width, size, measure) {
  const lines = [];
  for (const paragraph of String(text).split(/\r?\n/)) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && measure(next, size) > width) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

export function fitText(text, width, height, maxSize, measure) {
  let best = null;
  for (let count = 1; count <= 6; count++) {
    let size = Math.min(maxSize, height / (count * LEADING));
    if (size < 3) break;
    const lines = count === 1 ? String(text).replace(/\s*\r?\n\s*/g, ' ').split('\n') : wrap(text, width, size, measure);
    if (lines.length > count) continue;
    const widest = Math.max(...lines.map((l) => measure(l, size)), 0.001);
    if (widest > width) size *= width / widest;
    if (!best || size > best.size) best = { size: Math.max(size, 3), lines };
  }
  if (!best) {
    const line = String(text).replace(/\s+/g, ' ');
    best = { size: Math.max(3, Math.min(maxSize, height / LEADING, maxSize * (width / Math.max(measure(line, maxSize), 0.001)))), lines: [line] };
  }
  return { ...best, leading: LEADING };
}
