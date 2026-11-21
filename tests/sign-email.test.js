// What happens when email does not go out: above all the mail provider's daily
// allowance running out, which stops every email until the next day.
import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpError } from '../server/sign/envelopes.js';
import { createMailer } from '../server/sign/mail.js';
import { INFO, SENDER, draft, harness, linkIn, mark, signAs } from './sign-helpers.js';

const httpError = (status) => (e) => e instanceof HttpError && e.status === status;
const send = (svc, env) => svc.send(env.id, SENDER, INFO);
const requests = (mail, to) => mail.filter((m) => m.to === to && / to sign|waiting for your signature/.test(m.subject));

test('a spent daily allowance fails at once, while a burst is waited out', async (t) => {
  const realFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = realFetch; });
  const mailer = createMailer({ resendKey: 'test', from: 'Solaria <sign@example.com>' });
  const message = { to: 'a@example.com', subject: 'Hello', html: '', text: '' };

  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ statusCode: 429, name: 'daily_quota_exceeded', message: 'You have reached your daily email sending quota.' }), { status: 429 });
  };
  await assert.rejects(mailer(message), (e) => e.quota === true);
  assert.equal(calls, 1, 'it is not tried again');

  calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return calls < 3
      ? new Response(JSON.stringify({ name: 'rate_limit_exceeded' }), { status: 429, headers: { 'retry-after': '0.01' } })
      : new Response(JSON.stringify({ id: 'm1' }), { status: 200 });
  };
  assert.equal(await mailer(message), 'm1');
  assert.equal(calls, 3, 'a rate limit is retried until it passes');

  globalThis.fetch = async () => new Response('bad address', { status: 422 });
  await assert.rejects(mailer(message), (e) => !e.quota && /422/.test(e.message));

  // The month's allowance is told apart from the day's, and it goes by the
  // error's name: a rate limit whose message mentions a quota is still a burst.
  globalThis.fetch = async () => new Response(JSON.stringify({ name: 'monthly_quota_exceeded', message: 'You have exceeded your monthly email sending quota.' }), { status: 429 });
  await assert.rejects(mailer(message), (e) => e.quota === true && e.monthly === true);
  calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return calls < 2
      ? new Response(JSON.stringify({ name: 'rate_limit_exceeded', message: 'Too many requests for your quota tier.' }), { status: 429, headers: { 'retry-after': '0.01' } })
      : new Response(JSON.stringify({ id: 'm2' }), { status: 200 });
  };
  assert.equal(await mailer(message), 'm2');
});

test('a list stops at the email limit, and says who is left', async (t) => {
  const { svc, sent: mail, failMailWhen } = harness(t);
  const template = await draft(svc, { recipients: [{ id: 'n', name: '', email: '' }] });
  const people = ['Ada', 'Bo', 'Cy', 'Di'].map((name) => ({ name, email: `${name.toLowerCase()}@example.com` }));
  failMailWhen((m) => (m.to === 'ada@example.com' ? false : 'quota'));

  const { results, quota, resumes } = await svc.bulkSend(template.id, SENDER, INFO, { recipientId: template.recipients[0].id, people });
  assert.equal(quota, true);
  // The allowance resets at midnight UTC, and the sender is told when that is.
  const reset = new Date(resumes);
  assert.deepEqual([reset.getUTCHours(), reset.getUTCMinutes()], [0, 0]);
  assert.ok(reset > new Date() && reset - new Date() <= 24 * 3_600_000);
  assert.deepEqual(results.map((r) => [r.name, r.ok, Boolean(r.emailFailed), Boolean(r.unsent)]), [
    ['Ada', true, false, false],
    ['Bo', true, true, false],
    ['Cy', false, false, true],
    ['Di', false, false, true],
  ]);
  assert.equal(results[1].quota, true);
  assert.equal((await svc.listEnvelopes()).length, 3, 'nothing was made for the people it never reached');
  assert.equal(mail.length, 1);

  // Straight afterwards the next list waits too, rather than finding out one copy at a time.
  failMailWhen(() => false);
  const again = await svc.bulkSend(template.id, SENDER, INFO, { recipientId: template.recipients[0].id, people: people.slice(2) });
  assert.equal(again.quota, true);
  assert.ok(again.results.every((r) => r.unsent));
  assert.equal((await svc.listEnvelopes()).length, 3);
});

