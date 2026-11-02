// Shared fixtures for the Solaria Sign tests.
import { crc32, deflateSync } from 'node:zlib';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { createSignService } from '../server/sign/envelopes.js';
import { createLocalStore } from '../server/sign/store-local.js';

export const SENDER = { email: 'johnsonjiang@solariavc.com', name: 'Johnson Jiang' };
export const INFO = { ip: '203.0.113.7', ua: 'test-agent' };

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

export function makePng(width = 40, height = 16) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const row = Buffer.alloc(width * 4 + 1);
  for (let x = 0; x < width; x++) row.set([20, 33, 61, 255], 1 + x * 4);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export const mark = (name = 'Signer') => ({
  dataUrl: `data:image/png;base64,${makePng().toString('base64')}`,
  method: 'draw',
  name,
});

export async function makePdf(pages = 2) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([612, 792]);
    page.drawText(`Agreement page ${i + 1}`, { x: 72, y: 700, size: 14, font });
  }
  return Buffer.from(await doc.save());
}

export function harness(t, { tsaUrls = [] } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'solaria-sign-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const store = createLocalStore(dir);
  const sent = [];
  const config = { baseUrl: 'https://sign.test', tsaUrls };
  let failMail = () => false;
  const mail = async (message) => {
    if (failMail(message)) throw new Error('mail failed');
    sent.push(message);
    return `m${sent.length}`;
  };
  const log = { error() {}, log() {} };
  const svc = createSignService({ store, config, mail, log });
  return { svc, store, sent, failMailWhen: (fn) => { failMail = fn; } };
}

export const linkIn = (message) => /\/s#(\S+)/.exec(message.text)?.[1];

// A two-signer document with a signature field each, ready to send.
export async function draft(svc, { recipients, sequential = false, fields } = {}) {
  const created = await svc.createDraft(SENDER, 'Subscription Agreement.pdf', await makePdf(), INFO);
  const people = recipients ?? [
    { id: 'a', name: 'Ada Investor', email: 'ada@example.com' },
    { id: 'b', name: 'Karl Partner', email: 'karl@example.com' },
  ];
  const updated = await svc.updateDraft(created.id, {
    title: 'Subscription Agreement',
    message: 'Please sign.',
    sequential,
    expiryDays: 30,
    recipients: people,
    fields: fields ?? people.filter((p) => p.role !== 'cc').map((p, i) => ({
      recipientId: p.id, type: 'signature', page: 1, x: 0.1, y: 0.5 + i * 0.1, w: 0.3, h: 0.05,
    })),
  });
  return updated;
}

// Walks one signer through the whole ceremony.
export async function signAs(svc, token, { verified, name = 'Signer', values = {} } = {}) {
  await svc.recordViewed(token, verified, INFO);
  await svc.recordConsent(token, verified, { version: '2026-10-31', previewed: true }, INFO);
  return svc.submit(token, verified, { intent: true, signature: mark(name), values, timeZone: 'America/Los_Angeles' }, INFO);
}
