import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createFirestoreStore } from '../server/contact-firestore-store.js';

const DAY = 86_400_000;
const START = Date.UTC(2026, 9, 1, 12);
const record = { codeHash: 'correct-hash', encrypted: 'authenticated-ciphertext', attempts: 0, status: 'pending' };
const documentId = (kind, key) => `${kind}_${createHash('sha256').update(key).digest('hex')}`;
const millis = value => value instanceof Date ? value.getTime() : value.toMillis();
const DELETE = Symbol('delete');

class Timestamp {
  constructor(time) { this.time = time; }
  toMillis() { return this.time; }
}

function copy(value, timestamps = false) {
  if (value instanceof Date) return timestamps ? new Timestamp(value.getTime()) : new Date(value.getTime());
  if (value instanceof Timestamp) return new Timestamp(value.toMillis());
  if (Array.isArray(value)) return value.map(item => copy(item, timestamps));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, copy(v, timestamps)]));
  return value;
}

// An optimistic MVCC fake, not a Map pretending every operation is atomic.
// Concurrent transactions take independent snapshots; a changed read document
// retries the whole callback, including read-only outcomes, up to maxAttempts.
// Writes are staged and applied together. Reads after any write are rejected.
// Expired documents deliberately remain present: this fake never runs TTL GC.
class TransactionalFirestore {
  constructor(time = START) {
    this.time = time;
    this.documents = new Map();
    this.versions = new Map();
    this.callbacks = 0;
    this.conflicts = 0;
    this.writes = 0;
    this.beforeCommit = null;
    this.afterQuery = null;
    this.queryCount = 0;
    this.available = true;
  }

  collection(name) {
    assert.match(name, /^[A-Za-z][A-Za-z0-9_-]{0,62}$/);
    const collection = { doc: id => {
      assert.equal(id.includes('/'), false, 'one document ID must not create subcollections');
      return { path: `${name}/${id}` };
    }, where: (field, operator, boundary) => {
      assert.equal(field, 'expiresAt');
      assert.equal(operator, '<=');
      assert.ok(boundary instanceof Date);
      return { orderBy: ordering => {
        assert.equal(ordering, 'expiresAt');
        return { limit: limit => {
          assert.equal(limit, 50, 'cleanup query has a fixed production cap');
          return { get: async () => {
            this.queryCount++;
            if (!this.available) throw new Error('Firestore unavailable');
            const docs = [...this.documents].filter(([path, value]) => path.startsWith(`${name}/`) && millis(value.expiresAt) <= millis(boundary))
              .sort((a, b) => millis(a[1].expiresAt) - millis(b[1].expiresAt)).slice(0, limit)
              .map(([path, value]) => ({ exists: true, ref: { path }, readTime: new Timestamp(this.time), data: () => copy(value, true) }));
            if (this.afterQuery) await this.afterQuery(docs);
            return { docs };
          } };
        } };
      } };
    } };
    return collection;
  }

  client() {
    return { collection: name => this.collection(name), runTransaction: (...args) => this.runTransaction(...args) };
  }

  async runTransaction(callback, options) {
    assert.deepEqual(options, { maxAttempts: 3 }, 'production retries must be bounded');
    if (!this.available) throw new Error('Firestore unavailable');
    for (let attempt = 0; attempt < options.maxAttempts; attempt++) {
      this.callbacks++;
      const view = new Map([...this.documents].map(([path, value]) => [path, copy(value)]));
      const versions = new Map(this.versions);
      const readTime = this.time;
      const reads = new Set();
      const writes = new Map();
      const snapshot = ref => {
        assert.equal(writes.size, 0, 'all reads must precede all writes');
        reads.add(ref.path);
        return {
          exists: view.has(ref.path), ref, readTime: new Timestamp(readTime),
          data: () => copy(view.get(ref.path), true),
        };
      };
      const tx = {
        get: async ref => snapshot(ref),
        getAll: async (...refs) => refs.map(snapshot),
        set: (ref, value) => { writes.set(ref.path, copy(value)); return tx; },
        delete: ref => { writes.set(ref.path, DELETE); return tx; },
      };
      const result = await callback(tx);
      if (this.beforeCommit) await this.beforeCommit({ attempt, reads, writes });
      if (!this.available) throw new Error('Firestore unavailable');
      if ([...reads].some(path => this.versions.get(path) !== versions.get(path))) {
        this.conflicts++;
        continue;
      }
      for (const [path, value] of writes) {
        if (value === DELETE) this.documents.delete(path);
        else this.documents.set(path, value);
        this.versions.set(path, (this.versions.get(path) || 0) + 1);
        this.writes++;
      }
      return result;
    }
    throw new Error('Firestore transaction contention');
  }

