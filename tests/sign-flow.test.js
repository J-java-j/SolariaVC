// The signing lifecycle, driven through the service exactly as the routes do.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sha256Hex, verifyChain } from '../server/sign/crypto.js';
import { HttpError } from '../server/sign/envelopes.js';
import { createMailer } from '../server/sign/mail.js';
import { PdfRejected } from '../server/sign/pdf.js';
import { INFO, SENDER, draft, harness, linkIn, makePdf, mark, signAs } from './sign-helpers.js';

const httpError = (status) => (e) => e instanceof HttpError && e.status === status;
const hasTool = (name) => spawnSync('which', [name]).status === 0;

async function sent(svc, env) {
  return svc.send(env.id, SENDER, INFO);
}

test('two signers and a copy recipient reach a sealed, delivered document', async (t) => {
  const { svc, store, sent: mail } = harness(t);
  const env = await draft(svc, {
    recipients: [
      { id: 'a', name: 'Ada Investor', email: 'ada@example.com' },
      { id: 'b', name: 'Karl Partner', email: 'karl@example.com' },
      { id: 'c', name: 'Records', email: 'records@example.com', role: 'cc' },
    ],
  });
  await sent(svc, env);

  const [toAda, toKarl] = ['ada@example.com', 'karl@example.com'].map((to) => linkIn(mail.find((m) => m.to === to)));
  assert.ok(toAda && toKarl, 'both signers were emailed a link');
  assert.equal(mail.some((m) => m.to === 'records@example.com'), false, 'a copy recipient gets nothing until the end');

  await signAs(svc, toAda, { name: 'Ada Investor' });
  let view = await svc.getEnvelope(env.id);
  assert.equal(view.status, 'sent');

  const session = await signAs(svc, toKarl, { name: 'Karl Partner' });
  assert.equal(session.state, 'completed');

  view = await svc.getEnvelope(env.id);
  assert.equal(view.status, 'completed');
  assert.equal(view.chainValid, true);
  assert.deepEqual(
    view.events.map((e) => e.type).filter((type) => type !== 'recipient.notified'),
    [
      'envelope.created', 'envelope.sent',
      'recipient.viewed', 'recipient.consented', 'recipient.signed',
      'recipient.viewed', 'recipient.consented', 'recipient.signed',
      'document.sealed', 'envelope.completed',
      'copy.sent', 'copy.sent', 'copy.sent', 'copy.sent',
    ],
  );

  const stored = await store.getBlob(view.sealed.key);
  assert.equal(sha256Hex(stored), view.sealed.sha256);
  const check = await svc.verifyHash(view.sealed.sha256);
  assert.equal(check.found, true);
  assert.deepEqual(check.signers.map((s) => s.name), ['Ada Investor', 'Karl Partner']);

  const copies = mail.filter((m) => m.subject.startsWith('Completed'));
  assert.deepEqual(copies.map((m) => m.to).sort(), [
    'ada@example.com', 'johnsonjiang@solariavc.com', 'karl@example.com', 'records@example.com',
  ]);
  assert.ok(copies.every((m) => m.attachments?.length === 1), 'every party got the file');
  assert.ok(copies[0].text.includes(view.sealed.sha256), 'the email carries the hash the file cannot hold');

  const toRecords = linkIn(copies.find((m) => m.to === 'records@example.com'));
  const file = await svc.signerSealedFile(toRecords);
  assert.equal(sha256Hex(file.bytes), view.sealed.sha256);
});

test('signers go in order, and a later signer cannot act early', async (t) => {
  const { svc, sent: mail } = harness(t);
  const env = await draft(svc, { sequential: true });
  await sent(svc, env);
  assert.deepEqual(mail.map((m) => m.to), ['ada@example.com'], 'only the first signer is told');

  await signAs(svc, linkIn(mail[0]), { name: 'Ada Investor' });
  const toKarl = mail.find((m) => m.to === 'karl@example.com');
  assert.ok(toKarl, 'the next signer is told once it is their turn');

  const session = await svc.signerSession(linkIn(toKarl));
  assert.equal(session.state, 'sign');
  assert.equal(session.others.length, 1, 'they see what the first signer placed');
  assert.match(session.others[0].image, /^data:image\/png;base64,/);
});

test('a link-delivered signer gets no document until proving their inbox', async (t) => {
  const { svc, sent: mail } = harness(t);
  const env = await draft(svc, {
    recipients: [{ id: 'a', name: 'Ada', email: 'ada@example.com', delivery: 'link', requireCode: false }],
  });
  const { links } = await sent(svc, env);
  assert.equal(links.length, 1);
  assert.equal(mail.length, 0, 'nothing is emailed for a link');
  const token = links[0].url.split('#')[1];

  const gate = await svc.signerSession(token);
  assert.equal(gate.state, 'code');
  assert.equal(gate.title, undefined, 'the title stays hidden');
  await assert.rejects(svc.signerDocument(token), httpError(403));
  await assert.rejects(signAs(svc, token), httpError(403));

  await svc.sendCode(token, INFO);
  const code = /(\d{6})/.exec(mail[0].subject)[1];
  await assert.rejects(svc.verifyCode(token, '000000' === code ? '111111' : '000000', INFO), httpError(400));
  const { verified } = await svc.verifyCode(token, code, INFO);

  assert.equal((await svc.signerSession(token, verified)).state, 'sign');
  await assert.rejects(svc.signerDocument(token, 'wrong'), httpError(403));
  assert.ok((await svc.signerDocument(token, verified)).bytes.length > 0);
  const done = await signAs(svc, token, { verified, name: 'Ada' });
  assert.equal(done.state, 'completed');
  const types = (await svc.getEnvelope(env.id)).events.map((e) => e.type);
  assert.ok(types.includes('recipient.identity_verified'));
  assert.ok(types.includes('recipient.code_failed'), 'a wrong guess stays on the record');
});

test('a code link shows where things stand once there is nothing to sign', async (t) => {
  const { svc, sent: mail } = harness(t);
  const env = await draft(svc, {
    sequential: true,
    recipients: [
      { id: 'a', name: 'Ada', email: 'ada@example.com', requireCode: true },
      { id: 'b', name: 'Karl', email: 'karl@example.com', delivery: 'link' },
    ],
  });
  const { links } = await sent(svc, env);
  const karl = links[0].url.split('#')[1];
  const waiting = await svc.signerSession(karl);
  assert.equal(waiting.state, 'waiting', 'a code cannot be sent yet, so none is asked for');
  assert.equal(waiting.title, undefined);

  const ada = linkIn(mail[0]);
  await svc.sendCode(ada, INFO);
  const code = /(\d{6})/.exec(mail[1].subject)[1];
  const { verified } = await svc.verifyCode(ada, code, INFO);
  await signAs(svc, ada, { verified, name: 'Ada' });
  const signed = await svc.signerSession(ada);
  assert.equal(signed.state, 'signed', 'the same goes for someone who signed on another device');
  assert.equal(signed.title, undefined);

  await svc.sendCode(karl, INFO);
  const karlCode = /(\d{6})/.exec(mail.at(-1).subject)[1];
  const karlVerified = (await svc.verifyCode(karl, karlCode, INFO)).verified;
  await signAs(svc, karl, { verified: karlVerified, name: 'Karl' });
  const done = await svc.signerSession(ada);
  assert.equal(done.state, 'completed');
  assert.equal(done.sha256, undefined, 'the signed copy stays behind the code or the emailed copy link');
});

