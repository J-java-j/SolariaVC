// Opt-in only. Never connects to a real Google Cloud project.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { Firestore } from '@google-cloud/firestore';
import { createFirestoreStore } from '../server/contact-firestore-store.js';

const endpoint = process.env.FIRESTORE_EMULATOR_HOST;

test('real Firestore emulator enforces shared quotas, budgets, verification and expiry', { skip: !endpoint, timeout: 60_000 }, async t => {
  assert.match(endpoint, /^(?:127\.0\.0\.1|localhost|\[::1\]):\d{1,5}$/, 'Only a local emulator is permitted');
  const firestore = new Firestore({ projectId: 'demo-solaria-contact-protection' });
  const collection = `test_solaria_contact_${randomUUID().replaceAll('-', '')}`;
  const a = createFirestoreStore({ firestore, collection });
  const b = createFirestoreStore({ firestore, collection });
  const reference = (kind, key) => firestore.collection(collection).doc(`${kind}_${createHash('sha256').update(key).digest('hex')}`);
  t.after(async () => {
    const records = await firestore.collection(collection).get();
    const batch = firestore.batch();
    for (const record of records.docs) batch.delete(record.ref);
    if (records.docs.length) await batch.commit();
    await firestore.terminate();
  });

  assert.equal(await a.rateLimit('ip', 2, 60_000), 0);
  assert.equal(await b.rateLimit('ip', 2, 60_000), 0);
  assert.ok(await a.rateLimit('ip', 2, 60_000) > 0);
  await reference('rate', 'ip').update({ expiresAt: new Date(0) });
  assert.equal(await b.rateLimit('ip', 2, 60_000), 0, 'expired records reset before TTL deletion');

  const day = Date.now();
  const results = await Promise.allSettled([
    a.reserveEmails(['a-code', 'a-team'], 2, day),
    b.reserveEmails(['b-code', 'b-team'], 2, day),
  ]);
  assert.equal(results.filter(r => r.status === 'fulfilled' && r.value === 0).length, 1);
  const winner = results[0].status === 'fulfilled' && results[0].value === 0 ? 'a' : 'b';
  const loser = winner === 'a' ? 'b' : 'a';
  assert.equal(await b.reserveEmails([`${winner}-code`, `${winner}-team`], 2, day), 0);
  assert.ok(await a.reserveEmails([`${loser}-code`], 2, day) > 0);

  const record = { codeHash: 'correct', encrypted: 'test-ciphertext', attempts: 0, status: 'pending' };
  await a.put('attempts', record, 600_000);
  for (let i = 0; i < 5; i++) assert.equal((await b.claim('attempts', 'wrong', 'owner')).status, 'invalid');
  assert.equal((await a.claim('attempts', 'correct', 'owner')).status, 'locked');

  await a.put('delivery', record, 600_000);
  assert.equal((await b.claim('delivery', 'correct', 'owner')).status, 'claimed');
  assert.equal((await a.claim('delivery', 'correct', 'other')).status, 'busy');
  assert.equal(await b.finish('delivery', 'other', 'sent'), 0);
  assert.equal(await a.finish('delivery', 'owner', 'sent'), 1);
  assert.equal((await b.claim('delivery', 'correct', 'replay')).status, 'sent');
  assert.equal((await reference('verification', 'delivery').get()).data().encrypted, undefined);

  await a.put('expired', record, 600_000);
  await reference('verification', 'expired').update({ expiresAt: new Date(0) });
  assert.equal((await b.claim('expired', 'correct', 'owner')).status, 'missing');

  await a.put('lease', record, 600_000);
  assert.equal((await a.claim('lease', 'correct', 'dead')).status, 'claimed');
  await reference('verification', 'lease').update({ leaseUntil: 0 });
  assert.equal((await b.claim('lease', 'correct', 'new')).status, 'claimed');
  assert.equal(await a.finish('lease', 'dead', 'sent'), 0);
  await b.finish('lease', 'new', 'pending');
  await reference('verification', 'lease').update({ expiresAt: new Date(Date.now() + 20_000) });
  assert.equal((await a.claim('lease', 'correct', 'too-late')).status, 'expired');
});