  path(kind, key, collection = 'solaria_contact') { return `${collection}/${documentId(kind, key)}`; }
  value(kind, key, collection) { return this.documents.get(this.path(kind, key, collection)); }
  mutate(kind, key, update) {
    const path = this.path(kind, key);
    this.documents.set(path, { ...this.documents.get(path), ...update });
    this.versions.set(path, (this.versions.get(path) || 0) + 1);
  }
}

function fixture() {
  const db = new TransactionalFirestore();
  // Independent clients/store objects share only the remote transactional DB.
  const make = options => createFirestoreStore({ firestore: db.client(), now: () => db.time, ...options });
  return { db, a: make(), b: make(), make };
}

test('Firestore adapter validates the client and uses isolated hashed document IDs', async () => {
  assert.throws(() => createFirestoreStore(), /client required/);
  const { db, a, make } = fixture();
  for (const collection of ['', 'parent/child', '..', '__hidden__', 'a'.repeat(64)]) {
    assert.throws(() => make({ collection }), /invalid contact Firestore collection/);
  }
  const id = 'visitor@example.com/request/with/slashes';
  await a.put(id, { ...record, email: 'visitor@example.com', message: 'must not persist' }, 600_000);
  await a.rateLimit(id, 2, 60_000);
  await a.reserveEmails([id], 2);
  assert.equal(db.documents.size, 4, 'verification, rate, budget and reservation have distinct namespaces');
  for (const [path, value] of db.documents) {
    assert.match(path, /^solaria_contact\/(verification|rate|budget|reservation)_[a-f0-9]{64}$/);
    assert.equal(JSON.stringify(value).includes('visitor@example.com'), false);
    assert.equal(JSON.stringify(value).includes('must not persist'), false);
    assert.ok(Number.isFinite(millis(value.expiresAt)), 'every document has a TTL-compatible timestamp');
  }
  assert.deepEqual(await make({ collection: 'solaria_staging' }).claim(id, record.codeHash, 'owner'), { status: 'missing' });
  const saved = db.value('verification', id);
  assert.equal(saved.encrypted, record.encrypted);
  assert.equal(saved.codeHash, record.codeHash);
});

test('shared rate limits are atomic, fixed-window, and avoid writes for denied requests', async () => {
  const { db, a, b } = fixture();
  assert.deepEqual(await Promise.all([a.rateLimit('shared', 3, 60_000), b.rateLimit('shared', 3, 60_000)]), [0, 0]);
  db.time += 1_000;
  const results = await Promise.all([a.rateLimit('shared', 3, 60_000), b.rateLimit('shared', 3, 60_000)]);
  assert.deepEqual(results.sort((x, y) => x - y), [0, 59_000]);
  assert.ok(db.conflicts > 0, 'the fake actually reran conflicting callbacks');
  assert.equal(db.value('rate', 'shared').count, 3);
  const writes = db.writes;
  const blocked = await Promise.all(Array.from({ length: 20 }, (_, i) => (i % 2 ? a : b).rateLimit('shared', 3, 60_000)));
  assert.ok(blocked.every(wait => wait === 59_000));
  assert.equal(db.writes, writes, 'denied attempts do not create extra billed writes');
  assert.equal(millis(db.value('rate', 'shared').expiresAt), START + 60_000);
  db.time = START + 60_000;
  assert.equal(await b.rateLimit('shared', 3, 60_000), 0, 'expired-but-not-deleted bucket resets at its exact boundary');
  assert.equal(db.value('rate', 'shared').count, 1);
  assert.equal(millis(db.value('rate', 'shared').expiresAt), START + 120_000);
});