test('code guessing locks out and needs a fresh code', async (t) => {
  const { svc, sent: mail } = harness(t);
  const env = await draft(svc, {
    recipients: [{ id: 'a', name: 'Ada', email: 'ada@example.com', delivery: 'link' }],
  });
  const { links } = await sent(svc, env);
  const token = links[0].url.split('#')[1];
  await svc.sendCode(token, INFO);
  const code = /(\d{6})/.exec(mail[0].subject)[1];
  const wrong = code === '123456' ? '654321' : '123456';
  for (let i = 0; i < 5; i++) await assert.rejects(svc.verifyCode(token, wrong, INFO), httpError(400));
  await assert.rejects(svc.verifyCode(token, code, INFO), /Too many wrong attempts/);
  await assert.rejects(svc.sendCode(token, INFO), httpError(429), 'resends are rate limited');
});

test('a signature needs consent, intent and a rendered document', async (t) => {
  const { svc, sent: mail } = harness(t);
  const env = await draft(svc, { recipients: [{ id: 'a', name: 'Ada', email: 'ada@example.com' }] });
  await sent(svc, env);
  const token = linkIn(mail[0]);

  await assert.rejects(svc.recordConsent(token, undefined, { version: '2026-10-31', previewed: false }, INFO), httpError(400));
  await assert.rejects(svc.recordConsent(token, undefined, { version: '2026-10-31', previewed: true }, INFO), httpError(409));
  await assert.rejects(svc.recordConsent(token, undefined, { version: '1999-01-01', previewed: true }, INFO), httpError(409));

  const submit = (body) => svc.submit(token, undefined, body, INFO);
  await assert.rejects(submit({ intent: true, signature: mark() }), httpError(409), 'no consent yet');

  await svc.recordViewed(token, undefined, INFO);
  await svc.recordConsent(token, undefined, { version: '2026-10-31', previewed: true }, INFO);
  await assert.rejects(submit({ signature: mark() }), httpError(400), 'no intent');
  await assert.rejects(submit({ intent: true }), httpError(400), 'no signature');
  await assert.rejects(submit({ intent: true, signature: { ...mark(), dataUrl: 'data:image/png;base64,AAAA' } }), httpError(400), 'not a PNG');
  await assert.rejects(submit({ intent: true, signature: { ...mark(), name: '  ' } }), httpError(400), 'no adopted name');
  assert.equal((await svc.getEnvelope(env.id)).recipients[0].status, 'viewed');
});

test('required fields are enforced, and values and marks land on the record', async (t) => {
  const { svc, sent: mail } = harness(t);
  const env = await draft(svc, {
    recipients: [{ id: 'a', name: 'Ada', email: 'ada@example.com' }],
    fields: [
      { recipientId: 'a', type: 'signature', page: 1, x: 0.1, y: 0.5, w: 0.3, h: 0.05 },
      { recipientId: 'a', type: 'initials', page: 2, x: 0.1, y: 0.1, w: 0.1, h: 0.04 },
      { recipientId: 'a', type: 'date', page: 1, x: 0.5, y: 0.5, w: 0.2, h: 0.03 },
      { recipientId: 'a', type: 'name', page: 1, x: 0.5, y: 0.6, w: 0.2, h: 0.03 },
      { recipientId: 'a', type: 'text', page: 1, x: 0.1, y: 0.7, w: 0.3, h: 0.03, label: 'Company' },
      { recipientId: 'a', type: 'checkbox', page: 1, x: 0.1, y: 0.8, w: 0.03, h: 0.03 },
    ],
  });
  await sent(svc, env);
  const token = linkIn(mail[0]);
  await svc.recordViewed(token, undefined, INFO);
  await svc.recordConsent(token, undefined, { version: '2026-10-31', previewed: true }, INFO);

  const session = await svc.signerSession(token);
  const id = (type) => session.fields.find((f) => f.type === type).id;
  const base = { intent: true, signature: mark('Ada Lovelace'), timeZone: 'America/Los_Angeles' };

  await assert.rejects(svc.submit(token, undefined, { ...base, initials: mark('AL'), values: { [id('text')]: 'Acme' } }, INFO), /box still needs ticking/);
  await assert.rejects(svc.submit(token, undefined, { ...base, initials: mark('AL'), values: { [id('checkbox')]: true } }, INFO), /Company still needs/);
  await assert.rejects(svc.submit(token, undefined, { ...base, values: { [id('text')]: 'Acme', [id('checkbox')]: true } }, INFO), /initials is missing/);

  await svc.submit(token, undefined, { ...base, initials: mark('AL'), values: { [id('text')]: 'Acme', [id('checkbox')]: true } }, INFO);
  const view = await svc.getEnvelope(env.id);
  const value = (type) => view.fields.find((f) => f.type === type).value;
  assert.equal(view.status, 'completed');
  assert.equal(value('name'), 'Ada Lovelace', 'the name comes from the adopted signature');
  assert.equal(value('text'), 'Acme');
  assert.equal(value('checkbox'), true);
  assert.match(value('date'), /^[A-Z][a-z]+ \d{1,2}, \d{4}$/);
  assert.equal(view.recipients[0].timeZone, 'America/Los_Angeles');
});

test('declining stops everyone and reaches the sender', async (t) => {
  const { svc, sent: mail } = harness(t);
  const env = await draft(svc);
  await sent(svc, env);
  const [ada, karl] = [linkIn(mail[0]), linkIn(mail[1])];
  await svc.decline(ada, undefined, { reason: 'Wrong amount' }, INFO);
  assert.equal((await svc.signerSession(karl)).state, 'declined');
  await assert.rejects(signAs(svc, karl), httpError(409));
  const notice = mail.at(-1);
  assert.equal(notice.to, SENDER.email);
  assert.ok(notice.text.includes('Wrong amount'));
});

test('asking for paper is recorded as the signer withdrawing, with no reason needed', async (t) => {
  const { svc, sent: mail } = harness(t);
  const env = await draft(svc);
  await sent(svc, env);
  await svc.decline(linkIn(mail[0]), undefined, { paper: true }, INFO);
  const view = await svc.getEnvelope(env.id);
  assert.equal(view.status, 'declined');
  assert.ok(view.events.some((e) => e.type === 'recipient.paper_requested'));
});

test('voiding kills every link and tells those already contacted', async (t) => {
  const { svc, sent: mail } = harness(t);
  const env = await draft(svc);
  await sent(svc, env);
  const token = linkIn(mail[0]);
  await assert.rejects(svc.voidEnvelope(env.id, ' ', SENDER, INFO), httpError(400));
  await svc.voidEnvelope(env.id, 'Terms changed', SENDER, INFO);
  assert.equal((await svc.signerSession(token)).state, 'voided');
  await assert.rejects(svc.signerDocument(token), httpError(409));
  await assert.rejects(signAs(svc, token), httpError(409));
  assert.equal(mail.filter((m) => m.subject.startsWith('Cancelled')).length, 2);
});

