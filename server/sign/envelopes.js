// The signing lifecycle. An envelope moves draft -> sent -> completed, or stops at
// declined, voided or expired. Every change goes through mutate(), which re-reads,
// applies and writes conditionally, so concurrent signers can't lose each other's
// work or fork the audit chain. Mutators run more than once under contention, so
// they only touch the envelope; email and file writes happen outside them.
import { ORG, OWNERS, EXPIRY_DAYS, LIMITS, TIMES } from './config.js';
import {
  appendEvent, canonicalJson, formatEnvelopeId, hashesEqual, newCode, newEnvelopeId, newId,
  randomSecret, sha256Hex, verifyChain,
} from './crypto.js';
import { DISCLOSURE, DISCLOSURE_SHA256, DISCLOSURE_VERSION, INTENT, INTENT_SHA256, INTENT_VERSION } from './disclosure.js';
import { EVENT_LABELS } from './certificate.js';
import {
  codeEmail, completedEmail, declinedEmail, inviteEmail, loginEmail, nextSignerEmail, signRequestEmail, voidedEmail,
} from './mail.js';
import { assertEmbeddablePng, inspectPdf, sealDocument, timestampFile } from './pdf.js';
import { ConflictError } from './store-local.js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FIELD_TYPES = new Set(['signature', 'initials', 'date', 'name', 'text', 'checkbox']);
const MIN_FIELD = 0.005;
const RECIPIENT_ID = /^r[0-9a-f]{10}$/;
const ENVELOPE_ID = /^[0-9A-Z]{12}$/;
const FOLDER_ID = /^d[0-9a-f]{10}$/;
const ALWAYS_REQUIRED = new Set(['signature', 'initials', 'date', 'name']);
const INVALID_LINK = 'This signing link is not valid. Ask the sender for a new one.';

const nowIso = () => new Date().toISOString();
const signersOf = (env) => env.recipients.filter((r) => r.role === 'signer');
const allSigned = (env) => signersOf(env).every((r) => r.status === 'signed');
const isExpired = (env) => env.status === 'sent' && !env.sealed && !allSigned(env) && Date.now() > Date.parse(env.expiresAt);
const effectiveStatus = (env) => (isExpired(env) ? 'expired' : env.status);
const senderActor = (sender) => ({ kind: 'sender', email: sender.email });
const signerActor = (rec) => ({ kind: 'recipient', recipientId: rec.id });

function maskEmail(email) {
  const [name, domain] = email.split('@');
  return `${name.slice(0, 2)}${'•'.repeat(Math.max(1, Math.min(name.length - 2, 6)))}@${domain}`;
}

function cleanText(value, max, label, { required = false } = {}) {
  const text = String(value ?? '').trim();
  if (required && !text) throw new HttpError(400, `${label} is required.`);
  if (text.length > max) throw new HttpError(400, `${label} is too long.`);
  return text;
}

function issueToken(env, rec) {
  const secret = randomSecret();
  rec.tokenHashes = [...(rec.tokenHashes ?? []).slice(-4), sha256Hex(secret)];
  return `${env.id}.${rec.id}.${secret}`;
}

function parseToken(token) {
  const m = /^([0-9A-Z]{12})\.(r[0-9a-f]{10})\.([\w-]{43})$/.exec(token ?? '');
  if (!m) throw new HttpError(404, INVALID_LINK);
  return { envelopeId: m[1], recipientId: m[2], secret: m[3] };
}

// Drafts save as people type, so a half-finished address is fine until send.
function draftRecipients(input) {
  if (!Array.isArray(input)) throw new HttpError(400, 'Recipients are required.');
  if (input.length > LIMITS.recipients) throw new HttpError(400, `An envelope can have ${LIMITS.recipients} recipients at most.`);
  const taken = new Set();
  return input.map((r, i) => {
    const delivery = r.delivery === 'link' ? 'link' : 'email';
    const id = RECIPIENT_ID.test(r.id) && !taken.has(r.id) ? r.id : newId('r');
    taken.add(id);
    return {
      id,
      name: cleanText(r.name, 120, 'Recipient name'),
      email: cleanText(r.email, 200, 'Recipient email').toLowerCase(),
      role: r.role === 'cc' ? 'cc' : 'signer',
      order: i + 1,
      delivery,
      // A bare link proves nothing about who opened it, so it always needs a code.
      requireCode: delivery === 'link' || r.requireCode === true,
      status: 'draft',
    };
  });
}

function validFields(input, recipients, pages) {
  if (!Array.isArray(input)) throw new HttpError(400, 'Fields are required.');
  if (input.length > LIMITS.fields) throw new HttpError(400, `An envelope can have ${LIMITS.fields} fields at most.`);
  const signers = new Set(recipients.filter((r) => r.role === 'signer').map((r) => r.id));
  return input.flatMap((f) => {
    // A field whose signer was removed in the same edit goes with them.
    if (!signers.has(f.recipientId)) return [];
    if (!FIELD_TYPES.has(f.type)) throw new HttpError(400, 'Unknown field type.');
    const page = Number(f.page);
    const [x, y, w, h] = [f.x, f.y, f.w, f.h].map(Number);
    if (!Number.isInteger(page) || page < 1 || page > pages) throw new HttpError(400, 'A field is on a page that does not exist.');
    if (![x, y, w, h].every(Number.isFinite) || x < 0 || y < 0 || w < MIN_FIELD || h < MIN_FIELD || x + w > 1.0001 || y + h > 1.0001) {
      throw new HttpError(400, 'A field is outside the page.');
    }
    return [{
      id: typeof f.id === 'string' && /^f[0-9a-f]{10}$/.test(f.id) ? f.id : newId('f'),
      recipientId: f.recipientId,
      type: f.type,
      page,
      x, y, w, h,
      required: ALWAYS_REQUIRED.has(f.type) || f.required !== false,
      label: cleanText(f.label, 60, 'Field label'),
    }];
  });
}

function assertReadyToSend(env) {
  if (!env.title) throw new HttpError(400, 'Add a title first.');
  const signers = signersOf(env);
  if (!signers.length) throw new HttpError(400, 'Add at least one signer.');
  const seen = new Set();
  for (const rec of env.recipients) {
    if (!rec.name || !rec.email) throw new HttpError(400, 'Every recipient needs a name and an email address.');
    if (!EMAIL_RE.test(rec.email)) throw new HttpError(400, `"${rec.email}" is not a valid email address.`);
    if (seen.has(rec.email)) throw new HttpError(400, `${rec.email} is listed twice.`);
    seen.add(rec.email);
  }
  for (const rec of signers) {
    if (!env.fields.some((f) => f.recipientId === rec.id && f.type === 'signature')) {
      throw new HttpError(400, `Place a signature field for ${rec.name}.`);
    }
  }
}

// Copies from one bulk send share a batch, so the documents list can show them as one row.
// Older copies only carry it on their first event.
function batchOf(env) {
  if (env.batch) return env.batch;
  const first = env.events?.[0]?.details;
  return first?.batch ? { id: first.batch, size: first.of } : null;
}