test('an email that never went out shows on the document and is sent again as a first email', async (t) => {
  const { svc, sent: mail, failMailWhen } = harness(t);
  const env = await draft(svc);
  failMailWhen((m) => (m.to === 'karl@example.com' ? 'quota' : false));
  const first = await send(svc, env);
  assert.deepEqual([first.failed, first.quota], [['Karl Partner'], true]);

  const flags = (view) => view.recipients.map((r) => r.emailFailed ?? null);
  assert.deepEqual(flags(await svc.getEnvelope(env.id)), [null, 'request']);
  assert.deepEqual(flags((await svc.listEnvelopes()).find((e) => e.id === env.id)), [null, 'request'], 'the documents list shows it too');
  const failure = (await svc.getEnvelope(env.id)).events.find((e) => e.type === 'recipient.notify_failed');
  assert.equal(failure.details.reason, 'email limit reached');

  // While the limit lasts, sending again fails plainly and changes nothing.
  const stuck = await svc.resendFailed([env.id], SENDER);
  assert.deepEqual([stuck.reminded, stuck.failed, stuck.quota], [0, ['Karl Partner'], true]);

  failMailWhen(() => false);
  mail.length = 0;
  const outcome = await svc.resendFailed([env.id], SENDER);
  assert.deepEqual([outcome.reminded, outcome.documents, outcome.failed, outcome.copies], [1, 1, [], 0]);
  assert.deepEqual(mail.map((m) => m.to), ['karl@example.com'], 'the signer who was reached hears nothing more');
  assert.doesNotMatch(mail[0].subject, /Reminder/, 'the first email they see is not a reminder');
  const view = await svc.getEnvelope(env.id);
  assert.deepEqual(flags(view), [null, null]);
  assert.equal(view.events.at(-1).type, 'recipient.notified');
  assert.equal(view.chainValid, true);

  // Now that it reached them, the next one is a reminder.
  await svc.remind(env.id, view.recipients[1].id);
  assert.match(mail.at(-1).subject, /^Reminder:/);
  assert.deepEqual(await svc.resendFailed([env.id], SENDER).then((o) => [o.reminded, o.copies]), [0, 0], 'nothing is left to send');
});