test('an expired document cannot be signed', async (t) => {
  const { svc, store, sent: mail } = harness(t);
  const env = await draft(svc);
  await sent(svc, env);
  const current = await store.getEnvelope(env.id);
  current.data.expiresAt = new Date(Date.now() - 1000).toISOString();
  await store.saveEnvelope(current.data, current.rev);
  const token = linkIn(mail[0]);
  assert.equal((await svc.signerSession(token)).state, 'expired');
  await assert.rejects(signAs(svc, token), httpError(409));
  assert.equal((await svc.getEnvelope(env.id)).status, 'expired');
});

test('forged and replaced links are refused', async (t) => {
  const { svc, sent: mail } = harness(t);
  const env = await draft(svc);
  await sent(svc, env);
  const token = linkIn(mail[0]);
  const [envelopeId, recipientId] = token.split('.');

  await assert.rejects(svc.signerSession('nonsense'), httpError(404));
  await assert.rejects(svc.signerSession(`${envelopeId}.${recipientId}.${'x'.repeat(43)}`), httpError(404));
  await assert.rejects(svc.signerSession(`AAAAAAAAAAAA.${recipientId}.${token.split('.')[2]}`), httpError(404));

  const view = await svc.getEnvelope(env.id);
  const { url } = await svc.newLink(env.id, view.recipients[0].id, SENDER, INFO);
  await assert.rejects(svc.signerSession(token), httpError(404), 'the old link is dead');
  const replaced = await svc.signerSession(url.split('#')[1]);
  assert.equal(replaced.state, 'code', 'a replaced link is treated as link delivery');
});

test('a reminder leaves the first email working', async (t) => {
  const { svc, sent: mail } = harness(t);
  const env = await draft(svc);
  await sent(svc, env);
  const first = linkIn(mail[0]);
  const view = await svc.getEnvelope(env.id);
  await svc.remind(env.id, view.recipients[0].id);
  const second = linkIn(mail.at(-1));
  assert.notEqual(first, second);
  assert.equal((await svc.signerSession(first)).state, 'sign');
  assert.equal((await svc.signerSession(second)).state, 'sign');
});

test('a double submit records one signature, and simultaneous last signers seal once', async (t) => {
  const { svc, sent: mail } = harness(t);
  const env = await draft(svc);
  await sent(svc, env);
  const [ada, karl] = [linkIn(mail[0]), linkIn(mail[1])];
  for (const token of [ada, karl]) {
    await svc.recordViewed(token, undefined, INFO);
    await svc.recordConsent(token, undefined, { version: '2026-10-31', previewed: true }, INFO);
  }
  const submit = (token) => svc.submit(token, undefined, { intent: true, signature: mark(), timeZone: 'UTC' }, INFO);
  const results = await Promise.allSettled([submit(ada), submit(ada), submit(karl), submit(karl)]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length >= 2, true);

  const view = await svc.getEnvelope(env.id);
  const types = view.events.map((e) => e.type);
  assert.equal(types.filter((t2) => t2 === 'recipient.signed').length, 2);
  assert.equal(types.filter((t2) => t2 === 'document.sealed').length, 1);
  assert.equal(view.chainValid, true);
  assert.equal(mail.filter((m) => m.subject.startsWith('Completed')).length, 3, 'nobody gets two copies');
});

test('email trouble is visible and recoverable, and never loses a signature', async (t) => {
  const { svc, sent: mail, failMailWhen } = harness(t);
  const env = await draft(svc);
  failMailWhen((m) => m.to === 'karl@example.com');
  const { failed } = await sent(svc, env);
  assert.deepEqual(failed, ['Karl Partner']);
  let view = await svc.getEnvelope(env.id);
  assert.ok(view.events.some((e) => e.type === 'recipient.notify_failed'));

  failMailWhen(() => false);
  await svc.remind(env.id, view.recipients.find((r) => r.email === 'karl@example.com').id);
  const ada = linkIn(mail.find((m) => m.to === 'ada@example.com'));
  const karl = linkIn(mail.find((m) => m.to === 'karl@example.com'));
  await signAs(svc, ada);

  failMailWhen((m) => m.to === 'ada@example.com');
  await signAs(svc, karl);
  view = await svc.getEnvelope(env.id);
  assert.equal(view.status, 'completed');
  assert.ok(view.events.some((e) => e.type === 'copy.failed'));

  failMailWhen(() => false);
  await svc.finish(env.id);
  assert.equal(mail.filter((m) => m.subject.startsWith('Completed') && m.to === 'ada@example.com').length, 1, 'the missed copy goes out on retry');
  assert.equal(mail.filter((m) => m.subject.startsWith('Completed') && m.to === 'karl@example.com').length, 1, 'nobody else gets a second one');
});

test('a sealing failure keeps every signature and can be retried', async (t) => {
  const { svc, store, sent: mail } = harness(t);
  const env = await draft(svc, { recipients: [{ id: 'a', name: 'Ada', email: 'ada@example.com' }] });
  await sent(svc, env);
  const token = linkIn(mail[0]);

  const realGet = store.getBlob;
  store.getBlob = async () => { throw new Error('storage is down'); };
  const session = await signAs(svc, token).finally(() => { store.getBlob = realGet; });
  assert.equal(session.state, 'sealing', 'the signature stands while sealing waits');
  const view = await svc.getEnvelope(env.id);
  assert.equal(view.recipients[0].status, 'signed');
  assert.ok(view.sealError);
  assert.equal(view.sealed, null);

  assert.equal((await svc.finishFromSigner(token)).state, 'completed');
});

test('a changed stored original refuses to seal', async (t) => {
  const { svc, store, sent: mail } = harness(t);
  const env = await draft(svc, { recipients: [{ id: 'a', name: 'Ada', email: 'ada@example.com' }] });
  await sent(svc, env);
  const key = (await store.getEnvelope(env.id)).data.document.key;
  const realGet = store.getBlob;
  store.getBlob = async (k) => (k === key ? makePdf(1) : realGet(k));
  const session = await signAs(svc, linkIn(mail[0]));
  assert.equal(session.state, 'sealing');
  assert.equal((await svc.getEnvelope(env.id)).sealed, null);
});

test('stored files can never be overwritten', async (t) => {
  const { store } = harness(t);
  await store.putBlob('a/b.pdf', Buffer.from('one'));
  await assert.rejects(store.putBlob('a/b.pdf', Buffer.from('two')), /blob exists/);
  assert.equal((await store.getBlob('a/b.pdf')).toString(), 'one');
});

test('editing any audit event breaks the chain', async (t) => {
  const { svc, sent: mail } = harness(t);
  const env = await draft(svc, { recipients: [{ id: 'a', name: 'Ada', email: 'ada@example.com' }] });
  await sent(svc, env);
  await signAs(svc, linkIn(mail[0]));
  const view = await svc.getEnvelope(env.id);
  const store = (await import('../server/sign/crypto.js'));
  const raw = view.events.map((e) => ({ seq: e.seq, at: e.at, type: e.type, hash: e.hash }));
  assert.equal(raw.length > 5, true);

  const { svc: other, store: otherStore, sent: otherMail } = harness(t);
  const second = await draft(other, { recipients: [{ id: 'a', name: 'Ada', email: 'ada@example.com' }] });
  await sent(other, second);
  await signAs(other, linkIn(otherMail[0]));
  const stored = (await otherStore.getEnvelope(second.id)).data.events;
  assert.equal(store.verifyChain(stored), true);

  const edited = structuredClone(stored);
  edited[3].at = '2020-01-01T00:00:00.000Z';
  assert.equal(verifyChain(edited), false, 'a changed time');
  assert.equal(verifyChain(stored.filter((_, i) => i !== 3)), false, 'a removed event');
  assert.equal(verifyChain(stored.slice().reverse()), false, 'reordered events');
});

