// Finds the places a document expects someone to sign or fill in: runs of
// underscores ("Signature: ________") and bare labels ("Date:") with room after
// them. A guess the sender checks before sending, never applied on its own.
import type { FieldType } from './api';
import type { PdfDocument } from './pdf';

export type FoundField = { type: FieldType; page: number; x: number; y: number; w: number; h: number; label: string };

type Text = { str: string; x: number; y: number; w: number; size: number };

// Heights in PDF points, the bottom of each box resting on the line.
const HEIGHT: Record<FieldType, number> = { signature: 30, initials: 24, date: 14, name: 14, text: 14, checkbox: 12 };
const MIN_WIDTH: Record<FieldType, number> = { signature: 120, initials: 40, date: 80, name: 110, text: 90, checkbox: 12 };
const LABEL_ONLY = /^(authori[sz]ed\s+)?(signature|sign here|signed|by|initials?|date|(print(ed)?\s+)?name)\s*:?\s*$/i;

function classify(label: string, width: number): { type: FieldType; label: string } {
  const text = label.toLowerCase();
  if (/initial/.test(text)) return { type: 'initials', label: '' };
  if (/sign|^\s*by\b/.test(text)) return { type: 'signature', label: '' };
  if (/date/.test(text)) return { type: 'date', label: '' };
  if (/\bname\b/.test(text) && !/(company|entity|firm|fund|business|bank)/.test(text)) return { type: 'name', label: '' };
  const hint = label.replace(/[_:]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  if (hint) return { type: 'text', label: hint };
  return { type: width >= 140 ? 'signature' : 'text', label: '' };
}

// The words just before a blank on its line, or failing that just under or over it.
function labelFor(texts: Text[], x: number, y: number, w: number) {
  const before = texts
    .filter((t) => Math.abs(t.y - y) < 4 && t.x + t.w <= x + 2 && x - (t.x + t.w) < 160 && /[a-z]/i.test(t.str))
    .sort((a, b) => b.x - a.x)[0];
  if (before) return before.str;
  const near = texts
    .filter((t) => /[a-z]/i.test(t.str) && t.x < x + w && t.x + t.w > x && Math.abs(t.y - y) < 24 && Math.abs(t.y - y) >= 4)
    .sort((a, b) => Math.abs(a.y - y) - Math.abs(b.y - y))[0];
  return near?.str ?? '';
}

// pdf.js gives a run's width, not each letter's. Typical proportional widths
// place a blank inside "Signature: ______" far closer than an even split.
function charWidth(c: string) {
  if (c === '_') return 0.556;
  if (c === ' ') return 0.278;
  if (/[iljtfrI.,:;'|!()\[\]]/.test(c)) return 0.28;
  if (/[mwMW]/.test(c)) return 0.83;
  if (/[A-Z]/.test(c)) return 0.67;
  return 0.556;
}
const spanOf = (text: string) => [...text].reduce((sum, c) => sum + charWidth(c), 0);

const overlaps = (a: FoundField, b: FoundField) => a.page === b.page && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export async function detectFields(doc: PdfDocument): Promise<FoundField[]> {
  const found: FoundField[] = [];
  for (let number = 1; number <= doc.numPages; number++) {
    const page = await doc.getPage(number);
    const view = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const texts: Text[] = [];
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const [x, y] = view.convertToViewportPoint(item.transform[4], item.transform[5]);
      texts.push({ str: item.str, x, y, w: item.width, size: Math.hypot(item.transform[2], item.transform[3]) || 10 });
    }

    const add = (type: FieldType, x: number, baseline: number, width: number, label: string) => {
      const w = Math.max(width, MIN_WIDTH[type]);
      const h = HEIGHT[type];
      const field: FoundField = {
        type,
        page: number,
        x: Math.max(0, Math.min(x, view.width - w)) / view.width,
        y: Math.max(0, Math.min(baseline - h + 2, view.height - h)) / view.height,
        w: Math.min(w, view.width) / view.width,
        h: h / view.height,
        label,
      };
      if (!found.some((other) => overlaps(other, field))) found.push(field);
    };

    for (const t of texts) {
      const blanks = [...t.str.matchAll(/_{4,}/g)];
      const scale = t.w / Math.max(spanOf(t.str), 0.001);
      for (const blank of blanks) {
        const x = t.x + spanOf(t.str.slice(0, blank.index!)) * scale;
        const w = spanOf(blank[0]) * scale;
        // Words in the same text run, before the blank, are its label.
        const inline = t.str.slice(0, blank.index!).split(/_{2,}/).pop()?.trim() ?? '';
        const { type, label } = classify(inline || labelFor(texts, x, t.y, w), w);
        add(type, x, t.y, w, label);
      }
      // "Signature:" or "Date:" with nothing printed after it on the line.
      if (!blanks.length && LABEL_ONLY.test(t.str.trim())) {
        const end = t.x + t.w + 6;
        const filled = texts.some((o) => o !== t && Math.abs(o.y - t.y) < 4 && o.x >= end - 2 && o.x - end < 60);
        if (!filled && end < view.width - 40) {
          const { type } = classify(t.str, 0);
          add(type, end, t.y, Math.min(MIN_WIDTH[type] + 30, view.width - end - 20), '');
        }
      }
    }
    page.cleanup();
  }
  return found;
}
