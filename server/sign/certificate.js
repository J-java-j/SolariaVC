// The certificate of completion appended to every signed document: who signed, how
// they were identified, what they agreed to, and the event history, in one place a
// custodian can stand behind. It lives inside the file, so it travels with every copy.
import { rgb } from 'pdf-lib';
import { ORG } from './config.js';
import { formatEnvelopeId } from './crypto.js';
import { DISCLOSURE, DISCLOSURE_SHA256, INTENT, INTENT_SHA256 } from './disclosure.js';

const INK = rgb(0.09, 0.1, 0.1);
const MUTED = rgb(0.4, 0.42, 0.42);
const GREEN = rgb(0.184, 0.322, 0.286);
const RULE = rgb(0.86, 0.87, 0.86);

const PAGE = { width: 612, height: 792, margin: 48 };
const WIDTH = PAGE.width - PAGE.margin * 2;

export const EVENT_LABELS = {
  'envelope.created': 'Document uploaded',
  'envelope.sent': 'Sent for signature',
  'envelope.voided': 'Voided by sender',
  'envelope.expired': 'Expired',
  'envelope.completed': 'Completed',
  'envelope.deleted': 'Moved to Deleted',
  'envelope.restored': 'Restored from Deleted',
  'recipient.notified': 'Signing link emailed',
  'recipient.notify_failed': 'Signing link email failed',
  'recipient.reminded': 'Reminder emailed',
  'recipient.link_issued': 'Signing link issued to sender',
  'recipient.code_sent': 'Verification code emailed',
  'recipient.code_failed': 'Wrong verification code entered',
  'recipient.identity_verified': 'Email code verified',
  'recipient.viewed': 'Opened document',
  'recipient.consented': 'Agreed to electronic records',
  'recipient.signed': 'Signed',
  'recipient.declined': 'Declined to sign',
  'recipient.paper_requested': 'Asked for paper instead',
  'copy.sent': 'Completed copy emailed',
  'copy.failed': 'Completed copy email failed',
  'document.sealed': 'Sealed',
  'document.timestamped': 'Independent timestamp added',
};

export const formatTime = (iso) => (iso ? iso.replace('T', ' ').replace(/(\.\d+)?Z$/, ' UTC') : '');

class Sheet {
  constructor(doc, ts, footer) {
    Object.assign(this, { doc, ts, footer });
    this.page = null;
    this.y = 0;
    this.addPage();
  }

  addPage() {
    this.page = this.doc.addPage([PAGE.width, PAGE.height]);
    this.y = PAGE.height - PAGE.margin;
    this.ts.draw(this.page, this.footer, { x: PAGE.margin, y: 30, size: 7, color: MUTED });
  }

  ensure(height) {
    if (this.y - height < 48) this.addPage();
  }

  text(value, { x = PAGE.margin, size = 9, bold = false, color = INK, width = WIDTH, lead = 1.4, advance = true } = {}) {
    const lines = this.ts.wrap(value, size, width, bold);
    let y = this.y;
    for (const line of lines) {
      this.ts.draw(this.page, line, { x, y: y - size, size, bold, color });
      y -= size * lead;
    }
    if (advance) this.y = y;
    return this.y - y;
  }

  rule(gap = 8) {
    this.page.drawLine({
      start: { x: PAGE.margin, y: this.y },
      end: { x: PAGE.width - PAGE.margin, y: this.y },
      thickness: 0.5,
      color: RULE,
    });
    this.y -= gap;
  }

  heading(value) {
    this.ensure(44);
    this.y -= 12;
    this.text(value, { size: 9, bold: true, color: GREEN });
    this.y -= 3;
    this.rule();
  }

  row(label, value) {
    const lines = this.ts.wrap(value, 9, WIDTH - 120);
    this.ensure(lines.length * 12.6 + 3);
    this.text(label, { size: 8.5, color: MUTED, advance: false });
    this.text(value, { x: PAGE.margin + 120, width: WIDTH - 120 });
    this.y -= 2;
  }
}

function identityLine(rec) {
  const route = rec.delivery === 'email' ? 'Signing link emailed to this address' : 'Signing link shared by the sender';
  return rec.verifiedAt ? `${route}. Emailed code verified ${formatTime(rec.verifiedAt)}.` : `${route}.`;
}