test('drafts are editable until sent and sent documents are not', async (t) => {
  const { svc } = harness(t);
  const env = await draft(svc);
  const signature = (recipientId) => ({ recipientId, type: 'signature', page: 1, x: 0.1, y: 0.1, w: 0.2, h: 0.05 });
  const halfTyped = await svc.updateDraft(env.id, {
    title: 'X', recipients: [{ id: 'x', name: 'A', email: 'bad' }], fields: [signature('x')],
  });
  assert.equal(halfTyped.recipients[0].email, 'bad', 'a draft saves mid-typing');
  await assert.rejects(sent(svc, halfTyped), /not a valid email/);

  const twice = await svc.updateDraft(env.id, {
    title: 'X',
    recipients: [{ id: 'x', name: 'A', email: 'a@b.co' }, { id: 'y', name: 'B', email: 'A@b.co' }],
    fields: [signature('x'), signature('y')],
  });
  await assert.rejects(sent(svc, twice), /listed twice/);

  await assert.rejects(
    svc.updateDraft(env.id, {
      title: 'X',
      recipients: [{ id: 'x', name: 'A', email: 'a@b.co' }],
      fields: [{ recipientId: 'x', type: 'signature', page: 9, x: 0.1, y: 0.1, w: 0.1, h: 0.1 }],
    }),
    /page that does not exist/,
  );
  await assert.rejects(
    svc.updateDraft(env.id, {
      title: 'X',
      recipients: [{ id: 'x', name: 'A', email: 'a@b.co' }],
      fields: [{ recipientId: 'x', type: 'signature', page: 1, x: 0.9, y: 0.1, w: 0.5, h: 0.1 }],
    }),
    /outside the page/,
  );

  const noField = await svc.updateDraft(env.id, {
    title: 'X', recipients: [{ name: 'Ada', email: 'ada@example.com' }], fields: [],
  });
  await assert.rejects(sent(svc, noField), /Place a signature field for Ada/);

  const ready = await draft(svc);
  await sent(svc, ready);
  await assert.rejects(svc.updateDraft(ready.id, { title: 'Y', recipients: [], fields: [] }), httpError(409));
  await assert.rejects(sent(svc, ready), httpError(409));
  await assert.rejects(svc.deleteDraft(ready.id), httpError(409));
});

test('a voided document can be duplicated with its recipients and fields', async (t) => {
  const { svc, sent: mail } = harness(t);
  const env = await draft(svc);
  await sent(svc, env);
  await svc.voidEnvelope(env.id, 'Typo in an email', SENDER, INFO);
  const copy = await svc.duplicate(env.id, SENDER, INFO);
  assert.equal(copy.status, 'draft');
  assert.notEqual(copy.id, env.id);
  assert.equal(copy.document.sha256, env.document.sha256);
  assert.equal(copy.fields.length, env.fields.length);
  assert.deepEqual(copy.recipients.map((r) => r.email), env.recipients.map((r) => r.email));
  assert.ok(copy.fields.every((f) => copy.recipients.some((r) => r.id === f.recipientId)));
  mail.length = 0;
  await sent(svc, copy);
  assert.equal(mail.length, 2);
});

test('client-made ids survive a save, so autosave cannot race', async (t) => {
  const { svc } = harness(t);
  const env = await draft(svc);
  const id = 'r0123456789';
  const field = 'f0123456789';
  const saved = await svc.updateDraft(env.id, {
    title: 'X',
    recipients: [{ id, name: 'A', email: 'a@b.co' }, { id, name: 'B', email: 'b@b.co' }],
    fields: [{ id: field, recipientId: id, type: 'signature', page: 1, x: 0.1, y: 0.1, w: 0.2, h: 0.05, required: false }],
  });
  assert.equal(saved.recipients[0].id, id);
  assert.notEqual(saved.recipients[1].id, id, 'a repeated id is replaced');
  assert.equal(saved.fields[0].id, field);
  assert.equal(saved.fields[0].required, true, 'a signature cannot be optional');
});

test('only listed partners can sign in, once per link, and the probe looks the same', async (t) => {
  const { svc, sent: mail } = harness(t);
  await svc.requestLogin('stranger@example.com');
  assert.equal(mail.length, 0);
  await svc.requestLogin('  JohnsonJiang@SolariaVC.com ');
  assert.equal(mail.length, 1);
  const token = /#(\S+)/.exec(mail[0].text)[1];

  const { sessionId } = await svc.completeLogin(token);
  assert.equal((await svc.authenticate(sessionId)).name, 'Johnson Jiang');
  await assert.rejects(svc.completeLogin(token), httpError(400), 'a link works once');
  assert.equal(await svc.authenticate('bad'), null);

  await svc.logout(sessionId);
  assert.equal(await svc.authenticate(sessionId), null);
});

async function signIn(svc, mail, email) {
  await svc.requestLogin(email);
  const { sessionId } = await svc.completeLogin(/#(\S+)/.exec(mail.at(-1).text)[1]);
  return { sessionId, user: await svc.authenticate(sessionId) };
}

test('asking for a new sign-in link retires the one before it', async (t) => {
  const { svc, sent: mail } = harness(t);
  await svc.requestLogin(SENDER.email);
  await svc.requestLogin(SENDER.email);
  const [first, second] = mail.map((m) => /#(\S+)/.exec(m.text)[1]);
  assert.notEqual(first, second);
  await assert.rejects(svc.completeLogin(first), httpError(400), 'only the newest link works');
  assert.ok((await svc.completeLogin(second)).sessionId);
  assert.match(mail[0].subject, /^Sign in to Solaria Sign \(\d{1,2}:\d{2} [AP]M P[SD]T\)$/);
});

test('every email carries its own reference, so mail apps do not fold them together', async (t) => {
  const bodies = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ id: 'm1' }), { status: 200 });
  };
  t.after(() => { globalThis.fetch = realFetch; });
  const send = createMailer({ resendKey: 'test', from: 'Solaria <sign@example.com>' });
  await send({ to: 'a@example.com', subject: 'Same', html: '', text: '' });
  await send({ to: 'a@example.com', subject: 'Same', html: '', text: '' });
  const [first, second] = bodies.map((b) => b.headers['X-Entity-Ref-ID']);
  assert.match(first, /^[0-9a-f]{32}$/);
  assert.notEqual(first, second);
});