// A pasted list of people for a bulk send. Rows that repeat an address are refused
// rather than dropped, so nobody is left out without the sender seeing why.
function bulkList(input) {
  if (!Array.isArray(input) || !input.length) throw new HttpError(400, 'Add at least one person to the list.');
  if (input.length > LIMITS.bulk) throw new HttpError(400, `A list can have ${LIMITS.bulk} people at most. Send the rest in a second batch.`);
  const seen = new Set();
  return input.map((p, i) => {
    const name = cleanText(p?.name, 120, `Name on row ${i + 1}`, { required: true });
    const email = cleanText(p?.email, 200, `Email on row ${i + 1}`, { required: true }).toLowerCase();
    if (!EMAIL_RE.test(email)) throw new HttpError(400, `"${email}" on row ${i + 1} is not a valid email address.`);
    if (seen.has(email)) throw new HttpError(400, `${email} is on the list twice.`);
    seen.add(email);
    return { name, email };
  });
}

const LIST_LIMIT = 500;

export function createSignService({ store, config, mail, log = console }) {
  const signerUrl = (token) => `${config.baseUrl}/s#${token}`;
  const adminUrl = (id) => `${config.baseUrl}/sign/e/${id}`;

  async function mutate(id, apply) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const current = await store.getEnvelope(id);
      if (!current) throw new HttpError(404, 'Document not found.');
      const env = current.data;
      const result = await apply(env);
      if (result === undefined || result?.save !== false) {
        try {
          await store.saveEnvelope(env, current.rev);
        } catch (e) {
          if (e instanceof ConflictError) continue;
          throw e;
        }
      }
      return { env, result };
    }
    throw new HttpError(503, 'This document is busy. Please try again.');
  }

  // Marks signers at the next position as active, and returns who needs telling.
  function activateNext(env) {
    const pending = signersOf(env).filter((r) => r.status !== 'signed');
    if (!pending.length) return [];
    const order = Math.min(...pending.map((r) => r.order));
    const now = nowIso();
    const notices = [];
    for (const rec of pending) {
      if (rec.order !== order || rec.status !== 'waiting') continue;
      rec.status = 'sent';
      rec.sentAt = now;
      notices.push(rec.delivery === 'email'
        ? { recipientId: rec.id, token: issueToken(env, rec) }
        : { recipientId: rec.id, handoff: true });
    }
    return notices;
  }

  async function deliver(id, env, notices, { reminder = false } = {}) {
    const outcomes = await Promise.all(notices.map(async (notice) => {
      const rec = env.recipients.find((r) => r.id === notice.recipientId);
      try {
        if (notice.handoff) {
          await mail({ to: env.sender.email, ...nextSignerEmail({ env, rec, url: adminUrl(env.id) }) });
          return null;
        }
        const message = signRequestEmail({ env, rec, url: signerUrl(notice.token), reminder });
        return { rec, messageId: await mail({ to: rec.email, ...message }), ok: true };
      } catch (e) {
        log.error('[sign] request email failed:', e.message);
        return { rec, ok: false };
      }
    }));
    const results = outcomes.filter(Boolean);
    if (results.length) {
      await mutate(id, (fresh) => {
        for (const { rec, ok, messageId } of results) {
          const type = !ok ? 'recipient.notify_failed' : reminder ? 'recipient.reminded' : 'recipient.notified';
          appendEvent(fresh, type, {
            actor: signerActor(rec),
            details: { to: rec.email, ...(messageId ? { messageId } : {}) },
          });
        }
      });
    }
    return results;
  }

  async function authorizeSigner(token, verifiedSecret) {
    const { envelopeId, recipientId, secret } = parseToken(token);
    const current = await store.getEnvelope(envelopeId);
    const rec = current?.data.recipients.find((r) => r.id === recipientId);
    const hash = sha256Hex(secret);
    const signing = rec?.tokenHashes?.some((h) => hashesEqual(h, hash));
    const copy = rec?.copyTokenHashes?.some((h) => hashesEqual(h, hash));
    if (!signing && !copy) throw new HttpError(404, INVALID_LINK);
    const verified = !rec.requireCode || Boolean(
      verifiedSecret && rec.verified && Date.now() < Date.parse(rec.verified.until) &&
      hashesEqual(rec.verified.hash, sha256Hex(verifiedSecret)),
    );
    return { env: current.data, rec, copyOnly: !signing, verified };
  }

  function signerState(env, rec, copyOnly) {
    const status = effectiveStatus(env);
    if (status === 'voided' || status === 'expired' || status === 'declined' || status === 'completed') return status;
    if (copyOnly) return 'unavailable';
    if (rec.role !== 'signer') return 'unavailable';
    if (rec.status === 'signed') return allSigned(env) ? 'sealing' : 'signed';
    if (rec.status === 'waiting') return 'waiting';
    return 'sign';
  }

  function requireActiveSigner(env, recipientId) {
    const rec = env.recipients.find((r) => r.id === recipientId);
    const state = signerState(env, rec, false);
    if (state !== 'sign') throw new HttpError(409, 'This document can no longer be signed from this link.');
    return rec;
  }

  async function signerAccess(token, verifiedSecret) {
    const access = await authorizeSigner(token, verifiedSecret);
    if (!access.verified) throw new HttpError(403, 'Enter the code we emailed you first.');
    return access;
  }

  async function dataUrl(key) {
    const bytes = await store.getBlob(key);
    return bytes ? `data:image/png;base64,${bytes.toString('base64')}` : null;
  }

  // What has already been placed by earlier signers, so nobody signs blind.
  async function othersFilled(env, rec) {
    const marks = new Map();
    for (const other of signersOf(env)) {
      if (other.id === rec.id || other.status !== 'signed') continue;
      marks.set(`${other.id}:signature`, await dataUrl(other.signature.key));
      if (other.initials) marks.set(`${other.id}:initials`, await dataUrl(other.initials.key));
    }
    return env.fields
      .filter((f) => f.recipientId !== rec.id && env.recipients.find((r) => r.id === f.recipientId)?.status === 'signed')
      .map(({ id, type, page, x, y, w, h, value, recipientId }) => ({
        id, type, page, x, y, w, h, value,
        image: type === 'signature' || type === 'initials' ? marks.get(`${recipientId}:${type}`) : undefined,
      }));
  }

  async function parseMark(mark, label) {
    const m = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(mark?.dataUrl ?? '');
    if (!m) throw new HttpError(400, `${label} is missing.`);
    const bytes = Buffer.from(m[1], 'base64');
    if (!bytes.length || bytes.length > LIMITS.signatureBytes) throw new HttpError(400, `${label} image is too large.`);
    try {
      await assertEmbeddablePng(bytes);
    } catch {
      throw new HttpError(400, `${label} image could not be read.`);
    }
    return { bytes, method: mark.method === 'type' ? 'type' : 'draw', name: cleanText(mark.name, 120, 'Your name', { required: true }) };
  }

  function validateValues(fields, values) {
    const clean = {};
    for (const f of fields) {
      const value = values?.[f.id];
      if (f.type === 'text') {
        const text = cleanText(value, LIMITS.textValue, f.label || 'This field');
        if (f.required && !text) throw new HttpError(400, `${f.label || 'A required field'} still needs filling in.`);
        clean[f.id] = text;
      } else if (f.type === 'checkbox') {
        if (f.required && value !== true) throw new HttpError(400, 'A required box still needs ticking.');
        clean[f.id] = value === true;
      }
    }
    return clean;
  }

  function signingDate(timeZone) {
    const format = (tz) => new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: tz }).format(new Date());
    try {
      return { date: format(timeZone), zone: timeZone };
    } catch {
      return { date: format('UTC'), zone: 'UTC' };
    }
  }

  async function deliverCopies(id) {
    const issued = new Map();
    const { env } = await mutate(id, (fresh) => {
      if (!fresh.sealed) return { save: false };
      issued.clear();
      for (const rec of fresh.recipients) {
        if (rec.copySentAt) continue;
        const secret = randomSecret();
        rec.copyTokenHashes = [...(rec.copyTokenHashes ?? []).slice(-2), sha256Hex(secret)];
        issued.set(rec.id, `${fresh.id}.${rec.id}.${secret}`);
      }
      return { save: issued.size > 0 };
    });
    if (!env.sealed) return;

    const needSender = !env.senderCopySentAt;
    if (!issued.size && !needSender) return;
    const pdf = await store.getBlob(env.sealed.key);
    const attached = pdf.length <= LIMITS.attachmentBytes;
    const fileName = `${env.title.replace(/[^\p{L}\p{N} ._-]+/gu, '').trim().slice(0, 80) || 'Signed document'} - signed.pdf`;
    const attachments = attached ? [{ filename: fileName, content: pdf.toString('base64') }] : undefined;
    const outcome = async (to, message) => {
      try {
        await mail({ to, ...message, attachments });
        return true;
      } catch (e) {
        log.error('[sign] copy email failed:', e.message);
        return false;
      }
    };

    const sends = [...issued].map(async ([recipientId, token]) => {
      const rec = env.recipients.find((r) => r.id === recipientId);
      const ok = await outcome(rec.email, completedEmail({ env, url: signerUrl(token), sha256: env.sealed.sha256, attached }));
      return { recipientId, ok };
    });
    const senderSend = needSender
      ? outcome(env.sender.email, completedEmail({ env, url: adminUrl(env.id), sha256: env.sealed.sha256, attached, recipientIsSender: true }))
      : Promise.resolve(false);
    const [results, senderOk] = await Promise.all([Promise.all(sends), senderSend]);

    await mutate(id, (fresh) => {
      const at = nowIso();
      for (const { recipientId, ok } of results) {
        const rec = fresh.recipients.find((r) => r.id === recipientId);
        if (ok) rec.copySentAt = at;
        appendEvent(fresh, ok ? 'copy.sent' : 'copy.failed', {
          actor: signerActor(rec),
          details: { to: rec.email, attached, sha256: fresh.sealed.sha256 },
        });
      }
      if (needSender) {
        if (senderOk) fresh.senderCopySentAt = at;
        appendEvent(fresh, senderOk ? 'copy.sent' : 'copy.failed', {
          actor: { kind: 'sender', email: fresh.sender.email },
          details: { to: fresh.sender.email, attached, sha256: fresh.sealed.sha256 },
        });
      }
    });
  }

  async function finalize(id) {
    const attempt = randomSecret().slice(0, 12);
    const { env, result: claim } = await mutate(id, (fresh) => {
      if (fresh.sealed) return { state: 'done', save: false };
      if (fresh.status !== 'sent' || !allSigned(fresh)) return { state: 'not-ready', save: false };
      if (fresh.sealing && Date.now() < Date.parse(fresh.sealing.until)) return { state: 'busy', save: false };
      fresh.sealing = { attempt, until: new Date(Date.now() + TIMES.sealLease).toISOString() };
      return { state: 'claimed' };
    });
    if (claim.state === 'done') {
      await deliverCopies(id);
      return;
    }
    if (claim.state !== 'claimed') return;

    try {
      const original = await store.getBlob(env.document.key);
      if (!original || sha256Hex(original) !== env.document.sha256) {
        throw new Error('stored original does not match its recorded hash');
      }
      const images = new Map();
      for (const rec of signersOf(env)) {
        images.set(`${rec.id}:signature`, await store.getBlob(rec.signature.key));
        if (rec.initials) images.set(`${rec.id}:initials`, await store.getBlob(rec.initials.key));
      }

      const sealed = await sealDocument(env, original, images, config.tsaUrls);
      if (!sealed.token) log.error('[sign] sealed without timestamp:', sealed.failures.join('; '));
      // Each attempt writes its own object, and only the one the envelope commits
      // to below counts. Stored files are write-once, so a retry must not reuse a name.
      const key = `envelopes/${id}/sealed-${attempt}.pdf`;
      await store.putBlob(key, sealed.pdf, 'application/pdf');
      const tokenKey = sealed.token ? `envelopes/${id}/sealed-${attempt}.tsr` : null;
      if (tokenKey) await store.putBlob(tokenKey, sealed.token, 'application/timestamp-reply');
      const sha256 = sha256Hex(sealed.pdf);

      await mutate(id, (fresh) => {
        if (fresh.sealed) return { save: false };
        const at = nowIso();
        fresh.sealed = { key, sha256, bytes: sealed.pdf.length, tokenKey, timestamp: sealed.timestamp, at };
        fresh.status = 'completed';
        fresh.completedAt = at;
        fresh.sealing = null;
        fresh.sealError = null;
        appendEvent(fresh, 'document.sealed', {
          details: {
            sha256,
            ...(sealed.timestamp ? { timestampAuthority: sealed.timestamp.tsa, timestampTime: sealed.timestamp.genTime } : { timestamp: 'pending' }),
          },
        });
        appendEvent(fresh, 'envelope.completed', { details: { sealedSha256: sha256 } });
      });
      await store.putRecord('hashes', sha256, { envelopeId: id });
    } catch (e) {
      log.error('[sign] sealing failed:', e);
      await mutate(id, (fresh) => {
        if (fresh.sealing?.attempt === attempt) {
          fresh.sealing = null;
          fresh.sealError = 'Sealing did not finish. All signatures are safe; try again.';
        } else {
          return { save: false };
        }
      });
      return;
    }
    await deliverCopies(id);
  }

  function publicRecipient(rec) {
    const { tokenHashes, copyTokenHashes, otp, otpSends, verified, ...rest } = rec;
    return rest;
  }

  function adminView(env, { full = true } = {}) {
    const names = new Map(env.recipients.map((r) => [r.id, r.name]));
    const summary = {
      id: env.id,
      reference: formatEnvelopeId(env.id),
      title: env.title,
      status: effectiveStatus(env),
      sealing: allSigned(env) && env.status === 'sent' && signersOf(env).length > 0,
      createdAt: env.createdAt,
      sentAt: env.sentAt,
      completedAt: env.completedAt,
      expiresAt: env.expiresAt,
      sender: env.sender,
      recipients: env.recipients.map(publicRecipient),
      folderId: env.folderId ?? null,
      deletedAt: env.deletedAt ?? null,
      batch: batchOf(env),
      sha256: env.document.sha256,
    };
    if (!full) return summary;
    return {
      ...summary,
      message: env.message,
      sequential: env.sequential,
      expiryDays: env.expiryDays,
      document: env.document,
      fields: env.fields,
      sealed: env.sealed,
      sealError: env.sealError ?? null,
      chainValid: verifyChain(env.events),
      events: env.events.map((e) => ({
        seq: e.seq,
        at: e.at,
        type: e.type,
        label: EVENT_LABELS[e.type] ?? e.type,
        by: e.actor?.recipientId ? names.get(e.actor.recipientId) : e.actor?.email ?? 'Solaria Sign',
        ip: e.ip,
        ua: e.ua,
        details: e.details,
        hash: e.hash,
      })),
    };
  }

  async function requireEnvelope(id) {
    const current = await store.getEnvelope(id);
    if (!current) throw new HttpError(404, 'Document not found.');
    return current.data;
  }

  async function findSender(email) {
    const owner = OWNERS.get(email);
    if (owner) return { ...owner, owner: true };
    const admin = await store.getRecord('admins', sha256Hex(email));
    return admin ? { name: admin.name, title: admin.title, owner: false } : null;
  }

  function requireOwner(user) {
    if (!user.owner) throw new HttpError(403, 'Only the owner can manage the team.');
  }

  async function requireFolder(id) {
    const folder = FOLDER_ID.test(id) ? await store.getRecord('folders', id) : null;
    if (!folder) throw new HttpError(404, 'That folder no longer exists.');
    return folder;
  }

  async function cleanFolderName(input, ownId) {
    const name = cleanText(input, LIMITS.folderName, 'Folder name', { required: true });
    const folders = await store.listRecords('folders');
    if (folders.some((f) => f.id !== ownId && f.name.toLowerCase() === name.toLowerCase())) {
      throw new HttpError(409, `There is already a folder called ${name}.`);
    }
    return name;
  }

  function selection(ids) {
    if (!Array.isArray(ids) || !ids.length || ids.length > LIMITS.selection || !ids.every((id) => ENVELOPE_ID.test(id))) {
      throw new HttpError(400, 'Choose at least one document.');
    }
    return [...new Set(ids)];
  }

  async function cloneEnvelope(source, sender, info, { swap = null, details = {} } = {}) {
    const copyId = newEnvelopeId();
    const key = `envelopes/${copyId}/original.pdf`;
    await store.copyBlob(source.document.key, key);
    const ids = new Map(source.recipients.map((r) => [r.id, newId('r')]));
    const env = {
      id: copyId,
      title: source.title,
      message: source.message,
      status: 'draft',
      sequential: source.sequential,
      expiryDays: source.expiryDays,
      createdAt: nowIso(),
      sender: { email: sender.email, name: sender.name },
      document: { ...source.document, key },
      recipients: source.recipients.map((r) => ({
        id: ids.get(r.id),
        name: swap?.id === r.id ? swap.name : r.name,
        email: swap?.id === r.id ? swap.email : r.email,
        role: r.role,
        order: r.order,
        delivery: r.delivery,
        requireCode: r.requireCode,
        status: 'draft',
      })),
      fields: source.fields.map(({ id: _id, value, ...f }) => ({ ...f, id: newId('f'), recipientId: ids.get(f.recipientId) })),
      sealed: null,
      events: [],
      folderId: source.folderId ?? null,
      ...(details.batch ? { batch: { id: details.batch, size: details.of } } : {}),
    };
    appendEvent(env, 'envelope.created', {
      actor: senderActor(sender),
      ...info,
      details: { sha256: env.document.sha256, fileName: env.document.fileName, copiedFrom: source.id, ...details },
    });
    await store.createEnvelope(env);
    return env;
  }

  // The signing step shared by a signer's link and the sender's own documents
  // page: fills the signer's fields, stores their marks, and moves the document on.
  async function signFor(env, rec, body, info, { before, signedDetails = {} } = {}) {
    const recipientId = rec.id;
    const own = env.fields.filter((f) => f.recipientId === rec.id);
    const values = validateValues(own, body.values);
    const signature = await parseMark(body.signature, 'Your signature');
    const initials = own.some((f) => f.type === 'initials') ? await parseMark(body.initials, 'Your initials') : null;

    const suffix = randomSecret().slice(0, 8);
    const signatureKey = `envelopes/${env.id}/marks/${rec.id}-signature-${suffix}.png`;
    await store.putBlob(signatureKey, signature.bytes, 'image/png');
    const initialsKey = initials ? `envelopes/${env.id}/marks/${rec.id}-initials-${suffix}.png` : null;
    if (initials) await store.putBlob(initialsKey, initials.bytes, 'image/png');

    const { date, zone } = signingDate(String(body.timeZone ?? ''));
    let notices = [];
    const { env: saved, result } = await mutate(env.id, (e) => {
      const r = requireActiveSigner(e, recipientId);
      before?.(e, r);
      const fields = e.fields.filter((f) => f.recipientId === r.id);
      for (const f of fields) {
        if (f.type === 'date') f.value = date;
        else if (f.type === 'name') f.value = signature.name;
        else if (f.type === 'text' || f.type === 'checkbox') f.value = values[f.id];
        else f.value = true;
      }
      r.status = 'signed';
      r.signedAt = nowIso();
      r.ip = info.ip;
      r.ua = info.ua;
      r.timeZone = zone;
      r.signature = { key: signatureKey, sha256: sha256Hex(signature.bytes), method: signature.method, name: signature.name };
      if (initials) r.initials = { key: initialsKey, sha256: sha256Hex(initials.bytes), method: initials.method };
      r.otp = null;
      appendEvent(e, 'recipient.signed', {
        actor: signerActor(r),
        ...info,
        details: {
          documentSha256: e.document.sha256,
          fieldsSha256: sha256Hex(canonicalJson(fields.map(({ id, type, page, x, y, w, h, value }) => ({ id, type, page, x, y, w, h, value })))),
          signatureSha256: r.signature.sha256,
          disclosureVersion: r.consent.version,
          intentVersion: INTENT_VERSION,
          intentSha256: INTENT_SHA256,
          timeZone: zone,
          ...signedDetails,
        },
      });
      notices = activateNext(e);
      return { complete: allSigned(e) };
    });
    await deliver(env.id, saved, notices);
    if (result.complete) await finalize(env.id);
  }

  return {
    // ---- sign in ----------------------------------------------------------
    // Answers identically for unknown addresses, so nobody can probe who has access.
    async requestLogin(emailInput) {
      const email = String(emailInput ?? '').trim().toLowerCase();
      if (!(await findSender(email))) return;
      const token = randomSecret();
      const tokenHash = sha256Hex(token);
      // One live link per person, so asking again retires the one already in their inbox.
      const person = sha256Hex(email);
      const earlier = await store.getRecord('login_latest', person);
      if (earlier) await store.deleteRecord('logins', earlier.tokenHash);
      await store.putRecord('logins', tokenHash, {
        email,
        expiresAt: new Date(Date.now() + TIMES.loginToken).toISOString(),
      });
      await store.putRecord('login_latest', person, { tokenHash });
      await mail({ to: email, ...loginEmail({ url: `${config.baseUrl}/sign/login#${token}` }) });
    },

    async completeLogin(token) {
      const login = typeof token === 'string' && token.length < 100
        ? await store.takeRecord('logins', sha256Hex(token))
        : null;
      if (!login || Date.now() > Date.parse(login.expiresAt)) {
        throw new HttpError(400, 'This sign-in link has expired, was already used, or was replaced by a newer one.');
      }
      const sessionId = randomSecret();
      await store.putRecord('sessions', sha256Hex(sessionId), {
        email: login.email,
        expiresAt: new Date(Date.now() + TIMES.session).toISOString(),
      });
      return { sessionId, maxAgeSeconds: TIMES.session / 1000 };
    },

    async authenticate(sessionId) {
      if (!sessionId || sessionId.length > 100) return null;
      const session = await store.getRecord('sessions', sha256Hex(sessionId));
      if (!session || Date.now() > Date.parse(session.expiresAt)) return null;
      // Checked on every request, so removing someone ends their access at once.
      const sender = await findSender(session.email);
      return sender ? { email: session.email, ...sender } : null;
    },

    async logout(sessionId) {
      if (sessionId) await store.deleteRecord('sessions', sha256Hex(sessionId));
    },

    // ---- team -------------------------------------------------------------
    async listTeam(user) {
      requireOwner(user);
      const admins = await store.listRecords('admins');
      admins.sort((a, b) => a.name.localeCompare(b.name));
      return [
        ...[...OWNERS].map(([email, owner]) => ({ email, ...owner, owner: true })),
        ...admins.map((admin) => ({ ...admin, owner: false })),
      ];
    },

    async addAdmin(user, body) {
      requireOwner(user);
      const email = cleanText(body.email, 200, 'Email', { required: true }).toLowerCase();
      if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Enter a valid email address.');
      if (await findSender(email)) throw new HttpError(409, `${email} is already on the team.`);
      const admin = {
        email,
        name: cleanText(body.name, 120, 'Name', { required: true }),
        title: cleanText(body.title, 120, 'Title'),
        addedBy: user.email,
        addedAt: nowIso(),
      };
      await store.putRecord('admins', sha256Hex(email), admin);
      log.log(`[sign] ${user.email} added admin ${email}`);
      const invited = await mail({ to: email, ...inviteEmail({ admin, inviter: user.name, url: `${config.baseUrl}/sign` }) })
        .then(() => true, (e) => {
          log.error('[sign] invite email failed:', e.message);
          return false;
        });
      return { admin: { ...admin, owner: false }, invited };
    },

    async removeAdmin(user, emailInput) {
      requireOwner(user);
      const email = String(emailInput ?? '').trim().toLowerCase();
      if (OWNERS.has(email)) throw new HttpError(409, 'The owner can\'t be removed.');
      await store.deleteRecord('admins', sha256Hex(email));
      log.log(`[sign] ${user.email} removed admin ${email}`);
    },

    // ---- folders ----------------------------------------------------------
    async listFolders() {
      const folders = await store.listRecords('folders');
      return folders.sort((a, b) => a.name.localeCompare(b.name));
    },

    async createFolder(sender, nameInput) {
      const folder = { id: newId('d'), name: await cleanFolderName(nameInput), createdBy: sender.email, createdAt: nowIso() };
      await store.putRecord('folders', folder.id, folder);
      return folder;
    },

    async renameFolder(id, nameInput) {
      const folder = { ...(await requireFolder(id)), name: await cleanFolderName(nameInput, id) };
      await store.putRecord('folders', id, folder);
      return folder;
    },

    // Its documents keep an id that now matches nothing, so they just show as unfiled.
    async deleteFolder(id) {
      await requireFolder(id);
      await store.deleteRecord('folders', id);
    },

    // ---- sender -----------------------------------------------------------
    async listEnvelopes() {
      // Bulk sends add up fast, and the list folds each batch into one row.
      const envelopes = await store.listEnvelopes(LIST_LIMIT);
      return envelopes.map((env) => adminView(env, { full: false }));
    },

    async getEnvelope(id) {
      return adminView(await requireEnvelope(id));
    },

    async createDraft(sender, fileNameInput, bytes, info, folderId = null) {
      if (folderId) await requireFolder(folderId);
      const inspected = await inspectPdf(bytes);
      const fileName = fileNameInput.replace(/[\\/\p{C}]+/gu, ' ').trim().slice(0, 120) || 'Document.pdf';
      const id = newEnvelopeId();
      const key = `envelopes/${id}/original.pdf`;
      const sha256 = sha256Hex(bytes);
      await store.putBlob(key, bytes, 'application/pdf');
      const env = {
        id,
        title: fileName.replace(/\.pdf$/i, ''),
        message: '',
        status: 'draft',
        sequential: false,
        expiryDays: 30,
        createdAt: nowIso(),
        sender: { email: sender.email, name: sender.name },
        document: { key, fileName, bytes: bytes.length, sha256, pages: inspected.pages, sizes: inspected.sizes },
        recipients: [],
        fields: [],
        sealed: null,
        events: [],
        folderId,
      };
      appendEvent(env, 'envelope.created', { actor: senderActor(sender), ...info, details: { sha256, fileName } });
      await store.createEnvelope(env);
      return adminView(env);
    },

    async updateDraft(id, body) {
      const { env } = await mutate(id, (fresh) => {
        if (fresh.status !== 'draft') throw new HttpError(409, 'This document has already been sent.');
        if (fresh.deletedAt) throw new HttpError(409, 'This draft is in Deleted. Restore it first.');
        fresh.title = cleanText(body.title, LIMITS.title, 'Title');
        fresh.message = cleanText(body.message, LIMITS.message, 'Message');
        fresh.sequential = body.sequential === true;
        fresh.expiryDays = EXPIRY_DAYS.includes(body.expiryDays) ? body.expiryDays : 30;
        fresh.recipients = draftRecipients(body.recipients);
        const signerIds = new Map((body.recipients ?? []).map((r, i) => [r.id, fresh.recipients[i]?.id]));
        const fields = (body.fields ?? []).map((f) => ({ ...f, recipientId: signerIds.get(f.recipientId) ?? f.recipientId }));
        fresh.fields = validFields(fields, fresh.recipients, fresh.document.pages);
      });
      return adminView(env);
    },

    async deleteDraft(id) {
      const env = await requireEnvelope(id);
      if (env.status !== 'draft') throw new HttpError(409, 'Only drafts can be deleted. Void a sent document instead.');
      await store.deleteEnvelope(id);
      await store.deleteBlobs(`envelopes/${id}/`);
    },

    // Drafts never reached anyone, so they are erased. Anything else only leaves the
    // firm's lists and can be restored: signers keep their links and /sign/verify
    // still answers, until an owner erases it.
    async deleteEnvelopes(idsInput, sender, info) {
      // Drafts go to Deleted too, so nothing vanishes from one click.
      for (const id of selection(idsInput)) {
        await mutate(id, (fresh) => {
          if (effectiveStatus(fresh) === 'sent') {
            throw new HttpError(409, `"${fresh.title}" is out for signature. Void it before deleting it.`);
          }
          if (fresh.deletedAt) return { save: false };
          fresh.deletedAt = nowIso();
          appendEvent(fresh, 'envelope.deleted', { actor: senderActor(sender), ...info });
          return { save: true };
        });
      }
    },

    // The owner's second step, and the only way a signed contract leaves our records.
    // Everything is checked before anything goes. Files go first, so a failure partway
    // leaves the document listed and able to be retried.
    async eraseEnvelopes(user, idsInput) {
      if (!user.owner) throw new HttpError(403, 'Only the owner can permanently delete documents.');
      const envs = await Promise.all(selection(idsInput).map((id) => requireEnvelope(id)));
      const live = envs.find((env) => !env.deletedAt);
      if (live) throw new HttpError(409, `"${live.title}" has to be in Deleted first.`);
      for (const { id, sealed } of envs) {
        await store.deleteBlobs(`envelopes/${id}/`);
        if (sealed) await store.deleteRecord('hashes', sealed.sha256);
        await store.deleteEnvelope(id);
        log.log(`[sign] ${user.email} permanently deleted ${formatEnvelopeId(id)}`);
      }
    },

    async restoreEnvelopes(idsInput, sender, info) {
      for (const id of selection(idsInput)) {
        await mutate(id, (fresh) => {
          if (!fresh.deletedAt) return { save: false };
          delete fresh.deletedAt;
          appendEvent(fresh, 'envelope.restored', { actor: senderActor(sender), ...info });
          return { save: true };
        });
      }
    },

    async moveEnvelopes(idsInput, folderId) {
      const ids = selection(idsInput);
      if (folderId !== null) await requireFolder(folderId);
      for (const id of ids) {
        await mutate(id, (fresh) => {
          fresh.folderId = folderId;
        });
      }
    },

    async duplicate(id, sender, info) {
      return adminView(await cloneEnvelope(await requireEnvelope(id), sender, info));
    },

    // One draft, many people: each person gets their own copy of the draft with
    // their name in the chosen signer's place, so every signature has its own
    // envelope, audit trail and sealed PDF. The draft itself stays, for next time.
    async bulkSend(id, sender, info, body) {
      const source = await requireEnvelope(id);
      if (source.status !== 'draft') throw new HttpError(409, 'Only a draft can be sent to a list.');
      if (source.deletedAt) throw new HttpError(409, 'This draft is in Deleted. Restore it first.');
      const slot = source.recipients.find((r) => r.id === body?.recipientId && r.role === 'signer');
      if (!slot) throw new HttpError(400, 'Choose which signer changes for each person.');
      const people = bulkList(body?.people);
      const fixed = source.recipients.filter((r) => r !== slot);
      for (const person of people) {
        if (fixed.some((r) => r.email === person.email)) {
          throw new HttpError(400, `${person.email} is already on the document, so it can't also be on the list.`);
        }
      }
      // Every copy is checked before any is made, so a bad row sends nothing.
      for (const person of people) {
        assertReadyToSend({ ...source, recipients: source.recipients.map((r) => (r === slot ? { ...r, ...person } : r)) });
      }
      const batch = newId('b');
      const results = [];
      for (const [i, person] of people.entries()) {
        if (i && config.bulkPaceMs) await new Promise((done) => setTimeout(done, config.bulkPaceMs));
        let copyId = null;
        try {
          const copy = await cloneEnvelope(source, sender, info, {
            swap: { id: slot.id, ...person },
            details: { bulkFrom: source.id, batch, position: i + 1, of: people.length },
          });
          copyId = copy.id;
          const sent = await this.send(copy.id, sender, info);
          copyId = null;
          results.push({ ...person, ok: true, id: copy.id, links: sent.links, emailFailed: sent.failed.length > 0 });
        } catch (e) {
          log.error('[sign] bulk copy failed:', e.message);
          if (copyId) await this.deleteDraft(copyId).catch(() => undefined);
          results.push({ ...person, ok: false, error: e instanceof HttpError ? e.message : 'Something went wrong.' });
        }
      }
      return { batch, results };
    },

    async send(id, sender, info) {
      const links = [];
      let notices = [];
      const { env } = await mutate(id, (fresh) => {
        if (fresh.status !== 'draft') throw new HttpError(409, 'This document has already been sent.');
        if (fresh.deletedAt) throw new HttpError(409, 'This draft is in Deleted. Restore it first.');
        assertReadyToSend(fresh);
        links.length = 0;
        const now = nowIso();
        fresh.status = 'sent';
        fresh.sentAt = now;
        fresh.expiresAt = new Date(Date.now() + fresh.expiryDays * 86_400_000).toISOString();
        fresh.sender = { email: sender.email, name: sender.name };
        const signers = signersOf(fresh);
        signers.forEach((rec, i) => {
          rec.order = fresh.sequential ? i + 1 : 1;
          rec.status = 'waiting';
        });
        for (const rec of fresh.recipients.filter((r) => r.role === 'cc')) rec.status = 'copy';
        appendEvent(fresh, 'envelope.sent', {
          actor: senderActor(sender),
          ...info,
          details: { recipients: fresh.recipients.map((r) => r.email), sequential: fresh.sequential, documentSha256: fresh.document.sha256 },
        });
        for (const rec of signers.filter((r) => r.delivery === 'link')) {
          links.push({ recipientId: rec.id, name: rec.name, url: signerUrl(issueToken(fresh, rec)) });
          appendEvent(fresh, 'recipient.link_issued', { actor: senderActor(sender), ...info, details: { recipient: rec.email } });
        }
        // The sender already holds these links, so only emailed signers need a notice.
        notices = activateNext(fresh).filter((n) => !n.handoff);
      });
      const results = await deliver(id, env, notices);
      return { envelope: await this.getEnvelope(id), links, failed: results.filter((r) => !r.ok).map((r) => r.rec.name) };
    },

    async remind(id, recipientId) {
      let notice;
      const { env } = await mutate(id, (fresh) => {
        if (effectiveStatus(fresh) !== 'sent') throw new HttpError(409, 'This document is no longer out for signature.');
        const rec = fresh.recipients.find((r) => r.id === recipientId);
        if (!rec || rec.role !== 'signer' || rec.status === 'signed') throw new HttpError(400, 'That recipient has nothing to sign.');
        if (rec.status === 'waiting') throw new HttpError(409, `It is not ${rec.name}'s turn yet.`);
        notice = { recipientId: rec.id, token: issueToken(fresh, rec) };
      });
      const [result] = await deliver(id, env, [notice], { reminder: true });
      if (!result?.ok) throw new HttpError(502, 'The reminder could not be sent. Try again shortly.');
    },

    // Emails everyone whose turn it is on each document. Unlike voiding, a document
    // that moved on since it was ticked is skipped rather than stopping the rest.
    // Link signers are left out, since the sender chose to hand those links over
    // personally, and so is the sender, who signs from the documents page.
    async remindEnvelopes(idsInput, user) {
      const outcome = { reminded: 0, skipped: 0, failed: [] };
      let first = true;
      for (const id of selection(idsInput)) {
        let notices = [];
        try {
          const { env } = await mutate(id, (fresh) => {
            notices = [];
            if (fresh.deletedAt || effectiveStatus(fresh) !== 'sent' || allSigned(fresh)) return { save: false };
            for (const rec of signersOf(fresh)) {
              if (rec.status === 'signed' || rec.status === 'waiting' || rec.delivery === 'link' || rec.email === user.email) continue;
              notices.push({ recipientId: rec.id, token: issueToken(fresh, rec) });
            }
            return { save: notices.length > 0 };
          });
          if (!notices.length) {
            outcome.skipped++;
            continue;
          }
          if (!first && config.bulkPaceMs) await new Promise((done) => setTimeout(done, config.bulkPaceMs));
          first = false;
          for (const result of await deliver(id, env, notices, { reminder: true })) {
            if (result.ok) outcome.reminded++;
            else outcome.failed.push(result.rec.name);
          }
        } catch (e) {
          if (!(e instanceof HttpError)) throw e;
          outcome.skipped++;
        }
      }
      return outcome;
    },

    // Replaces every earlier link for this person, because links are stored only
    // as hashes and an existing one can't be shown again.
    async newLink(id, recipientId, sender, info) {
      let token;
      await mutate(id, (fresh) => {
        if (effectiveStatus(fresh) !== 'sent') throw new HttpError(409, 'This document is no longer out for signature.');
        const rec = fresh.recipients.find((r) => r.id === recipientId);
        if (!rec || rec.role !== 'signer' || rec.status === 'signed') throw new HttpError(400, 'That recipient has nothing to sign.');
        rec.tokenHashes = [];
        rec.delivery = 'link';
        rec.requireCode = true;
        token = issueToken(fresh, rec);
        appendEvent(fresh, 'recipient.link_issued', { actor: senderActor(sender), ...info, details: { recipient: rec.email, replacedEarlierLinks: true } });
      });
      return { url: signerUrl(token) };
    },

    async voidEnvelope(id, reasonInput, sender, info) {
      const reason = cleanText(reasonInput, LIMITS.reason, 'Reason', { required: true });
      const { env } = await mutate(id, (fresh) => {
        if (effectiveStatus(fresh) !== 'sent' || allSigned(fresh)) throw new HttpError(409, 'Only a document still out for signature can be voided.');
        fresh.status = 'voided';
        fresh.voidedAt = nowIso();
        fresh.voidReason = reason;
        appendEvent(fresh, 'envelope.voided', { actor: senderActor(sender), ...info, details: { reason } });
      });
      const notified = signersOf(env).filter((r) => r.sentAt);
      await Promise.allSettled(notified.map((r) => mail({ to: r.email, ...voidedEmail({ env, reason }) })));
    },

    // Every document is checked before any is voided, so a stale selection voids nothing.
    async voidEnvelopes(idsInput, reasonInput, sender, info) {
      const ids = selection(idsInput);
      const reason = cleanText(reasonInput, LIMITS.reason, 'Reason', { required: true });
      for (const id of ids) {
        const env = await requireEnvelope(id);
        if (env.deletedAt || effectiveStatus(env) !== 'sent' || allSigned(env)) {
          throw new HttpError(409, `"${env.title}" is no longer out for signature, so it can't be voided.`);
        }
      }
      for (const id of ids) await this.voidEnvelope(id, reason, sender, info);
      return { voided: ids.length };
    },

    async finish(id) {
      await finalize(id);
      return this.getEnvelope(id);
    },

    async retryTimestamp(id) {
      const env = await requireEnvelope(id);
      if (!env.sealed || env.sealed.timestamp) return this.getEnvelope(id);
      const pdf = await store.getBlob(env.sealed.key);
      const stamped = await timestampFile(pdf, config.tsaUrls);
      if (!stamped.token) throw new HttpError(502, 'No timestamp authority answered. Try again later.');
      const tokenKey = `envelopes/${id}/timestamp-${randomSecret().slice(0, 8)}.tsr`;
      await store.putBlob(tokenKey, stamped.token, 'application/timestamp-reply');
      await mutate(id, (fresh) => {
        fresh.sealed.timestamp = stamped.timestamp;
        fresh.sealed.tokenKey = tokenKey;
        appendEvent(fresh, 'document.timestamped', {
          details: { sha256: fresh.sealed.sha256, timestampAuthority: stamped.timestamp.tsa, timestampTime: stamped.timestamp.genTime },
        });
      });
      return this.getEnvelope(id);
    },

    async senderFile(id, kind) {
      const env = await requireEnvelope(id);
      const key = kind === 'sealed' ? env.sealed?.key : env.document.key;
      const bytes = key ? await store.getBlob(key) : null;
      if (!bytes) throw new HttpError(404, 'File not found.');
      const base = env.title.replace(/[^\p{L}\p{N} ._-]+/gu, '').trim().slice(0, 80) || 'Document';
      return { bytes, fileName: kind === 'sealed' ? `${base} - signed.pdf` : env.document.fileName };
    },

    // ---- signer -----------------------------------------------------------
    async signerSession(token, verifiedSecret) {
      const { env, rec, copyOnly, verified } = await authorizeSigner(token, verifiedSecret);
      const state = signerState(env, rec, copyOnly);
      const base = { state, reference: formatEnvelopeId(env.id), sender: { name: env.sender.name }, org: ORG.name };
      if (state === 'voided' || state === 'expired' || state === 'declined' || state === 'unavailable') return base;
      if (state === 'completed' && copyOnly) return { ...base, title: env.title, sha256: env.sealed.sha256 };
      // The code unlocks signing. With nothing left to sign, a link holder learns the state and no more.
      if (!verified) return state === 'sign' ? { ...base, state: 'code', maskedEmail: maskEmail(rec.email) } : base;
      const summary = {
        ...base,
        title: env.title,
        recipient: { name: rec.name, email: rec.email },
      };
      if (state === 'completed') return { ...summary, sha256: env.sealed.sha256 };
      if (state !== 'sign') return summary;
      return {
        ...summary,
        message: env.message,
        fileName: env.document.fileName,
        pages: env.document.pages,
        sizes: env.document.sizes,
        needsConsent: !rec.consent,
        disclosure: DISCLOSURE,
        intent: INTENT,
        fields: env.fields
          .filter((f) => f.recipientId === rec.id)
          .map(({ id, type, page, x, y, w, h, required, label }) => ({ id, type, page, x, y, w, h, required, label })),
        others: await othersFilled(env, rec),
      };
    },

    async sendCode(token, info) {
      const { env, rec: { id: recipientId } } = await authorizeSigner(token);
      let code;
      const { env: fresh } = await mutate(env.id, (e) => {
        const rec = requireActiveSigner(e, recipientId);
        const now = Date.now();
        const sends = (rec.otpSends ?? []).filter((t) => now - t < 3_600_000);
        if (rec.otp && now - Date.parse(rec.otp.sentAt) < TIMES.codeResend) throw new HttpError(429, 'Please wait a moment before asking for another code.');
        if (sends.length >= 5) throw new HttpError(429, 'Too many codes requested. Try again in an hour.');
        code = newCode();
        rec.otp = {
          hash: sha256Hex(`${rec.id}:${code}`),
          sentAt: new Date(now).toISOString(),
          expiresAt: new Date(now + TIMES.code).toISOString(),
          attempts: 0,
        };
        rec.otpSends = [...sends, now];
        appendEvent(e, 'recipient.code_sent', { actor: signerActor(rec), ...info, details: { to: rec.email } });
      });
      const rec = fresh.recipients.find((r) => r.id === recipientId);
      await mail({ to: rec.email, ...codeEmail({ env: fresh, code }) });
    },

    async verifyCode(token, code, info) {
      const { env, rec: { id: recipientId } } = await authorizeSigner(token);
      const verifiedSecret = randomSecret();
      const { result } = await mutate(env.id, (e) => {
        const rec = requireActiveSigner(e, recipientId);
        if (!rec.otp || Date.now() > Date.parse(rec.otp.expiresAt)) return { error: 'That code has expired. Ask for a new one.', save: false };
        if (rec.otp.attempts >= 5) return { error: 'Too many wrong attempts. Ask for a new code.', save: false };
        if (!hashesEqual(rec.otp.hash, sha256Hex(`${rec.id}:${String(code ?? '').trim()}`))) {
          rec.otp.attempts += 1;
          appendEvent(e, 'recipient.code_failed', { actor: signerActor(rec), ...info });
          return { error: 'That code is not right.' };
        }
        rec.otp = null;
        rec.verifiedAt = nowIso();
        rec.verified = { hash: sha256Hex(verifiedSecret), until: new Date(Date.now() + TIMES.verified).toISOString() };
        appendEvent(e, 'recipient.identity_verified', { actor: signerActor(rec), ...info, details: { method: 'email code', to: rec.email } });
        return {};
      });
      if (result.error) throw new HttpError(400, result.error);
      return { verified: verifiedSecret };
    },

    async signerDocument(token, verifiedSecret) {
      const { env, rec, copyOnly } = await signerAccess(token, verifiedSecret);
      const state = signerState(env, rec, copyOnly);
      if (state !== 'sign') throw new HttpError(409, 'This document is not available from this link.');
      const bytes = await store.getBlob(env.document.key);
      if (!bytes) throw new HttpError(404, 'File not found.');
      return { bytes, fileName: env.document.fileName };
    },

    async recordViewed(token, verifiedSecret, info) {
      const { env, rec: { id: recipientId } } = await signerAccess(token, verifiedSecret);
      await mutate(env.id, (e) => {
        const rec = requireActiveSigner(e, recipientId);
        if (rec.viewedAt) return { save: false };
        rec.viewedAt = nowIso();
        rec.status = 'viewed';
        appendEvent(e, 'recipient.viewed', { actor: signerActor(rec), ...info, details: { documentSha256: e.document.sha256 } });
      });
    },

    // Only reachable after the document rendered on this device, which is how the
    // signer shows they can open the format the records will come in.
    async recordConsent(token, verifiedSecret, body, info) {
      if (body?.version !== DISCLOSURE_VERSION) throw new HttpError(409, 'The disclosure has changed. Reload the page.');
      if (body?.previewed !== true) throw new HttpError(400, 'The document must display on your device first.');
      const { env, rec: { id: recipientId } } = await signerAccess(token, verifiedSecret);
      await mutate(env.id, (e) => {
        const rec = requireActiveSigner(e, recipientId);
        if (rec.consent) return { save: false };
        if (!rec.viewedAt) throw new HttpError(409, 'The document must display on your device first.');
        rec.consent = { version: DISCLOSURE_VERSION, sha256: DISCLOSURE_SHA256, at: nowIso(), ...info };
        appendEvent(e, 'recipient.consented', {
          actor: signerActor(rec),
          ...info,
          details: { disclosureVersion: DISCLOSURE_VERSION, disclosureSha256: DISCLOSURE_SHA256, documentRendered: true },
        });
      });
    },

    async submit(token, verifiedSecret, body, info) {
      if (body?.intent !== true) throw new HttpError(400, 'Confirm that you intend to sign.');
      const { env, rec: { id: recipientId } } = await signerAccess(token, verifiedSecret);
      const rec = requireActiveSigner(env, recipientId);
      if (!rec.consent) throw new HttpError(409, 'Agree to electronic records first.');
      await signFor(env, rec, body, info);
      return this.signerSession(token, verifiedSecret);
    },

    // Lets a signed-in sender sign the documents waiting on their own signature from
    // the documents page, many in a row. Only ever their own place on a document,
    // and only a document whose file this browser displayed: the client lists the
    // file hashes it rendered, so copies of one file can follow the one shown.
    async signMine(user, id, body, info) {
      if (body?.intent !== true) throw new HttpError(400, 'Confirm that you intend to sign.');
      if (body?.consent !== true || body?.disclosureVersion !== DISCLOSURE_VERSION) {
        throw new HttpError(409, 'Agree to electronic records first.');
      }
      const env = await requireEnvelope(id);
      const rec = signersOf(env).find((r) => r.email === user.email && signerState(env, r, false) === 'sign');
      if (!rec || env.deletedAt) throw new HttpError(409, `"${env.title}" has nothing waiting for your signature.`);
      if (!Array.isArray(body.rendered) || !body.rendered.includes(env.document.sha256)) {
        throw new HttpError(409, `Open "${env.title}" before signing it.`);
      }
      if (env.fields.some((f) => f.recipientId === rec.id && f.required && (f.type === 'text' || f.type === 'checkbox'))) {
        throw new HttpError(409, `"${env.title}" has fields only you can fill in. Open it from your email to sign.`);
      }
      const via = { via: 'documents page' };
      await signFor(env, rec, body, info, {
        signedDetails: via,
        before(e, r) {
          if (!r.viewedAt) {
            r.viewedAt = nowIso();
            appendEvent(e, 'recipient.viewed', { actor: signerActor(r), ...info, details: { documentSha256: e.document.sha256, ...via } });
          }
          if (!r.consent) {
            r.consent = { version: DISCLOSURE_VERSION, sha256: DISCLOSURE_SHA256, at: nowIso(), ...info };
            appendEvent(e, 'recipient.consented', {
              actor: signerActor(r),
              ...info,
              details: { disclosureVersion: DISCLOSURE_VERSION, disclosureSha256: DISCLOSURE_SHA256, documentRendered: true, ...via },
            });
          }
        },
      });
      return { ok: true };
    },

    async finishFromSigner(token, verifiedSecret) {
      const { env } = await signerAccess(token, verifiedSecret);
      await finalize(env.id);
      return this.signerSession(token, verifiedSecret);
    },

    async decline(token, verifiedSecret, body, info) {
      const paper = body?.paper === true;
      const reason = cleanText(body?.reason, LIMITS.reason, 'Reason', { required: !paper });
      const { env, rec: { id: recipientId } } = await signerAccess(token, verifiedSecret);
      const { env: saved } = await mutate(env.id, (e) => {
        const rec = requireActiveSigner(e, recipientId);
        e.status = 'declined';
        e.declinedAt = nowIso();
        rec.status = 'declined';
        rec.declinedAt = e.declinedAt;
        rec.declineReason = reason;
        appendEvent(e, paper ? 'recipient.paper_requested' : 'recipient.declined', {
          actor: signerActor(rec),
          ...info,
          ...(reason ? { details: { reason } } : {}),
        });
      });
      const rec = saved.recipients.find((r) => r.id === recipientId);
      await mail({ to: saved.sender.email, ...declinedEmail({ env: saved, rec, reason, paper }) })
        .catch((e) => log.error('[sign] decline email failed:', e.message));
      return { state: 'declined' };
    },

    async signerSealedFile(token, verifiedSecret) {
      const { env } = await signerAccess(token, verifiedSecret).catch(async (e) => {
        // A copy link was emailed to the person's own inbox, so it stands on its own.
        const access = await authorizeSigner(token);
        if (!access.copyOnly) throw e;
        return access;
      });
      if (!env.sealed) throw new HttpError(404, 'The signed copy is not ready yet.');
      const bytes = await store.getBlob(env.sealed.key);
      if (!bytes) throw new HttpError(404, 'File not found.');
      const base = env.title.replace(/[^\p{L}\p{N} ._-]+/gu, '').trim().slice(0, 80) || 'Document';
      return { bytes, fileName: `${base} - signed.pdf` };
    },

    // ---- public -----------------------------------------------------------
    // Answers only for someone already holding the exact file, or its 256-bit hash.
    async verifyHash(sha256) {
      if (!/^[0-9a-f]{64}$/.test(sha256)) throw new HttpError(400, 'That is not a SHA-256 hash.');
      const record = await store.getRecord('hashes', sha256);
      if (!record) return { found: false };
      const env = await requireEnvelope(record.envelopeId);
      return {
        found: true,
        reference: formatEnvelopeId(env.id),
        title: env.title,
        completedAt: env.completedAt,
        timestamp: env.sealed.timestamp,
        signers: signersOf(env).map((r) => ({ name: r.name, signedAt: r.signedAt })),
      };
    },
  };
}