function signerBlock(sheet, rec, images) {
  const image = images.get(`${rec.id}:signature`);
  sheet.ensure(112);
  const top = sheet.y;

  sheet.text(rec.name, { size: 10.5, bold: true, width: WIDTH - 190 });
  sheet.text(rec.email, { size: 8.5, color: MUTED, width: WIDTH - 190 });
  if (image) {
    const scale = Math.min(170 / image.width, 44 / image.height);
    sheet.page.drawImage(image, {
      x: PAGE.width - PAGE.margin - image.width * scale,
      y: top - 46,
      width: image.width * scale,
      height: image.height * scale,
    });
  }
  sheet.y = Math.min(sheet.y, top - 48);
  sheet.row('Signed', `${formatTime(rec.signedAt)}${rec.timeZone ? ` (signer's time zone ${rec.timeZone})` : ''}`);
  sheet.row('Signature', `${rec.signature.method === 'draw' ? 'Drawn' : 'Typed'} and adopted as "${rec.signature.name}"`);
  sheet.row('Identity', identityLine(rec));
  sheet.row('Opened', formatTime(rec.viewedAt));
  sheet.row('Consent', `Electronic records disclosure version ${rec.consent.version} accepted ${formatTime(rec.consent.at)}`);
  sheet.row('IP address', rec.ip || 'Not recorded');
  sheet.row('Browser', rec.ua || 'Not recorded');
  sheet.y -= 6;
  sheet.rule(10);
}

function eventTable(sheet, env) {
  const names = new Map(env.recipients.map((r) => [r.id, r.name]));
  const columns = [
    { x: 0, width: 104 },
    { x: 108, width: 156 },
    { x: 268, width: 132 },
    { x: 404, width: 112 },
  ];
  const line = (cells, style) => {
    const wrapped = cells.map((c, i) => sheet.ts.wrap(c, 7.5, columns[i].width));
    const height = Math.max(...wrapped.map((w) => w.length)) * 10.5;
    sheet.ensure(height + 3);
    cells.forEach((c, i) => {
      sheet.text(c, { x: PAGE.margin + columns[i].x, width: columns[i].width, size: 7.5, lead: 1.4, advance: false, ...style });
    });
    sheet.y -= height + 2;
  };
  line(['Time (UTC)', 'Event', 'By', 'IP address'], { color: MUTED, bold: true });
  for (const e of env.events) {
    const who = e.actor?.recipientId ? names.get(e.actor.recipientId) : e.actor?.email;
    line([formatTime(e.at).replace(' UTC', ''), EVENT_LABELS[e.type] ?? e.type, who ?? 'Solaria Sign', e.ip ?? ''], {});
  }
}

export async function addCertificate(doc, ts, env, images) {
  const reference = formatEnvelopeId(env.id);
  const sheet = new Sheet(doc, ts, `Certificate of completion. Solaria Sign reference ${reference}.`);

  sheet.text('Certificate of Completion', { size: 20, bold: true, color: GREEN, lead: 1.25 });
  sheet.text(`Solaria Sign, operated by ${ORG.legalName}`, { size: 9, color: MUTED });
  sheet.y -= 10;

  sheet.heading('Document');
  sheet.row('Title', env.title);
  sheet.row('Reference', reference);
  sheet.row('File', `${env.document.fileName}, ${env.document.pages} page${env.document.pages === 1 ? '' : 's'}`);
  sheet.row('Original SHA-256', env.document.sha256);
  sheet.row('Sent by', `${env.sender.name} <${env.sender.email}>`);
  sheet.row('Sent', formatTime(env.sentAt));
  sheet.row('Signing order', env.sequential ? 'In the order listed' : 'Any order');

  const signers = env.recipients.filter((r) => r.role === 'signer');
  sheet.heading(`Signers (${signers.length})`);
  for (const rec of signers) signerBlock(sheet, rec, images);

  const copies = env.recipients.filter((r) => r.role === 'cc');
  if (copies.length) {
    sheet.heading('Receiving a copy');
    for (const rec of copies) sheet.row(rec.name, rec.email);
  }

  sheet.heading('Event history');
  eventTable(sheet, env);

  sheet.heading('How to check this document');
  sheet.row('Event chain', env.events.at(-1).hash);
  sheet.text(
    'Each event above is hash-chained to the one before it, and the value shown is the end of that chain. ' +
    'Once sealed, this file carries a timestamp signed by an independent certificate authority covering ' +
    'every byte, so any later change invalidates it. Drop the file on solariavc.com/sign/verify, or check ' +
    'the timestamp in a PDF reader that shows digital signatures. The SHA-256 of the sealed file cannot ' +
    'appear inside the file itself; it was emailed to each party with their copy.',
    { size: 8.5, color: MUTED },
  );

  sheet.addPage();
  sheet.text(DISCLOSURE.title, { size: 14, bold: true, color: GREEN, lead: 1.3 });
  sheet.text(`The disclosure each signer accepted. Version ${DISCLOSURE.version}. SHA-256 ${DISCLOSURE_SHA256}`, { size: 7.5, color: MUTED });
  sheet.y -= 8;
  sheet.text(DISCLOSURE.intro, { size: 9 });
  for (const { heading, body } of DISCLOSURE.sections) {
    sheet.ensure(50);
    sheet.y -= 6;
    sheet.text(heading, { size: 9.5, bold: true });
    sheet.text(body, { size: 9 });
  }
  sheet.ensure(90);
  sheet.y -= 6;
  sheet.text('Confirmation given by each signer', { size: 9.5, bold: true });
  sheet.text(DISCLOSURE.agreement, { size: 9 });
  sheet.y -= 6;
  sheet.text('Signing statements', { size: 9.5, bold: true });
  sheet.text(INTENT.adopt, { size: 9 });
  sheet.y -= 3;
  sheet.text(INTENT.finish, { size: 9 });
  sheet.text(`Version ${INTENT.version}. SHA-256 ${INTENT_SHA256}`, { size: 7.5, color: MUTED });
}