test('the owner adds an admin, who can send but not manage the team', async (t) => {
  const { svc, sent: mail } = harness(t);
  const { user: owner } = await signIn(svc, mail, SENDER.email);
  assert.equal(owner.owner, true);

  await svc.requestLogin('karl@example.com');
  assert.equal(mail.filter((m) => m.to === 'karl@example.com').length, 0, 'nobody gets in before being added');

  const { admin, invited } = await svc.addAdmin(owner, { name: ' Karl Li ', email: ' Karl@Example.com ', title: 'Partner' });
  assert.equal(admin.email, 'karl@example.com');
  assert.equal(admin.name, 'Karl Li');
  assert.equal(invited, true);
  assert.match(mail.at(-1).subject, /^Johnson Jiang added you/);
  assert.equal(mail.at(-1).to, 'karl@example.com');
  assert.deepEqual((await svc.listTeam(owner)).map((p) => [p.email, p.owner]), [
    [SENDER.email, true], ['karl@example.com', false],
  ]);

  const { user: karl } = await signIn(svc, mail, 'KARL@example.com');
  assert.deepEqual([karl.name, karl.owner], ['Karl Li', false]);

  await assert.rejects(svc.listTeam(karl), httpError(403));
  await assert.rejects(svc.addAdmin(karl, { name: 'Friend', email: 'friend@example.com' }), httpError(403));
  await assert.rejects(svc.removeAdmin(karl, 'karl@example.com'), httpError(403));

  const env = await svc.createDraft(karl, 'Side letter.pdf', await makePdf(), INFO);
  assert.equal(env.sender.email, 'karl@example.com');
  assert.deepEqual((await svc.listEnvelopes()).map((e) => e.sender.name), ['Karl Li'], 'admins share one list of documents');
});

test('removing an admin ends their session at once, and the owner stays', async (t) => {
  const { svc, sent: mail } = harness(t);
  const { user: owner } = await signIn(svc, mail, SENDER.email);
  await svc.addAdmin(owner, { name: 'Karl Li', email: 'karl@example.com' });
  const { sessionId } = await signIn(svc, mail, 'karl@example.com');
  assert.ok(await svc.authenticate(sessionId));

  await svc.removeAdmin(owner, 'Karl@Example.com');
  assert.equal(await svc.authenticate(sessionId), null);
  const before = mail.length;
  await svc.requestLogin('karl@example.com');
  assert.equal(mail.length, before, 'a removed admin gets no sign-in link');

  await assert.rejects(svc.removeAdmin(owner, SENDER.email), httpError(409));
  assert.equal((await svc.listTeam(owner)).length, 1);
});

test('adding an admin checks the address and survives a failed invite', async (t) => {
  const { svc, sent: mail, failMailWhen } = harness(t);
  const { user: owner } = await signIn(svc, mail, SENDER.email);
  await assert.rejects(svc.addAdmin(owner, { name: 'No At', email: 'karl.example.com' }), httpError(400));
  await assert.rejects(svc.addAdmin(owner, { name: '', email: 'karl@example.com' }), httpError(400));
  await assert.rejects(svc.addAdmin(owner, { name: 'Me Again', email: SENDER.email }), httpError(409));

  failMailWhen((m) => m.to === 'karl@example.com');
  assert.equal((await svc.addAdmin(owner, { name: 'Karl Li', email: 'karl@example.com' })).invited, false);
  await assert.rejects(svc.addAdmin(owner, { name: 'Karl Li', email: 'karl@example.com' }), httpError(409));
  failMailWhen(() => false);
  assert.ok((await signIn(svc, mail, 'karl@example.com')).user, 'they can still sign in');
});

test('documents move between folders, and a deleted folder leaves them in place', async (t) => {
  const { svc } = harness(t);
  const fund = await svc.createFolder(SENDER, ' Fund I ');
  assert.equal(fund.name, 'Fund I');
  await svc.createFolder(SENDER, 'Archive');
  assert.deepEqual((await svc.listFolders()).map((f) => f.name), ['Archive', 'Fund I']);
  await assert.rejects(svc.createFolder(SENDER, 'fund i'), httpError(409), 'names are unique, ignoring case');
  await assert.rejects(svc.createFolder(SENDER, '  '), httpError(400));
  await assert.rejects(svc.createFolder(SENDER, 'x'.repeat(61)), httpError(400));

  const uploaded = await svc.createDraft(SENDER, 'Filed.pdf', await makePdf(), INFO, fund.id);
  assert.equal(uploaded.folderId, fund.id, 'uploading inside a folder files it there');
  await assert.rejects(svc.createDraft(SENDER, 'Lost.pdf', await makePdf(), INFO, 'dffffffffff'), httpError(404));

  const env = await draft(svc);
  await assert.rejects(svc.moveEnvelopes([env.id], 'dffffffffff'), httpError(404));
  await assert.rejects(svc.moveEnvelopes([], fund.id), httpError(400));
  await assert.rejects(svc.moveEnvelopes(['nope'], fund.id), httpError(400));
  await svc.moveEnvelopes([env.id, env.id], fund.id);
  assert.equal((await svc.getEnvelope(env.id)).folderId, fund.id);
  assert.equal((await svc.duplicate(env.id, SENDER, INFO)).folderId, fund.id, 'a reused document stays in its folder');

  await assert.rejects(svc.renameFolder(fund.id, 'archive'), httpError(409));
  assert.equal((await svc.renameFolder(fund.id, 'fund i')).name, 'fund i', 'a folder can change its own case');

  await svc.moveEnvelopes([env.id], null);
  assert.equal((await svc.getEnvelope(env.id)).folderId, null);
  await svc.moveEnvelopes([env.id], fund.id);
  await svc.deleteFolder(fund.id);
  await assert.rejects(svc.deleteFolder(fund.id), httpError(404));
  assert.ok(await svc.getEnvelope(env.id), 'the document survives its folder');
  assert.equal((await svc.listEnvelopes()).length, 3);
});

test('deleting moves documents, drafts included, to Deleted, and signers keep their copies', async (t) => {
  const { svc, sent: mail } = harness(t);
  const stray = await draft(svc);
  const env = await draft(svc, { recipients: [{ id: 'a', name: 'Ada Investor', email: 'ada@example.com' }] });
  await sent(svc, env);
  const token = linkIn(mail.find((m) => m.to === 'ada@example.com'));

  await assert.rejects(svc.deleteEnvelopes([env.id], SENDER, INFO), httpError(409), 'it must be voided first');
  assert.equal((await svc.getEnvelope(env.id)).deletedAt, null);

  await signAs(svc, token, { name: 'Ada' });
  await svc.deleteEnvelopes([env.id, stray.id], SENDER, INFO);
  const binned = await svc.getEnvelope(stray.id);
  assert.ok(binned.deletedAt, 'a draft waits in Deleted too');
  await assert.rejects(svc.updateDraft(stray.id, { title: 'X', recipients: [], fields: [] }), httpError(409), 'and cannot be edited there');
  await assert.rejects(svc.send(stray.id, SENDER, INFO), httpError(409), 'or sent');
  await svc.restoreEnvelopes([stray.id], SENDER, INFO);
  assert.equal((await svc.getEnvelope(stray.id)).status, 'draft');

  const hidden = await svc.getEnvelope(env.id);
  assert.ok(hidden.deletedAt);
  assert.equal(hidden.status, 'completed');
  assert.equal(hidden.chainValid, true);
  assert.equal(hidden.events.at(-1).label, 'Moved to Deleted');
  assert.equal((await svc.listEnvelopes()).find((e) => e.id === env.id).deletedAt, hidden.deletedAt, 'the list carries it for the Deleted folder');

  const copy = mail.find((m) => m.subject.startsWith('Completed') && m.to === 'ada@example.com');
  const session = await svc.signerSession(linkIn(copy));
  assert.equal(session.state, 'completed', 'the emailed copy link still works');
  const { bytes } = await svc.signerSealedFile(linkIn(copy));
  assert.equal((await svc.verifyHash(sha256Hex(bytes))).found, true, 'and so does checking the file');

  const events = hidden.events.length;
  await svc.deleteEnvelopes([env.id], SENDER, INFO);
  assert.equal((await svc.getEnvelope(env.id)).events.length, events, 'deleting twice changes nothing');

  await svc.restoreEnvelopes([env.id], SENDER, INFO);
  const back = await svc.getEnvelope(env.id);
  assert.equal(back.deletedAt, null);
  assert.equal(back.events.at(-1).label, 'Restored from Deleted');
  assert.equal(back.chainValid, true);
  await svc.restoreEnvelopes([env.id], SENDER, INFO);
  assert.equal((await svc.getEnvelope(env.id)).events.length, back.events.length);
});

