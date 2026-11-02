// Builds the signed file: fields baked onto the original pages, a reference stamped
// on each page, the certificate of completion appended, and an independent
// timestamp over the whole result.
//
// Everything that could stop a file being sealed is checked at upload by
// inspectPdf, because finding out after people have signed is too late.
import { EncryptedPDFError, PDFDocument, PDFName, PDFSignature, degrees, rgb } from 'pdf-lib';
import { LIMITS } from './config.js';
import { formatEnvelopeId, sha256Hex } from './crypto.js';
import { addCertificate } from './certificate.js';
import { createTypeset } from './fonts.js';
import { mapRect, pointInRect, readPageGeometry } from './geometry.js';
import {
  addTimestampPlaceholder, checkEmbeddedTimestamp, embedToken, prepareDigest, requestTimestamp,
} from './timestamp.js';

const INK = rgb(0.078, 0.129, 0.239);
const STAMP = rgb(0.45, 0.47, 0.47);
const MAX_TEXT_SIZE = 14;
const SAVE_OPTIONS = { useObjectStreams: false, updateFieldAppearances: false, addDefaultPage: false };

export class PdfRejected extends Error {}

function hasForm(doc) {
  return Boolean(doc.catalog.getAcroForm());
}

function flattenForm(doc) {
  if (!hasForm(doc)) return;
  const form = doc.getForm();
  if (form.getFields().length) form.flatten();
}

export async function inspectPdf(bytes) {
  if (bytes.length < 16 || bytes.subarray(0, 1024).indexOf('%PDF-') < 0) {
    throw new PdfRejected('That file is not a PDF.');
  }
  let doc;
  let pages;
  try {
    doc = await PDFDocument.load(bytes, { updateMetadata: false });
    pages = doc.getPages();
  } catch (e) {
    // Encrypted object streams can fail parsing before pdf-lib names the real problem.
    if (e instanceof EncryptedPDFError || bytes.includes('/Encrypt')) {
      throw new PdfRejected(
        'This PDF is password-protected. Open it, choose Print, save it as a new PDF, then upload that copy.',
      );
    }
    // pdf-lib parses a truncated file without complaint and fails on first use.
    throw new PdfRejected('This PDF is damaged or incomplete and cannot be read.');
  }

  if (!pages.length) throw new PdfRejected('This PDF has no pages.');
  if (pages.length > LIMITS.pages) throw new PdfRejected(`This PDF has more than ${LIMITS.pages} pages.`);

  if (hasForm(doc)) {
    const hadXfa = Boolean(doc.catalog.getAcroForm()?.dict.has(PDFName.of('XFA')));
    const fields = doc.getForm().getFields();
    if (hadXfa && !fields.length) {
      throw new PdfRejected('This is a dynamic XFA form. Open it, choose Print, save it as a new PDF, then upload that copy.');
    }
    // Rewriting the file would silently break a signature someone already applied.
    if (fields.some((f) => f instanceof PDFSignature && f.acroField.dict.has(PDFName.of('V')))) {
      throw new PdfRejected('This PDF already carries a digital signature, and adding to it would invalidate that signature.');
    }
  }

  const sizes = pages.map((page) => {
    const g = readPageGeometry(page);
    if (g.fallback.length) throw new PdfRejected('This PDF has a page with invalid dimensions.');
    return { width: Math.round(g.width * 100) / 100, height: Math.round(g.height * 100) / 100 };
  });

  // A dry run of what sealing does, so a file that can't be rewritten never gets sent.
  try {
    flattenForm(doc);
    await createTypeset(doc);
    await doc.save(SAVE_OPTIONS);
  } catch {
    throw new PdfRejected('This PDF has a structure that cannot be sealed. Open it, choose Print, save it as a new PDF, then upload that copy.');
  }
  return { pages: sizes.length, sizes };
}

// Must pass before a signature is accepted, for the same reason.
export async function assertEmbeddablePng(bytes) {
  const doc = await PDFDocument.create();
  await doc.embedPng(bytes);
}

function drawImageInRect(page, image, rect, g) {
  // Fit inside the box, keeping the mark's proportions.
  const boxW = rect.w * g.width;
  const boxH = rect.h * g.height;
  const scale = Math.min(boxW / image.width, boxH / image.height);
  const w = (image.width * scale) / g.width;
  const h = (image.height * scale) / g.height;
  const m = mapRect(g, { x: rect.x + (rect.w - w) / 2, y: rect.y + (rect.h - h) / 2, w, h });
  page.drawImage(image, { x: m.x, y: m.y, width: m.width, height: m.height, rotate: degrees(m.rotate) });
}

