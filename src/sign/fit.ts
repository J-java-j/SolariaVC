// The signing page's copy of server/sign/fit.js, so an answer looks on screen the
// way it will in the sealed PDF: wrapped when the box has room, smaller when not.
const LEADING = 1.15;

let context: CanvasRenderingContext2D | null = null;
export function measure(text: string, size: number) {
  context ??= document.createElement('canvas').getContext('2d');
  if (!context) return text.length * size * 0.5;
  context.font = `${size}px Helvetica, Arial, sans-serif`;
  return context.measureText(text).width;
}

function wrap(text: string, width: number, size: number) {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
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

export function fitText(text: string, width: number, height: number, maxSize: number) {
  let best: { size: number; lines: string[] } | null = null;
  for (let count = 1; count <= 6; count++) {
    let size = Math.min(maxSize, height / (count * LEADING));
    if (size < 3) break;
    const lines = count === 1 ? [text.replace(/\s*\r?\n\s*/g, ' ')] : wrap(text, width, size);
    if (lines.length > count) continue;
    const widest = Math.max(...lines.map((l) => measure(l, size)), 0.001);
    if (widest > width) size *= width / widest;
    if (!best || size > best.size) best = { size: Math.max(size, 3), lines };
  }
  if (!best) {
    const line = text.replace(/\s+/g, ' ');
    best = { size: Math.max(3, Math.min(maxSize, height / LEADING, maxSize * (width / Math.max(measure(line, maxSize), 0.001)))), lines: [line] };
  }
  return { ...best, leading: LEADING };
}