test('someone who found the document anyway is not flagged, and a single resend names the limit', async (t) => {
  const { svc, sent: mail, failMailWhen } = harness(t);
  const env = await draft(svc, { recipients: [{ id: 'a', name: 'Ada Investor', email: 'ada@example.com' }] });
  await send(svc, env);
  const other = await draft(svc, { recipients: [{ id: 'a', name: 'Ada Investor', email: 'ada@example.com' }] });
  failMailWhen(() => 'quota');
  await send(svc, other);
  const ada = (await svc.getEnvelope(other.id)).recipients[0];
  assert.equal(ada.emailFailed, 'request');
  await assert.rejects(svc.remind(other.id, ada.id), httpError(503), 'the reason is given, not a vague failure');

  // The first email's link opens her page, which lists both documents.
  failMailWhen(() => false);
  const { sessionId } = await svc.openMyDocuments(/\/sign#(\S+)/.exec(mail[0].text)[1]);
  const { url } = await svc.openMyDocument(await svc.myEmail(sessionId), other.id);
  await svc.recordViewed(/\/s#(\S+)/.exec(url)[1], undefined, INFO);
  assert.equal((await svc.getEnvelope(other.id)).recipients[0].emailFailed, undefined);
});

test('several documents that never reached one person go out as one first email', async (t) => {
  const { svc, sent: mail, failMailWhen } = harness(t);
  const one = await draft(svc, { recipients: [{ id: 'a', name: 'Ada Investor', email: 'ada@example.com' }] });
  const two = await draft(svc, { recipients: [{ id: 'a', name: 'Ada Investor', email: 'ada@example.com' }] });
  failMailWhen(() => 'quota');
  await send(svc, one);
  await send(svc, two);
  failMailWhen(() => false);

  const outcome = await svc.resendFailed([one.id, two.id], SENDER);
  assert.deepEqual([outcome.reminded, outcome.documents], [1, 2]);
  assert.equal(mail.length, 1);
  assert.equal(mail[0].subject, 'Johnson Jiang sent you 2 documents to sign');
  assert.match(mail[0].text, /Subscription Agreement \(2 copies\)/);
  for (const env of [one, two]) {
    const view = await svc.getEnvelope(env.id);
    assert.equal(view.events.at(-1).type, 'recipient.notified');
    assert.equal(view.events.at(-1).details.together, 2);
    assert.equal(view.recipients[0].emailFailed, undefined);
  }
  assert.equal((await svc.listMyDocuments('ada@example.com')).filter((d) => d.state === 'sign').length, 2);
});

test('reminders stop at the email limit and say so', async (t) => {
  const { svc, failMailWhen } = harness(t);
  const envs = [];
  for (const name of ['Ada', 'Bo', 'Cy']) {
    const env = await draft(svc, { recipients: [{ id: 'a', name, email: `${name.toLowerCase()}@example.com` }] });
    await send(svc, env);
    envs.push(env);
  }
  let tried = 0;
  failMailWhen(() => {
    tried += 1;
    return 'quota';
  });
  const outcome = await svc.remindEnvelopes(envs.map((e) => e.id), SENDER);
  assert.equal(outcome.quota, true);
  assert.equal(outcome.reminded, 0);
  assert.equal(outcome.failed.length, 3);
  assert.equal(tried, 1, 'nobody further down the list is tried');
});

test('a signed copy that did not go out is flagged and sent again to that person alone', async (t) => {
  const { svc, sent: mail, failMailWhen } = harness(t);
  const env = await draft(svc);
  await send(svc, env);
  await signAs(svc, await linkIn(svc, mail.find((m) => m.to === 'ada@example.com')));
  failMailWhen((m) => (m.to === 'ada@example.com' ? 'quota' : false));
  await signAs(svc, await linkIn(svc, mail.find((m) => m.to === 'karl@example.com')));

  let view = await svc.getEnvelope(env.id);
  assert.equal(view.status, 'completed');
  assert.deepEqual(view.recipients.map((r) => r.emailFailed ?? null), ['copy', null]);

  failMailWhen(() => false);
  mail.length = 0;
  const outcome = await svc.resendFailed([env.id], SENDER);
  assert.deepEqual([outcome.copies, outcome.failed], [1, []]);
  assert.deepEqual(mail.map((m) => m.to), ['ada@example.com']);
  assert.ok(mail[0].attachments?.length, 'the signed PDF is attached');
  view = await svc.getEnvelope(env.id);
  assert.deepEqual(view.recipients.map((r) => r.emailFailed ?? null), [null, null]);
});

test('with email stopped, sign-in says so to everyone alike', async (t) => {
  const { svc, sent: mail, failMailWhen } = harness(t);
  const env = await draft(svc, { recipients: [{ id: 'a', name: 'Ada Investor', email: 'ada@example.com' }] });
  await send(svc, env);
  failMailWhen(() => 'quota');
  await assert.rejects(svc.requestLogin(SENDER.email), httpError(503));
  failMailWhen(() => false);
  mail.length = 0;
  for (const email of [SENDER.email, 'ada@example.com', 'stranger@example.com']) {
    await assert.rejects(svc.requestLogin(email), (e) => e.status === 503 && /today's email limit has been reached\. Please try again in about (an hour|\d+ hours)\./.test(e.message), `${email} is told the same`);
  }
  assert.equal(mail.length, 0);
});

test('signing emails say plainly which is the first and which is a reminder', async (t) => {
  const { svc, sent: mail } = harness(t);
  const env = await draft(svc, { recipients: [{ id: 'a', name: 'Ada Investor', email: 'ada@example.com' }] });
  await send(svc, env);
  const ada = (await svc.getEnvelope(env.id)).recipients[0];
  await svc.remind(env.id, ada.id);
  assert.deepEqual(requests(mail, 'ada@example.com').map((m) => m.subject.startsWith('Reminder:')), [false, true]);
});

test('voiding does not write to someone the request never reached', async (t) => {
  const { svc, sent: mail, failMailWhen } = harness(t);
  const env = await draft(svc);
  failMailWhen((m) => (m.to === 'karl@example.com' ? 'quota' : false));
  await send(svc, env);
  failMailWhen(() => false);
  mail.length = 0;
  await svc.voidEnvelope(env.id, 'Sent by mistake', SENDER, INFO);
  assert.deepEqual(mail.map((m) => [m.to, m.subject.startsWith('Cancelled')]), [['ada@example.com', true]]);
});

test('a list from someone else tells the countersigner once, and the link opens every copy', async (t) => {
  const { svc, sent: mail } = harness(t);
  const admin = { email: 'dana@solariavc.com', name: 'Dana Admin' };
  const template = await draft(svc, { recipients: [{ id: 'n', name: '', email: '' }, { id: 'j', name: 'Johnson Jiang', email: SENDER.email }] });
  const people = ['Ada', 'Bo', 'Cy'].map((name) => ({ name, email: `${name.toLowerCase()}@example.com` }));
  const { results, unmailed } = await svc.bulkSend(template.id, admin, INFO, { recipientId: template.recipients[0].id, people });
  assert.equal(unmailed, undefined);
  assert.equal(mail.length, 4, 'three people and one countersigner');
  const toMe = mail.filter((m) => m.to === SENDER.email);
  assert.equal(toMe.length, 1);
  assert.equal(toMe[0].subject, 'Dana Admin sent you 3 documents to sign');
  const { sessionId } = await svc.openMyDocuments(/\/sign#(\S+)/.exec(toMe[0].text)[1]);
  assert.equal((await svc.listMyDocuments(await svc.myEmail(sessionId))).filter((d) => d.state === 'sign').length, 3);
  assert.ok(results.every((r) => r.ok));

  // A list of one is just a document: its own email, as before.
  mail.length = 0;
  await svc.bulkSend(template.id, admin, INFO, { recipientId: template.recipients[0].id, people: [{ name: 'Di', email: 'di@example.com' }] });
  assert.deepEqual(mail.map((m) => [m.to, / sent you "?Subscription Agreement"? to sign/.test(m.subject)]).sort(), [['di@example.com', true], [SENDER.email, true]].sort());
});

test('the countersigner\'s one email failing is recorded on every copy and sent again together', async (t) => {
  const { svc, sent: mail, failMailWhen } = harness(t);
  const admin = { email: 'dana@solariavc.com', name: 'Dana Admin' };
  const template = await draft(svc, { recipients: [{ id: 'n', name: '', email: '' }, { id: 'j', name: 'Johnson Jiang', email: SENDER.email }] });
  const people = ['Ada', 'Bo'].map((name) => ({ name, email: `${name.toLowerCase()}@example.com` }));
  failMailWhen((m) => m.to === SENDER.email);
  const { results, unmailed } = await svc.bulkSend(template.id, admin, INFO, { recipientId: template.recipients[0].id, people });
  assert.deepEqual(unmailed, ['Johnson Jiang']);
  for (const r of results) {
    assert.deepEqual((await svc.getEnvelope(r.id)).recipients.map((p) => p.emailFailed ?? null), [null, 'request']);
  }
  failMailWhen(() => false);
  mail.length = 0;
  const outcome = await svc.resendFailed(results.map((r) => r.id), admin);
  assert.deepEqual([outcome.reminded, outcome.documents, outcome.failed], [1, 2, []]);
  assert.deepEqual(mail.map((m) => m.to), [SENDER.email], 'the two people who were reached hear nothing more');
});

test('a sender who also signed gets one signed copy, not two', async (t) => {
  const { svc, sent: mail } = harness(t);
  const env = await draft(svc, { recipients: [{ id: 'a', name: 'Ada Investor', email: 'ada@example.com' }, { id: 'j', name: 'Johnson Jiang', email: SENDER.email }] });
  await send(svc, env);
  await signAs(svc, await linkIn(svc, mail.find((m) => m.to === 'ada@example.com')));
  await signAs(svc, await linkIn(svc, mail.find((m) => m.to === SENDER.email)), { name: 'Johnson Jiang' });
  const copies = mail.filter((m) => m.subject.startsWith('Completed'));
  assert.deepEqual(copies.map((m) => m.to).sort(), ['ada@example.com', SENDER.email].sort());
  assert.match(copies.find((m) => m.to === SENDER.email).text, /\/sign\/e\//, 'theirs opens the document in Solaria Sign');
  assert.ok(copies.every((m) => m.attachments?.length === 1));
  const view = await svc.getEnvelope(env.id);
  assert.equal(view.events.filter((e) => e.type === 'copy.sent').length, 2);
  assert.ok(view.recipients.every((r) => r.copySentAt && !r.emailFailed));

  // Someone who only sent it still gets theirs.
  const other = await draft(svc);
  await send(svc, other);
  for (const to of ['ada@example.com', 'karl@example.com']) await signAs(svc, await linkIn(svc, mail.find((m) => m.to === to && m.envelopeId === other.id)));
  assert.equal(mail.filter((m) => m.subject.startsWith('Completed') && m.to === SENDER.email).length, 2);
});

test('a document with a box to tick is left out of signing everything at once', async (t) => {
  const { svc, sent: mail } = harness(t);
  const plain = await draft(svc, { recipients: [{ id: 'a', name: 'Ada Investor', email: 'ada@example.com' }] });
  const boxed = await draft(svc, {
    recipients: [{ id: 'a', name: 'Ada Investor', email: 'ada@example.com' }],
    fields: [
      { recipientId: 'a', type: 'signature', page: 1, x: 0.1, y: 0.5, w: 0.3, h: 0.05 },
      { recipientId: 'a', type: 'checkbox', page: 1, x: 0.1, y: 0.3, w: 0.03, h: 0.02, group: 'A' },
      { recipientId: 'a', type: 'checkbox', page: 1, x: 0.1, y: 0.35, w: 0.03, h: 0.02, group: 'A' },
    ],
  });
  const optional = await draft(svc, {
    recipients: [{ id: 'a', name: 'Ada Investor', email: 'ada@example.com' }],
    fields: [
      { recipientId: 'a', type: 'signature', page: 1, x: 0.1, y: 0.5, w: 0.3, h: 0.05 },
      { recipientId: 'a', type: 'checkbox', page: 1, x: 0.1, y: 0.3, w: 0.03, h: 0.02, required: false },
    ],
  });
  for (const env of [plain, boxed, optional]) await send(svc, env);
  const mine = await svc.listMyDocuments('ada@example.com');
  assert.deepEqual(Object.fromEntries(mine.map((d) => [d.id, d.boxes])), { [plain.id]: false, [boxed.id]: true, [optional.id]: false });

  const body = { rendered: [boxed.document.sha256], consent: true, disclosureVersion: '2026-10-31', intent: true, signature: mark('Ada Investor'), timeZone: 'UTC' };
  await assert.rejects(
    svc.signMine({ email: 'ada@example.com' }, boxed.id, body, INFO, { signer: true }),
    (e) => e.status === 409 && /Review and sign/.test(e.message) && !/from your email/.test(e.message),
    'the refusal points at what to do on the page they are on',
  );
  assert.ok(mail.length);
});

test('a dead signing link says where to go instead', async (t) => {
  const { svc } = harness(t);
  await assert.rejects(svc.signerSession(`${'A'.repeat(12)}.r${'0'.repeat(10)}.${'x'.repeat(43)}`), (e) => e.status === 404 && /solariavc\.com\/sign/.test(e.message));
});

test('a spent monthly allowance is not promised back at midnight', async (t) => {
  const { svc, failMailWhen } = harness(t);
  const env = await draft(svc, { recipients: [{ id: 'a', name: 'Ada Investor', email: 'ada@example.com' }] });
  failMailWhen(() => 'monthly');
  const first = await send(svc, env);
  assert.deepEqual([first.quota, first.resumes], [true, null]);
  await assert.rejects(svc.requestLogin(SENDER.email), (e) => e.status === 503 && /this month's email limit/.test(e.message) && !/hours?\b/.test(e.message));
  const ada = (await svc.getEnvelope(env.id)).recipients[0];
  await assert.rejects(svc.remind(env.id, ada.id), (e) => e.status === 503 && /This month's email limit has been reached, so this could not be sent\. Get a link to share yourself\./.test(e.message));
});