test('only the owner can erase a document, and only from Deleted', async (t) => {
  const { svc, store, sent: mail } = harness(t);
  const { user: owner } = await signIn(svc, mail, SENDER.email);
  await svc.addAdmin(owner, { name: 'Karl Li', email: 'karl.admin@example.com' });
  const { user: admin } = await signIn(svc, mail, 'karl.admin@example.com');

  const env = await draft(svc, { recipients: [{ id: 'a', name: 'Ada Investor', email: 'ada@example.com' }] });
  await sent(svc, env);
  await signAs(svc, linkIn(mail.find((m) => m.to === 'ada@example.com')), { name: 'Ada' });
  const copy = mail.find((m) => m.subject.startsWith('Completed') && m.to === 'ada@example.com');
  const { bytes } = await svc.signerSealedFile(linkIn(copy));
  const sealed = await svc.getEnvelope(env.id);

  await assert.rejects(svc.eraseEnvelopes(owner, [env.id]), httpError(409), 'it has to be in Deleted first');
  await svc.deleteEnvelopes([env.id], admin, INFO);
  await assert.rejects(svc.eraseEnvelopes(admin, [env.id]), httpError(403), 'an admin cannot erase');
  assert.ok(await svc.getEnvelope(env.id));

  await svc.eraseEnvelopes(owner, [env.id]);
  await assert.rejects(svc.getEnvelope(env.id), httpError(404));
  assert.equal((await svc.listEnvelopes()).length, 0);
  assert.deepEqual(await svc.verifyHash(sha256Hex(bytes)), { found: false }, 'the file no longer checks out');
  assert.equal(await store.getRecord('hashes', sealed.sealed.sha256), null);
  assert.equal(await store.getBlob(sealed.document.key ?? `envelopes/${env.id}/original.pdf`), null, 'the original is gone');
  await assert.rejects(svc.signerSession(linkIn(copy)), httpError(404), 'the copy link stops working');
  await assert.rejects(svc.eraseEnvelopes(owner, [env.id]), httpError(404));
});

test('erasing checks every document before it removes any', async (t) => {
  const { svc, sent: mail } = harness(t);
  const { user: owner } = await signIn(svc, mail, SENDER.email);
  const voided = async () => {
    const env = await draft(svc, { recipients: [{ id: 'a', name: 'Ada Investor', email: 'ada@example.com' }] });
    await sent(svc, env);
    await svc.voidEnvelope(env.id, 'Wrong version', SENDER, INFO);
    return env;
  };
  const inDeleted = await voided();
  const stillListed = await voided();
  await svc.deleteEnvelopes([inDeleted.id], SENDER, INFO);

  await assert.rejects(svc.eraseEnvelopes(owner, [inDeleted.id, stillListed.id]), httpError(409));
  assert.ok(await svc.getEnvelope(inDeleted.id), 'the one in Deleted is still there');
});

