import test from 'node:test';
import assert from 'node:assert/strict';
import { INFO, SENDER, draft, harness, linkIn, signAs } from './sign-helpers.js';
import { runMigrations } from '../server/sign/migrations.js';
import { fitText } from '../server/sign/fit.js';

const httpError = (status) => (e) => e.status === status;
const BOXES = (group) => [
  { recipientId: 'a', type: 'signature', page: 1, x: 0.1, y: 0.5, w: 0.3, h: 0.05 },
  { recipientId: 'a', type: 'checkbox', page: 1, x: 0.1, y: 0.7, w: 0.03, h: 0.03, required: true, label: '', ...(group ? { group } : {}) },
  { recipientId: 'a', type: 'checkbox', page: 1, x: 0.1, y: 0.75, w: 0.03, h: 0.03, required: true, label: '', ...(group ? { group } : {}) },
];
const ADA = [{ id: 'a', name: 'Ada Investor', email: 'ada@example.com' }];

async function sentDoc(svc, fields, title) {
  const env = await draft(svc, { recipients: ADA, fields });
  if (title) await svc.updateDraft(env.id, { ...(await svc.getEnvelope(env.id)), title });
  await svc.send(env.id, SENDER, INFO);
  return svc.getEnvelope(env.id);
}

test('a choose-one group takes exactly one tick', async (t) => {
  const { svc, sent: mail } = harness(t);
  const env = await sentDoc(svc, BOXES('A'));
  const [one, two] = env.fields.filter((f) => f.type === 'checkbox');
  assert.equal(one.group, 'A');
  const token = await linkIn(svc, mail.find((m) => m.envelopeId === env.id));
  const session = await svc.signerSession(token);
  assert.ok(session.fields.filter((f) => f.type === 'checkbox').every((f) => f.group === 'A'), 'the signer sees the group');
  await assert.rejects(signAs(svc, token, { values: { [one.id]: true, [two.id]: true } }), httpError(400), 'not both');
  await assert.rejects(signAs(svc, token, { values: {} }), httpError(400), 'not neither');
  await signAs(svc, token, { values: { [two.id]: true } });
  const done = await svc.getEnvelope(env.id);
  assert.deepEqual(done.fields.filter((f) => f.type === 'checkbox').map((f) => f.value), [false, true]);
});

test('boxes sent as both-required are fixed in place, unless already signed', async (t) => {
  const { svc, store, sent: mail } = harness(t);
  const title = 'Solaria Capital - Executive Board Position Confirmation';
  const open = await sentDoc(svc, BOXES(), title);
  const signed = await sentDoc(svc, BOXES(), title);
  const other = await sentDoc(svc, BOXES(), 'Something else');
  const ids = signed.fields.filter((f) => f.type === 'checkbox').map((f) => f.id);
  await signAs(svc, await linkIn(svc, mail.find((m) => m.envelopeId === signed.id)), { values: { [ids[0]]: true, [ids[1]]: true } });

  await runMigrations(svc, store, { log: () => {} });
  const fixed = (await store.getEnvelope(open.id)).data;
  assert.deepEqual(fixed.fields.filter((f) => f.type === 'checkbox').map((f) => f.group), ['A', 'A']);
  assert.equal(fixed.events.at(-1).type, 'fields.choice_group');
  assert.match(fixed.events.at(-1).details.reason, /check one/);
  assert.ok((await store.getEnvelope(signed.id)).data.fields.every((f) => !f.group), 'a signed document is left alone');
  assert.ok((await store.getEnvelope(other.id)).data.fields.every((f) => !f.group), 'other documents are untouched');

  // Ada can now tick one and sign.
  const box = fixed.fields.find((f) => f.type === 'checkbox');
  await signAs(svc, await linkIn(svc, mail.find((m) => m.envelopeId === open.id)), { values: { [box.id]: true } });
  assert.equal((await svc.getEnvelope(open.id)).status, 'completed');

  // Running again changes nothing.
  const before = (await store.getEnvelope(open.id)).data.events.length;
  await runMigrations(svc, store, { log: () => {} });
  assert.equal((await store.getEnvelope(open.id)).data.events.length, before);
});

test('a long answer wraps onto more lines when the box has room, and is never cut', () => {
  const measure = (text, size) => text.length * size * 0.5;
  const short = fitText('Treasurer', 200, 14, 14, measure);
  assert.equal(short.lines.length, 1);
  const long = 'Managing the club treasury, preparing quarterly reports for members, and coordinating with the LLC on contributions';
  const tall = fitText(long, 400, 40, 14, measure);
  assert.ok(tall.lines.length > 1, 'wraps in a tall box');
  assert.equal(tall.lines.join(' '), long, 'every word is kept');
  for (const line of tall.lines) assert.ok(measure(line, tall.size) <= 400 + 0.01);
  const flat = fitText(long, 400, 14, 14, measure);
  assert.ok(flat.lines.every((line) => measure(line, flat.size) <= 400 + 0.01), 'shrinks to fit a one-line box');
});