test('verification put is create-only across instances and may replace only an expired record', async () => {
  const { db, a, b } = fixture();
  const outcomes = await Promise.allSettled([a.put('id', record, 1000), b.put('id', record, 1000)]);
  assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
  assert.match(outcomes.find(result => result.status === 'rejected').reason.message, /duplicate/);
  assert.equal(db.documents.size, 1);
  db.time += 1000;
  assert.deepEqual(await b.claim('id', record.codeHash, 'owner'), { status: 'missing' });
  assert.equal(await a.finish('id', 'owner', 'sent'), 0);
  assert.equal(db.documents.size, 1, 'logical expiry does not rely on asynchronous deletion');
  await b.put('id', { ...record, encrypted: 'new-ciphertext' }, 1000);
  assert.equal(db.value('verification', 'id').encrypted, 'new-ciphertext');
});

test('five wrong-code attempts are shared, atomic, and never extend retention', async () => {
  const { db, a, b } = fixture();
  await a.put('attempts', record, 600_000);
  const results = [];
  for (let i = 0; i < 4; i++) {
    results.push(...await Promise.all([a.claim('attempts', 'wrong', `a-${i}`), b.claim('attempts', 'wrong', `b-${i}`)]));
  }
  assert.equal(results.filter(result => result.status === 'invalid').length, 5);
  assert.equal(results.filter(result => result.status === 'locked').length, 3);
  assert.deepEqual(await a.claim('attempts', record.codeHash, 'correct'), { status: 'locked' });
  const stored = db.value('verification', 'attempts');
  assert.equal(stored.attempts, 5);
  assert.equal(stored.verified, undefined);
  assert.equal(millis(stored.expiresAt), START + 600_000);
});

test('only one instance owns a claim, completion is fenced, and successful payloads are removed', async () => {
  const { db, a, b } = fixture();
  await a.put('id', record, 600_000);
  const results = await Promise.all([a.claim('id', record.codeHash, 'first'), b.claim('id', record.codeHash, 'second')]);
  assert.deepEqual(results.map(result => result.status).sort(), ['busy', 'claimed']);
  assert.equal(results.find(result => result.status === 'claimed').encrypted, record.encrypted);
  const owner = results[0].status === 'claimed' ? 'first' : 'second';
  assert.equal(db.value('verification', 'id').leaseUntil, START + 30_000);
  assert.equal(await a.finish('id', 'wrong-owner', 'sent'), 0);
  assert.equal(await b.finish('id', owner, 'sent'), 1);
  assert.equal(await b.finish('id', owner, 'sent'), 0);
  assert.deepEqual(await a.claim('id', record.codeHash, 'replay'), { status: 'sent' });
  const stored = db.value('verification', 'id');
  assert.equal(stored.encrypted, undefined);
  assert.equal(stored.owner, undefined);
  assert.equal(stored.leaseUntil, undefined);
  assert.equal(millis(stored.expiresAt), START + 600_000, 'first claim never shortens longer original retention');
});

test('30-second leases recover a crashed owner without allowing stale completion', async () => {
  const { db, a, b } = fixture();
  await a.put('id', record, 600_000);
  assert.equal((await a.claim('id', record.codeHash, 'crashed')).status, 'claimed');
  db.time += 29_999;
  assert.equal((await b.claim('id', record.codeHash, 'replacement')).status, 'busy');
  db.time += 1;
  assert.equal((await b.claim('id', record.codeHash, 'replacement')).status, 'claimed');
  assert.equal(await a.finish('id', 'crashed', 'sent'), 0);
  assert.equal(await b.finish('id', 'replacement', 'pending'), 1);
  assert.equal(db.value('verification', 'id').encrypted, record.encrypted, 'failed delivery retains the exact encrypted request');
  assert.equal((await a.claim('id', record.codeHash, 'retry')).status, 'claimed');
});