test('a voided document can be deleted, and every signer hears when all have signed', async (t) => {
  const { svc, sent: mail } = harness(t);
  const voided = await draft(svc);
  await sent(svc, voided);
  await svc.voidEnvelope(voided.id, 'Wrong version', SENDER, INFO);
  await svc.deleteEnvelopes([voided.id], SENDER, INFO);
  assert.ok((await svc.getEnvelope(voided.id)).deletedAt);

  const env = await draft(svc);
  await sent(svc, env);
  const [ada, karl] = ['ada@example.com', 'karl@example.com'].map((to) => mail.filter((m) => m.to === to && /Subscription Agreement" to sign/.test(m.subject)).at(-1));
  await signAs(svc, linkIn(ada), { name: 'Ada' });
  assert.equal(mail.filter((m) => m.subject.startsWith('Completed')).length, 0, 'nobody hears until everyone has signed');
  await signAs(svc, linkIn(karl), { name: 'Karl' });
  const done = mail.filter((m) => m.subject.startsWith('Completed'));
  assert.deepEqual(done.map((m) => m.to).sort(), ['ada@example.com', SENDER.email, 'karl@example.com'].sort());
  assert.ok(done.every((m) => m.attachments?.length === 1), 'each one carries the signed PDF');
});

test('non-Latin names and values seal, keeping pages and text', async (t) => {
  const { svc, store, sent: mail } = harness(t);
  const env = await draft(svc, {
    recipients: [{ id: 'a', name: 'José 李明 Ирина محمد 👍', email: 'jose@example.com' }],
    fields: [
      { recipientId: 'a', type: 'signature', page: 1, x: 0.1, y: 0.5, w: 0.3, h: 0.05 },
      { recipientId: 'a', type: 'text', page: 1, x: 0.1, y: 0.6, w: 0.6, h: 0.03, label: 'Address' },
    ],
  });
  await sent(svc, env);
  const token = linkIn(mail[0]);
  await svc.recordViewed(token, undefined, INFO);
  await svc.recordConsent(token, undefined, { version: '2026-10-31', previewed: true }, INFO);
  const fields = (await svc.signerSession(token)).fields;
  await svc.submit(token, undefined, {
    intent: true,
    signature: mark('José 李明'),
    values: { [fields.find((f) => f.type === 'text').id]: '北京市朝阳区 Straße 5' },
    timeZone: 'Not/AZone',
  }, INFO);

  const view = await svc.getEnvelope(env.id);
  assert.equal(view.status, 'completed');
  assert.equal(view.recipients[0].timeZone, 'UTC', 'a bad zone falls back rather than failing');
  if (hasTool('pdftotext')) {
    const dir = mkdtempSync(path.join(tmpdir(), 'sign-text-'));
    const file = path.join(dir, 'sealed.pdf');
    writeFileSync(file, await store.getBlob(view.sealed.key));
    const text = execFileSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8' });
    assert.ok(text.includes('李明'), 'CJK name on the certificate');
    assert.ok(text.includes('Ирина'), 'Cyrillic name on the certificate');
    assert.ok(text.includes('北京市朝阳区'), 'CJK value on the page');
    assert.ok(text.includes('Certificate of Completion'));
  }
});

test('the upload gate rejects anything that could not be sealed', async (t) => {
  const { svc } = harness(t);
  const upload = (bytes) => svc.createDraft(SENDER, 'x.pdf', bytes, INFO);
  await assert.rejects(upload(Buffer.from('hello this is not a pdf at all')), PdfRejected);
  const good = await makePdf();
  await assert.rejects(upload(good.subarray(0, 200)), PdfRejected);

  if (hasTool('qpdf')) {
    const dir = mkdtempSync(path.join(tmpdir(), 'sign-enc-'));
    const input = path.join(dir, 'in.pdf');
    writeFileSync(input, good);
    for (const [name, user] of [['user', 'open'], ['owner', '']]) {
      const output = path.join(dir, `${name}.pdf`);
      execFileSync('qpdf', ['--encrypt', user, 'ownerpw', '256', '--', input, output]);
      await assert.rejects(upload(readFileSync(output)), /password-protected/);
    }
  }
});

test('a name is stored without path pieces and the hash is of the uploaded bytes', async (t) => {
  const { svc } = harness(t);
  const bytes = await makePdf();
  const env = await svc.createDraft(SENDER, '../../etc/pass\u0000wd.pdf', bytes, INFO);
  assert.equal(env.document.fileName.includes('/'), false);
  assert.equal(env.document.sha256, sha256Hex(bytes));
});

test('a bulk send gives each person their own envelope and leaves the draft for next time', async (t) => {
  const { svc, store, sent: mail } = harness(t);
  const template = await draft(svc, {
    recipients: [
      { id: 'n', name: '', email: '' },
      { id: 'j', name: 'Johnson Jiang', email: 'johnsonjiang@solariavc.com' },
      { id: 'h', name: 'Records', email: 'records@example.com', role: 'cc' },
    ],
  });
  const people = [
    { name: 'Ada Hire', email: 'Ada@Example.com ' },
    { name: 'Bo Hire', email: 'bo@example.com' },
    { name: 'Cy Hire', email: 'cy@example.com' },
  ];
  const { results } = await svc.bulkSend(template.id, SENDER, INFO, { recipientId: template.recipients[0].id, people });
  assert.deepEqual(results.map((r) => [r.email, r.ok]), [['ada@example.com', true], ['bo@example.com', true], ['cy@example.com', true]]);

  const all = await svc.listEnvelopes();
  assert.equal(all.length, 4, 'three copies plus the draft');
  assert.equal((await svc.getEnvelope(template.id)).status, 'draft', 'the draft stays as it was');
  for (const r of results) {
    const env = await svc.getEnvelope(r.id);
    assert.equal(env.status, 'sent');
    assert.deepEqual(env.recipients.map((p) => p.email), [r.email, 'johnsonjiang@solariavc.com', 'records@example.com']);
    assert.ok(env.fields.every((f) => env.recipients.some((p) => p.id === f.recipientId)));
    assert.equal(env.events[0].details.bulkFrom, template.id);
    assert.equal(verifyChain((await store.getEnvelope(r.id)).data.events), true);
  }
  assert.equal(new Set(results.map((r) => r.id)).size, 3);
  const listed = (await svc.listEnvelopes()).filter((e) => e.batch);
  assert.equal(listed.length, 3, 'every copy is marked with its batch');
  assert.equal(new Set(listed.map((e) => e.batch.id)).size, 1);
  assert.equal(listed[0].batch.size, 3);
  assert.equal((await svc.listEnvelopes()).find((e) => e.id === template.id).batch, null, 'the draft is not part of it');
  for (const p of ['ada@example.com', 'bo@example.com', 'cy@example.com', 'johnsonjiang@solariavc.com']) {
    assert.equal(mail.filter((m) => m.to === p).length, p.startsWith('johnson') ? 3 : 1, `${p} got the right number of emails`);
  }

  // One person signing touches only their own copy.
  const ada = linkIn(mail.find((m) => m.to === 'ada@example.com'));
  await signAs(svc, ada, { name: 'Ada Hire' });
  const statuses = await Promise.all(results.map(async (r) => (await svc.getEnvelope(r.id)).recipients[0].status));
  assert.equal(statuses[0], 'signed');
  assert.notEqual(statuses[1], 'signed');
});

test('a bulk list with any bad row sends nothing', async (t) => {
  const { svc, sent: mail } = harness(t);
  const template = await draft(svc, { recipients: [{ id: 'n', name: '', email: '' }, { id: 'j', name: 'Johnson Jiang', email: 'johnsonjiang@solariavc.com' }] });
  const slot = template.recipients[0].id;
  const bulk = (people, recipientId = slot) => svc.bulkSend(template.id, SENDER, INFO, { recipientId, people });
  await assert.rejects(bulk([]), httpError(400));
  await assert.rejects(bulk([{ name: 'A', email: 'a@example.com' }, { name: 'B', email: 'not-an-email' }]), httpError(400));
  await assert.rejects(bulk([{ name: 'A', email: 'a@example.com' }, { name: 'A again', email: 'A@example.com' }]), httpError(400));
  await assert.rejects(bulk([{ name: '', email: 'a@example.com' }]), httpError(400));
  await assert.rejects(bulk([{ name: 'Me', email: 'johnsonjiang@solariavc.com' }]), httpError(400), 'a fixed signer cannot be on the list');
  await assert.rejects(bulk([{ name: 'A', email: 'a@example.com' }], 'rnope'), httpError(400));
  await assert.rejects(bulk(Array.from({ length: 51 }, (_, i) => ({ name: `P${i}`, email: `p${i}@example.com` }))), httpError(400));

  const unsigned = await draft(svc, { recipients: [{ id: 'n', name: '', email: '' }], fields: [] });
  await assert.rejects(svc.bulkSend(unsigned.id, SENDER, INFO, { recipientId: unsigned.recipients[0].id, people: [{ name: 'A', email: 'a@example.com' }] }), httpError(400));

  assert.equal(mail.length, 0);
  assert.equal((await svc.listEnvelopes()).length, 2, 'no copies were made');

  await sent(svc, await svc.updateDraft(template.id, { ...template, recipients: [{ ...template.recipients[0], name: 'X', email: 'x@example.com' }, template.recipients[1]] }));
  await assert.rejects(bulk([{ name: 'A', email: 'a@example.com' }]), httpError(409), 'a sent document is not a template');
});

test('a bulk send by link hands back one link per person', async (t) => {
  const { svc, sent: mail } = harness(t);
  const template = await draft(svc, { recipients: [{ id: 'n', name: '', email: '', delivery: 'link' }] });
  const { results } = await svc.bulkSend(template.id, SENDER, INFO, {
    recipientId: template.recipients[0].id,
    people: [{ name: 'Ada', email: 'ada@example.com' }, { name: 'Bo', email: 'bo@example.com' }],
  });
  assert.ok(results.every((r) => r.ok && r.links.length === 1 && r.links[0].url.includes('/s#')));
  assert.equal(mail.length, 0, 'link signers are not emailed');
});

test('several documents can be voided at once, and a stale selection voids none', async (t) => {
  const { svc, sent: mail } = harness(t);
  const one = await draft(svc);
  const two = await draft(svc);
  const still = await draft(svc);
  for (const env of [one, two, still]) await sent(svc, env);

  await assert.rejects(svc.voidEnvelopes([one.id, two.id], '  ', SENDER, INFO), httpError(400), 'a reason is required');
  const unsent = await draft(svc);
  await assert.rejects(svc.voidEnvelopes([one.id, unsent.id], 'Wrong terms', SENDER, INFO), httpError(409));
  assert.equal((await svc.getEnvelope(one.id)).status, 'sent', 'nothing was voided');

  mail.length = 0;
  assert.deepEqual(await svc.voidEnvelopes([one.id, two.id, one.id], 'Wrong terms', SENDER, INFO), { voided: 2 });
  for (const env of [one, two]) {
    const view = await svc.getEnvelope(env.id);
    assert.equal(view.status, 'voided');
    assert.equal(view.events.find((e) => e.type === 'envelope.voided').details.reason, 'Wrong terms');
  }
  assert.equal((await svc.getEnvelope(still.id)).status, 'sent');
  assert.equal(mail.length, 4, 'both signers on both documents were told');
  await assert.rejects(svc.voidEnvelopes([one.id], 'Again', SENDER, INFO), httpError(409));
});

test('reminding many documents emails only the people whose turn it is', async (t) => {
  const { svc, sent: mail } = harness(t);
  const both = await draft(svc);
  const half = await draft(svc);
  const ordered = await draft(svc, { sequential: true });
  const mine = await draft(svc, { recipients: [{ id: 'a', name: 'Johnson Jiang', email: SENDER.email }, { id: 'b', name: 'By Link', email: 'link@example.com', delivery: 'link' }] });
  for (const env of [both, half, ordered, mine]) await sent(svc, env);
  await signAs(svc, linkIn(mail.find((m) => m.to === 'ada@example.com' && m.text.includes(half.id))), { name: 'Ada' });
  const unsent = await draft(svc);

  mail.length = 0;
  const outcome = await svc.remindEnvelopes([both.id, half.id, ordered.id, mine.id, unsent.id], SENDER);
  assert.deepEqual(outcome, { reminded: 4, skipped: 2, failed: [] });
  assert.deepEqual(mail.map((m) => m.to).sort(), ['ada@example.com', 'ada@example.com', 'karl@example.com', 'karl@example.com']);
  assert.ok(mail.every((m) => m.subject.startsWith('Reminder:') && linkIn(m)));
  const reminded = (await svc.getEnvelope(both.id)).events.filter((e) => e.type === 'recipient.reminded');
  assert.equal(reminded.length, 2);
});

test('a sender signs their own place on many copies from the documents page', async (t) => {
  const { svc, store, sent: mail } = harness(t);
  const template = await draft(svc, {
    recipients: [{ id: 'n', name: '', email: '' }, { id: 'j', name: 'Johnson Jiang', email: SENDER.email }],
  });
  const people = ['ada', 'bo', 'cy'].map((n) => ({ name: n, email: `${n}@example.com` }));
  const { results } = await svc.bulkSend(template.id, SENDER, INFO, { recipientId: template.recipients[0].id, people });
  const [first] = await Promise.all(results.map((r) => svc.getEnvelope(r.id)));
  // Ada signs first, so Johnson's signature finishes her copy.
  await signAs(svc, linkIn(mail.find((m) => m.to === 'ada@example.com')), { name: 'Ada' });

  const body = { rendered: [first.document.sha256], consent: true, disclosureVersion: '2026-10-31', intent: true, signature: mark('Johnson Jiang'), timeZone: 'America/Los_Angeles' };
  const other = { email: 'karl@solariavc.com', name: 'Karl' };
  await assert.rejects(svc.signMine(other, results[0].id, body, INFO), httpError(409), 'nobody signs in another person\'s place');
  await assert.rejects(svc.signMine(SENDER, results[0].id, { ...body, rendered: ['abc'] }, INFO), httpError(409), 'the file must have been shown');
  await assert.rejects(svc.signMine(SENDER, results[0].id, { ...body, consent: false }, INFO), httpError(409));
  await assert.rejects(svc.signMine(SENDER, results[0].id, { ...body, intent: false }, INFO), httpError(400));

  for (const r of results) await svc.signMine(SENDER, r.id, body, INFO);
  await assert.rejects(svc.signMine(SENDER, results[0].id, body, INFO), httpError(409), 'twice is refused');

  const ada = await svc.getEnvelope(results[0].id);
  assert.equal(ada.status, 'completed', 'the last signature seals the document');
  for (const r of results) {
    const stored = (await store.getEnvelope(r.id)).data;
    const me = stored.recipients.find((p) => p.email === SENDER.email);
    assert.equal(me.status, 'signed');
    const types = stored.events.filter((e) => e.actor?.recipientId === me.id).map((e) => e.type);
    assert.deepEqual(types.filter((type) => type !== 'recipient.notified').slice(0, 3), ['recipient.viewed', 'recipient.consented', 'recipient.signed']);
    assert.equal(stored.events.find((e) => e.type === 'recipient.signed' && e.actor.recipientId === me.id).details.via, 'documents page');
    assert.equal(verifyChain(stored.events), true);
  }
  assert.equal((await svc.getEnvelope(results[1].id)).status, 'sent', 'Bo still has to sign his own copy');
});

test('a sender cannot batch-sign a document with fields only they can fill in', async (t) => {
  const { svc } = harness(t);
  const env = await draft(svc, {
    recipients: [{ id: 'j', name: 'Johnson Jiang', email: SENDER.email }],
    fields: [
      { recipientId: 'j', type: 'signature', page: 1, x: 0.1, y: 0.5, w: 0.3, h: 0.05 },
      { recipientId: 'j', type: 'text', page: 1, x: 0.1, y: 0.7, w: 0.3, h: 0.03, required: true, label: 'Title' },
    ],
  });
  await sent(svc, env);
  const body = { rendered: [env.document.sha256], consent: true, disclosureVersion: '2026-10-31', intent: true, signature: mark('Johnson Jiang'), timeZone: 'UTC' };
  await assert.rejects(svc.signMine(SENDER, env.id, body, INFO), httpError(409));
});

test('a signer sees all their documents at /sign/my and can open each one', async (t) => {
  const { svc, sent: mail } = harness(t);
  const one = await draft(svc);
  const two = await draft(svc, { sequential: true, recipients: [{ id: 'b', name: 'Karl Partner', email: 'karl@example.com' }, { id: 'a', name: 'Ada Investor', email: 'ada@example.com' }] });
  const notMine = await draft(svc, { recipients: [{ id: 'b', name: 'Karl Partner', email: 'karl@example.com' }] });
  for (const env of [one, two, notMine]) await sent(svc, env);

  mail.length = 0;
  await svc.requestMyDocuments('stranger@example.com');
  assert.equal(mail.length, 0, 'an address with nothing gets nothing, and the answer looks the same');
  await svc.requestMyDocuments(' ADA@example.com ');
  const link = /\/sign\/my#(\S+)/.exec(mail[0].text)?.[1];
  assert.ok(link, 'the email carries a one-time link');
  const { sessionId } = await svc.openMyDocuments(link);
  await assert.rejects(svc.openMyDocuments(link), httpError(400), 'it works once');
  const email = await svc.myEmail(sessionId);
  assert.equal(email, 'ada@example.com');

  const list = await svc.listMyDocuments(email);
  assert.deepEqual(list.map((d) => [d.id, d.state]).sort(), [[one.id, 'sign'], [two.id, 'waiting']].sort());
  assert.equal(list[0].state, 'sign', 'what needs signing comes first');
  await assert.rejects(svc.openMyDocument(email, notMine.id), httpError(404), 'only their own documents');

  const { url } = await svc.openMyDocument(email, one.id);
  const token = /\/s#(\S+)/.exec(url)[1];
  await signAs(svc, token, { name: 'Ada' });
  assert.equal((await svc.listMyDocuments(email)).find((d) => d.id === one.id).state, 'signed');
  await svc.endMyDocuments(sessionId);
  assert.equal(await svc.myEmail(sessionId), null);
});