function drawTextInRect(page, ts, text, rect, g) {
  const boxW = rect.w * g.width;
  const boxH = rect.h * g.height;
  const padding = Math.min(2, boxW * 0.05);
  let size = Math.min(boxH * 0.72, MAX_TEXT_SIZE);
  const width = ts.width(text, size);
  if (width > boxW - 2 * padding) size = Math.max(3, size * ((boxW - 2 * padding) / width));
  const ascent = ts.regular.heightAtSize(size, { descender: false });
  const descent = ts.regular.heightAtSize(size) - ascent;
  const [x, y] = pointInRect(g, rect, padding, (boxH - (ascent + descent)) / 2 + ascent);
  ts.draw(page, text, { x, y, size, color: INK, rotate: g.rotate });
}

function drawCheck(page, rect, g) {
  const boxW = rect.w * g.width;
  const boxH = rect.h * g.height;
  const point = (fx, fy) => {
    const [x, y] = pointInRect(g, rect, boxW * fx, boxH * fy);
    return { x, y };
  };
  const thickness = Math.max(1, Math.min(boxW, boxH) * 0.12);
  page.drawLine({ start: point(0.2, 0.55), end: point(0.42, 0.76), thickness, color: INK });
  page.drawLine({ start: point(0.42, 0.76), end: point(0.82, 0.24), thickness, color: INK });
}

function drawField(page, ts, field, g, images) {
  const rect = { x: field.x, y: field.y, w: field.w, h: field.h };
  if (field.type === 'signature' || field.type === 'initials') {
    const image = images.get(`${field.recipientId}:${field.type}`);
    if (image) drawImageInRect(page, image, rect, g);
  } else if (field.type === 'checkbox') {
    if (field.value === true) drawCheck(page, rect, g);
  } else if (field.value) {
    drawTextInRect(page, ts, String(field.value), rect, g);
  }
}

async function buildDocument(env, originalBytes, images) {
  const doc = await PDFDocument.load(originalBytes, { updateMetadata: false });
  const ts = await createTypeset(doc, JSON.stringify([env.title, env.recipients, env.fields, env.sender, env.document.fileName]));
  flattenForm(doc);

  const embedded = new Map();
  for (const [key, bytes] of images) embedded.set(key, await doc.embedPng(bytes));

  const pages = doc.getPages();
  const geometry = pages.map(readPageGeometry);
  for (const field of env.fields) {
    drawField(pages[field.page - 1], ts, field, geometry[field.page - 1], embedded);
  }

  const reference = `Solaria Sign reference ${formatEnvelopeId(env.id)}`;
  pages.forEach((page, i) => {
    const g = geometry[i];
    const [x, y] = pointInRect(g, { x: 0.03, y: 0.012 }, 0, 6);
    ts.draw(page, reference, { x, y, size: 6, color: STAMP, rotate: g.rotate });
  });

  await addCertificate(doc, ts, env, embedded);

  doc.setTitle(env.title);
  doc.setProducer('Solaria Sign');
  doc.setCreator('Solaria Sign');
  doc.setModificationDate(new Date());
  return doc;
}

export async function sealDocument(env, originalBytes, images, tsaUrls) {
  const failures = [];
  const doc = await buildDocument(env, originalBytes, images);
  if (tsaUrls.length) {
    try {
      addTimestampPlaceholder(doc);
      const prepared = prepareDigest(await doc.save(SAVE_OPTIONS));
      const stamp = await requestTimestamp(prepared.digest, { urls: tsaUrls });
      failures.push(...stamp.failures);
      if (stamp.token) {
        const pdf = embedToken(prepared, stamp.token);
        if (!checkEmbeddedTimestamp(pdf)) throw new Error('embedded timestamp failed its own check');
        return {
          pdf,
          token: stamp.token,
          timestamp: { tsa: stamp.tsa, genTime: stamp.genTime, serial: stamp.serial, embedded: true },
          failures,
        };
      }
    } catch (e) {
      failures.push(e.message);
    }
  }
  // Signatures already stand, so no timestamp must never block completion. This
  // copy is rebuilt because an empty signature field looks broken in every viewer,
  // and the finished file can still be timestamped later, as it is, by retryTimestamp.
  const plain = await buildDocument(env, originalBytes, images);
  return { pdf: Buffer.from(await plain.save(SAVE_OPTIONS)), token: null, timestamp: null, failures };
}

export async function timestampFile(pdf, tsaUrls) {
  const digest = Buffer.from(sha256Hex(pdf), 'hex');
  const stamp = await requestTimestamp(digest, { urls: tsaUrls });
  if (!stamp.token) return { token: null, timestamp: null, failures: stamp.failures };
  return {
    token: stamp.token,
    timestamp: { tsa: stamp.tsa, genTime: stamp.genTime, serial: stamp.serial, embedded: false },
    failures: stamp.failures,
  };
}