test('a matching owner cannot finish a logically expired document left by delayed TTL cleanup', async () => {
  const { db, a, b } = fixture();
  await a.put('id', record, 600_000);
  await a.claim('id', record.codeHash, 'owner');
  db.time = START + 600_000;
  const writes = db.writes;
  assert.equal(await b.finish('id', 'owner', 'sent'), 0);
  assert.equal(db.writes, writes);
  assert.equal(db.value('verification', 'id').status, 'sending');
  assert.equal(db.value('verification', 'id').encrypted, record.encrypted);
});

test('the first correct code extends retention once, with an exact near-expiry retry cutoff', async () => {
  const { db, a, b } = fixture();
  await a.put('edge', record, 600_000);
  db.time = START + 599_999;
  assert.equal((await a.claim('edge', record.codeHash, 'first')).status, 'claimed');
  const expiry = START + 899_999;
  assert.equal(millis(db.value('verification', 'edge').expiresAt), expiry);
  assert.equal(await a.finish('edge', 'first', 'pending'), 1);
  db.time = expiry - 30_001;
  assert.equal((await b.claim('edge', record.codeHash, 'retry')).status, 'claimed');
  assert.equal(await b.finish('edge', 'retry', 'pending'), 1);
  assert.equal(millis(db.value('verification', 'edge').expiresAt), expiry, 'retries cannot keep a verified record alive forever');
  db.time = expiry - 30_000;
  assert.equal((await a.claim('edge', record.codeHash, 'too-late')).status, 'expired');
  db.time = expiry;
  assert.equal((await b.claim('edge', record.codeHash, 'expired')).status, 'missing');
  assert.equal(db.value('verification', 'edge').encrypted, record.encrypted, 'expired document may still physically exist until TTL cleanup');
});

test('transaction retries refresh server time, not the instance clock or an old callback result', async () => {
  const { db, a, make } = fixture();
  const skewed = make({ now: () => START + 50 * DAY });
  await skewed.put('id', record, 1000);
  assert.equal(millis(db.value('verification', 'id').expiresAt), START + 1000);
  let retried = false;
  db.beforeCommit = ({ reads }) => {
    if (!retried && reads.has(db.path('verification', 'id'))) {
      retried = true;
      db.time += 1000;
      db.mutate('verification', 'id', { attempts: 1 });
    }
  };
  assert.deepEqual(await a.claim('id', record.codeHash, 'owner'), { status: 'missing' });
  assert.equal(db.value('verification', 'id').verified, undefined, 'an aborted correct-code attempt cannot extend TTL');
  assert.ok(db.conflicts > 0);
});

test('email pairs are reserved atomically across instances and rejected pairs consume no capacity', async () => {
  const { db, a, b } = fixture();
  const results = await Promise.all([
    a.reserveEmails(['a/code', 'a/team'], 3),
    b.reserveEmails(['b/code', 'b/team'], 3),
  ]);
  assert.deepEqual(results.sort((x, y) => x - y), [0, 43_200_000]);
  assert.equal(db.value('budget', '2026-10-01').used, 2);
  assert.equal([...db.documents.values()].filter(value => value.kind === 'reservation').length, 2);
  assert.equal(await b.reserveEmails(['remaining-single'], 3), 0, 'the denied pair did not partially consume the remaining slot');
  assert.equal(db.value('budget', '2026-10-01').used, 3);
});

test('reservation retries and duplicate keys are idempotent, including transaction reruns', async () => {
  const { db, a, b } = fixture();
  const pair = ['one/code', 'one/team'];
  assert.deepEqual(await Promise.all([a.reserveEmails([...pair, ...pair], 2), b.reserveEmails(pair, 2)]), [0, 0]);
  assert.equal(db.value('budget', '2026-10-01').used, 2);
  assert.equal(db.documents.size, 3);
  const writes = db.writes;
  assert.equal(await a.reserveEmails(['one/code'], 2), 0);
  assert.equal(await b.reserveEmails(['one/team'], 2), 0);
  assert.equal(await b.reserveEmails(['new'], 2), 43_200_000);
  assert.equal(db.writes, writes, 'idempotent and rejected reservations do not write');
  assert.ok(db.conflicts > 0);
});

test('partially overlapping reservations count only missing logical emails', async () => {
  const { db, a, b } = fixture();
  await a.reserveEmails(['shared'], 3);
  const results = await Promise.all([a.reserveEmails(['shared', 'a'], 3), b.reserveEmails(['shared', 'b'], 3)]);
  assert.deepEqual(results, [0, 0]);
  assert.equal(db.value('budget', '2026-10-01').used, 3);
});

test('UTC-dated budgets reset independently of TTL cleanup and carried-over deliveries count today', async () => {
  const { db, a, b } = fixture();
  db.time = Date.UTC(2026, 9, 1, 23, 59, 59, 999);
  await a.reserveEmails(['one/code', 'one/team'], 2);
  assert.equal(await a.reserveEmails(['new'], 2), 1);
  assert.equal(millis(db.value('budget', '2026-10-01').expiresAt), Date.UTC(2026, 9, 3));
  db.time += 1;
  assert.equal(await b.reserveEmails(['one/team'], 2), 0, 'a yesterday-reserved delivery also consumes today capacity');
  assert.equal(await a.reserveEmails(['two/code', 'two/team'], 2), DAY);
  assert.equal(db.value('budget', '2026-10-01').used, 2, 'old day physically remains');
  assert.equal(db.value('budget', '2026-10-02').used, 1);
  assert.equal(await a.reserveEmails(['single'], 2), 0);
});

test('expired reservation/budget documents are ignored even if TTL deletion has not run', async () => {
  const { db, a } = fixture();
  await a.reserveEmails(['old'], 1);
  db.mutate('budget', '2026-10-01', { expiresAt: new Date(START) });
  db.mutate('reservation', '2026-10-01:old', { expiresAt: new Date(START) });
  assert.equal(await a.reserveEmails(['old'], 1), 0);
  assert.equal(db.value('budget', '2026-10-01').used, 1);
  assert.ok(millis(db.value('reservation', '2026-10-01:old').expiresAt) > START);
});

test('contention exhaustion and service failures reject without partial state or allowance', async () => {
  const { db, a } = fixture();
  db.beforeCommit = ({ reads }) => {
    for (const path of reads) db.versions.set(path, (db.versions.get(path) || 0) + 1);
  };
  await assert.rejects(a.reserveEmails(['code', 'team'], 2), /contention/);
  assert.equal(db.callbacks, 3);
  assert.equal(db.documents.size, 0);
  assert.equal(db.writes, 0);
  db.beforeCommit = () => { db.available = false; };
  await assert.rejects(a.reserveEmails(['code', 'team'], 2), /unavailable/);
  assert.equal(db.documents.size, 0, 'failed commit does not leave half a reserved pair');
  await assert.rejects(a.rateLimit('ip', 1, 60000), /unavailable/);
  await assert.rejects(a.put('id', record, 600000), /unavailable/);
  await assert.rejects(a.claim('id', record.codeHash, 'owner'), /unavailable/);
  await assert.rejects(a.finish('id', 'owner', 'sent'), /unavailable/);
});

test('malformed state and invalid inputs fail closed instead of resetting active quotas', async () => {
  const { db, a } = fixture();
  await a.rateLimit('ip', 1, 60000);
  db.mutate('rate', 'ip', { expiresAt: null });
  await assert.rejects(a.rateLimit('ip', 1, 60000), /timestamp/);
  db.mutate('rate', 'ip', { expiresAt: new Date(START + 60000), count: 'zero' });
  await assert.rejects(a.rateLimit('ip', 1, 60000), /counter/);
  await assert.rejects(a.rateLimit('ip', 0, 60000), /invalid/);
  await assert.rejects(a.put('id', record, 0), /invalid/);
  await assert.rejects(a.reserveEmails(['id'], 0), /invalid/);
  await assert.rejects(a.reserveEmails(['id'], 2, NaN), /invalid/);
  await assert.rejects(a.reserveEmails([''], 2), /invalid/);
  await assert.rejects(a.finish('id', 'owner', 'arbitrary'), /invalid/);
});

test('cleanup deletes at most 50 expired documents and shares a one-hour cooldown across instances', async () => {
  const { db, a, b } = fixture();
  for (let i = 0; i < 55; i++) await a.put(`expired-${i}`, record, 1000);
  await a.put('fresh', record, 7_200_000);
  db.time += 1000;
  // Extra arguments cannot increase the production cap or bypass admission.
  const results = await Promise.all([a.cleanupExpired({ limit: 10000 }), b.cleanupExpired()]);
  assert.equal(results.filter(result => result.admitted).length, 1);
  assert.equal(results.reduce((sum, result) => sum + result.deleted, 0), 50);
  assert.equal(db.queryCount, 1);
  assert.equal([...db.documents.values()].filter(value => value.kind === 'verification').length, 6);
  assert.equal(db.value('verification', 'fresh').encrypted, record.encrypted, 'unexpired ciphertext is not deleted');
  const marker = db.value('cleanup', 'global');
  assert.equal(millis(marker.expiresAt), START + 1000 + 3_600_000);
  db.time += 3_599_999;
  assert.deepEqual(await b.cleanupExpired(), { admitted: false, deleted: 0 });
  assert.equal(db.queryCount, 1);
  db.time++;
  assert.deepEqual(await b.cleanupExpired(), { admitted: true, deleted: 5 });
  assert.equal(db.queryCount, 2);
  assert.equal(db.documents.size, 2, 'only the live verification and shared throttle remain');
});

test('cleanup uses server time and throttles even an empty pass', async () => {
  const { db, a, make } = fixture();
  const skewed = make({ now: () => START + 50 * DAY });
  await a.put('fresh', record, 1000);
  assert.deepEqual(await skewed.cleanupExpired(), { admitted: true, deleted: 0 });
  assert.equal(millis(db.value('cleanup', 'global').expiresAt), START + 3_600_000);
  assert.ok(db.value('verification', 'fresh'));
  assert.deepEqual(await a.cleanupExpired(), { admitted: false, deleted: 0 });
  assert.equal(db.queryCount, 1, 'a second instance cannot run another empty query');
});

test('cleanup rereads query candidates so a replaced or extended record remains intact', async () => {
  const { db, a, b } = fixture();
  await a.put('replace', record, 1000);
  await a.put('extend', record, 1000);
  await a.put('expired', record, 1000);
  db.time += 1000;
  db.afterQuery = async () => {
    await b.put('replace', { ...record, encrypted: 'replacement-ciphertext' }, 600_000);
    // Simulate a concurrent retention-extension commit after the candidate
    // query's snapshot, before the deletion transaction re-reads the document.
    db.mutate('verification', 'extend', { verified: true, expiresAt: new Date(db.time + 300_000) });
  };
  assert.deepEqual(await a.cleanupExpired(), { admitted: true, deleted: 1 });
  assert.equal(db.value('verification', 'replace').encrypted, 'replacement-ciphertext');
  assert.equal(db.value('verification', 'extend').verified, true);
  assert.equal(db.value('verification', 'expired'), undefined);
});

test('cleanup transaction conflict retries preserve a concurrent expiry extension', async () => {
  const { db, a } = fixture();
  await a.put('extend', record, 1000);
  await a.put('expired', record, 1000);
  db.time += 1000;
  let extended = false;
  db.beforeCommit = ({ writes }) => {
    if (!extended && writes.get(db.path('verification', 'extend')) === DELETE) {
      extended = true;
      db.mutate('verification', 'extend', { verified: true, expiresAt: new Date(db.time + 300_000) });
    }
  };
  assert.deepEqual(await a.cleanupExpired(), { admitted: true, deleted: 1 });
  assert.ok(db.conflicts > 0, 'a staged delete was discarded and its callback rerun');
  assert.equal(db.value('verification', 'extend').verified, true);
  assert.equal(db.value('verification', 'expired'), undefined);
});

test('cleanup failures conservatively consume admission and never partially delete a batch', async () => {
  for (const failure of ['query', 'commit', 'contention']) {
    const { db, a, b } = fixture();
    await a.put('first', record, 1000);
    await a.put('second', record, 1000);
    db.time += 1000;
    if (failure === 'query') db.afterQuery = () => { throw new Error('query failed'); };
    else db.beforeCommit = ({ reads, writes }) => {
      if (![...writes.values()].includes(DELETE)) return;
      if (failure === 'commit') throw new Error('commit failed');
      for (const path of reads) db.versions.set(path, (db.versions.get(path) || 0) + 1);
    };
    await assert.rejects(a.cleanupExpired(), /failed|contention/);
    assert.ok(db.value('verification', 'first'));
    assert.ok(db.value('verification', 'second'));
    db.afterQuery = null;
    db.beforeCommit = null;
    assert.deepEqual(await b.cleanupExpired(), { admitted: false, deleted: 0 });
    assert.equal(db.queryCount, 1, `${failure} does not grant another batch in the same hour`);
    db.time += 3_600_000;
    assert.deepEqual(await b.cleanupExpired(), { admitted: true, deleted: 2 });
  }
});

// Optional real SDK/emulator contract test. It can never target a live project:
// FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 node --test tests/contact-firestore.test.js
// Start a local Firestore emulator separately; this test creates only a unique
// disposable collection in the demo project and removes it before terminating.
test('real local Firestore emulator exercises the server SDK transaction contract', {
  skip: !process.env.FIRESTORE_EMULATOR_HOST,
  timeout: 30_000,
}, async t => {
  assert.match(process.env.FIRESTORE_EMULATOR_HOST, /^(?:localhost|127\.0\.0\.1|\[::1\]):[1-9]\d{0,4}$/, 'integration test is restricted to a local emulator');
  const { Firestore } = await import('@google-cloud/firestore');
  const collection = `solaria_test_${randomUUID().replaceAll('-', '')}`;
  const first = new Firestore({ projectId: 'demo-solaria-contact-protection' });
  const second = new Firestore({ projectId: 'demo-solaria-contact-protection' });
  t.after(async () => {
    const snapshot = await first.collection(collection).get();
    await Promise.all(snapshot.docs.map(doc => doc.ref.delete()));
    await Promise.all([first.terminate(), second.terminate()]);
  });
  const a = createFirestoreStore({ firestore: first, collection });
  const b = createFirestoreStore({ firestore: second, collection });
  const quotas = await Promise.all([a.rateLimit('ip', 1, 60000), b.rateLimit('ip', 1, 60000)]);
  assert.equal(quotas.filter(wait => wait === 0).length, 1);
  assert.equal(quotas.filter(wait => wait > 0).length, 1);
  const budget = await Promise.all([a.reserveEmails(['a', 'b'], 2), b.reserveEmails(['c', 'd'], 2)]);
  assert.equal(budget.filter(wait => wait === 0).length, 1);
  assert.equal(budget.filter(wait => wait > 0).length, 1);
  await a.put('id', record, 600000);
  const claims = await Promise.all([a.claim('id', record.codeHash, 'a'), b.claim('id', record.codeHash, 'b')]);
  assert.deepEqual(claims.map(result => result.status).sort(), ['busy', 'claimed']);
  const owner = claims[0].status === 'claimed' ? 'a' : 'b';
  assert.equal(await b.finish('id', owner, 'sent'), 1);
  const target = first.collection(collection).doc(documentId('verification', 'id'));
  assert.equal((await target.get()).data().encrypted, undefined);
  await target.update({ expiresAt: new Date(0) });
  assert.deepEqual(await b.claim('id', record.codeHash, 'expired'), { status: 'missing' });
  assert.deepEqual(await a.cleanupExpired(), { admitted: true, deleted: 1 });
  assert.equal((await target.get()).exists, false);
  assert.deepEqual(await b.cleanupExpired(), { admitted: false, deleted: 0 });
});
