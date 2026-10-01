import { createHash } from 'node:crypto';

const DAY_MS = 86_400_000;
const LEASE_MS = 30_000;
const DELIVERY_RETENTION_MS = 300_000;
const CLEANUP_INTERVAL_MS = 3_600_000;
const CLEANUP_LIMIT = 50;
const TRANSACTION_OPTIONS = { maxAttempts: 3 };

function positiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`invalid ${name}`);
}

function milliseconds(value) {
  const result = value instanceof Date ? value.getTime() : value?.toMillis?.();
  if (!Number.isFinite(result)) throw new Error('invalid contact store timestamp');
  return result;
}

function active(snapshot, timestamp, kind) {
  if (!snapshot.exists) return undefined;
  const data = snapshot.data();
  // TTL deletion is asynchronous. Authorization and quota reset always check
  // expiry here, even when Firestore still contains the expired document.
  if (milliseconds(data.expiresAt) <= timestamp) return undefined;
  if (data.kind !== kind) throw new Error('invalid contact store record');
  return data;
}

function counter(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('invalid contact store counter');
  return value;
}

// Construct the authenticated server client outside this adapter. Cloud Run
// uses ADC from its service identity; neither a browser SDK nor an API key is
// required. Only this dedicated top-level collection is accessed.
export function createFirestoreStore({ firestore, collection = 'solaria_contact', now = Date.now } = {}) {
  if (!firestore || typeof firestore.collection !== 'function' || typeof firestore.runTransaction !== 'function') {
    throw new Error('Firestore server client required');
  }
  if (typeof collection !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,62}$/.test(collection)) {
    throw new Error('invalid contact Firestore collection');
  }
  const documents = firestore.collection(collection);
  const ref = (kind, key) => {
    if (typeof key !== 'string' || !key) throw new Error('invalid contact store key');
    // Namespace-separated hashes avoid slashes, raw identifiers, and Firestore
    // key-length restrictions without exposing email/IP addresses in paths.
    return documents.doc(`${kind}_${createHash('sha256').update(key).digest('hex')}`);
  };
  const transaction = callback => firestore.runTransaction(callback, TRANSACTION_OPTIONS);

  return {
    // Optional maintenance, invoked only by a trusted caller after a valid
    // human check (or a deliberate operator run). No caller-supplied limits.
    // Ordinary document deletes need no paid TTL policy. Physical retention
    // depends on these bounded passes; logical expiry is enforced separately.
    async cleanupExpired() {
      const throttle = ref('cleanup', 'global');
      const cutoff = await transaction(async tx => {
        const snapshot = await tx.get(throttle);
        const timestamp = milliseconds(snapshot.readTime);
        if (active(snapshot, timestamp, 'cleanup')) return null;
        // Consume admission before querying/deleting. Errors and timeouts may
        // leave this hour unused; they must never grant another cleanup batch.
        tx.set(throttle, { kind: 'cleanup', expiresAt: new Date(timestamp + CLEANUP_INTERVAL_MS) });
        return timestamp;
      });
      if (cutoff === null) return { admitted: false, deleted: 0 };
      // This uses the ordinary ascending single-field expiresAt index. Keep it
      // enabled; no composite index or TTL policy is required.
      const candidates = await documents.where('expiresAt', '<=', new Date(cutoff))
        .orderBy('expiresAt').limit(CLEANUP_LIMIT).get();
      if (!candidates.docs.length) return { admitted: true, deleted: 0 };
      const deleted = await transaction(async tx => {
        const current = await tx.getAll(...candidates.docs.map(doc => doc.ref));
        let count = 0;
        // Re-read every candidate transactionally before any delete. An earlier
        // query alone cannot fence a correct-code retention extension, a quota
        // reset, or a replacement verification that raced with the cleanup.
        const expired = current.filter(snapshot => {
          if (!snapshot.exists) return false;
          const data = snapshot.data();
          if (!['rate', 'budget', 'reservation', 'verification'].includes(data.kind)) return false;
          const expiresAt = milliseconds(data.expiresAt);
          return expiresAt <= cutoff && expiresAt <= milliseconds(snapshot.readTime);
        });
        for (const snapshot of expired) { tx.delete(snapshot.ref); count++; }
        return count;
      });
      return { admitted: true, deleted };
    },

    async rateLimit(key, limit, windowMs) {
      positiveInteger(limit, 'rate limit');
      positiveInteger(windowMs, 'rate window');
      const target = ref('rate', key);
      return transaction(async tx => {
        const snapshot = await tx.get(target);
        const timestamp = milliseconds(snapshot.readTime);
        const data = active(snapshot, timestamp, 'rate');
        const count = data ? counter(data.count) : 0;
        const expiresAt = data ? data.expiresAt : new Date(timestamp + windowMs);
        // A blocked attempt has the same external response without another
        // billable write or extending the fixed window.
        if (count >= limit) return milliseconds(expiresAt) - timestamp;
        tx.set(target, { kind: 'rate', count: count + 1, expiresAt });
        return 0;
      });
    },

    async reserveEmails(ids, dailyLimit, timestamp = now()) {
      positiveInteger(dailyLimit, 'email daily limit');
      if (!Array.isArray(ids) || ids.length > 100 || ids.some(id => typeof id !== 'string' || !id)) {
        throw new Error('invalid email reservation keys');
      }
      if (!Number.isSafeInteger(timestamp) || !Number.isFinite(new Date(timestamp).getTime())) {
        throw new Error('invalid email reservation time');
      }
      const date = new Date(timestamp);
      const day = date.toISOString().slice(0, 10);
      const resetAt = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
      const retryMs = resetAt - timestamp;
      const budgetRef = ref('budget', day);
      const reservations = [...new Set(ids)].map(id => ref('reservation', `${day}:${id}`));
      return transaction(async tx => {
        // Firestore disallows reads after writes. Read the entire atomic pair
        // (or retry set) and budget before deciding or making any mutation.
        const [budgetSnapshot, ...snapshots] = await tx.getAll(budgetRef, ...reservations);
        const readTime = milliseconds(budgetSnapshot.readTime);
        const budget = active(budgetSnapshot, readTime, 'budget');
        const used = budget ? counter(budget.used) : 0;
        const missing = reservations.filter((_, i) => !active(snapshots[i], readTime, 'reservation'));
        if (used + missing.length > dailyLimit) return retryMs;
        if (!missing.length) return 0;
        // UTC-dated keys determine the quota window. Keep bookkeeping for an
        // extra day, independently of delayed/billable background TTL cleanup.
        const expiresAt = new Date(resetAt + DAY_MS);
        tx.set(budgetRef, { kind: 'budget', used: used + missing.length, expiresAt });
        for (const reservation of missing) tx.set(reservation, { kind: 'reservation', expiresAt });
        return 0;
      });
    },

    async put(id, record, ttlMs) {
      positiveInteger(ttlMs, 'verification lifetime');
      if (!record || typeof record.codeHash !== 'string' || !record.codeHash ||
          typeof record.encrypted !== 'string' || !record.encrypted ||
          !['pending', 'sending', 'sent'].includes(record.status)) {
        throw new Error('invalid verification record');
      }
      counter(record.attempts);
      // Persist only the store's schema, never accidental plaintext form fields.
      const value = {
        codeHash: record.codeHash, encrypted: record.encrypted,
        attempts: record.attempts, status: record.status,
      };
      if (record.verified !== undefined) {
        if (typeof record.verified !== 'boolean') throw new Error('invalid verification record');
        value.verified = record.verified;
      }
      if (record.owner !== undefined) {
        if (typeof record.owner !== 'string' || !record.owner || !Number.isSafeInteger(record.leaseUntil)) {
          throw new Error('invalid verification lease');
        }
        value.owner = record.owner;
        value.leaseUntil = record.leaseUntil;
      }
      const target = ref('verification', id);
      await transaction(async tx => {
        const snapshot = await tx.get(target);
        const timestamp = milliseconds(snapshot.readTime);
        if (active(snapshot, timestamp, 'verification')) throw new Error('duplicate verification');
        tx.set(target, { kind: 'verification', ...value, expiresAt: new Date(timestamp + ttlMs) });
      });
    },

    async claim(id, codeHash, owner) {
      const target = ref('verification', id);
      return transaction(async tx => {
        const snapshot = await tx.get(target);
        // Server read time is shared across instances and is refreshed whenever
        // Firestore reruns the callback. Never cache a clock/record across retries.
        const timestamp = milliseconds(snapshot.readTime);
        const r = active(snapshot, timestamp, 'verification');
        if (!r) return { status: 'missing' };
        if (counter(r.attempts) >= 5) return { status: 'locked' };
        if (r.codeHash !== codeHash) {
          tx.set(target, { ...r, attempts: r.attempts + 1 });
          return { status: 'invalid' };
        }
        if (r.status === 'sent') return { status: 'sent' };
        if (r.status === 'sending' && r.leaseUntil > timestamp) return { status: 'busy' };
        if (r.verified && milliseconds(r.expiresAt) - timestamp <= LEASE_MS) return { status: 'expired' };
        r.status = 'sending';
        r.owner = owner;
        r.leaseUntil = timestamp + LEASE_MS;
        if (!r.verified) {
          r.verified = true;
          r.expiresAt = new Date(Math.max(milliseconds(r.expiresAt), timestamp + DELIVERY_RETENTION_MS));
        }
        tx.set(target, r);
        return { status: 'claimed', encrypted: r.encrypted };
      });
    },

    async finish(id, owner, status) {
      if (!['pending', 'sent'].includes(status)) throw new Error('invalid verification completion');
      const target = ref('verification', id);
      return transaction(async tx => {
        const snapshot = await tx.get(target);
        const r = active(snapshot, milliseconds(snapshot.readTime), 'verification');
        if (!r || r.owner !== owner || r.status !== 'sending') return 0;
        r.status = status;
        delete r.owner;
        delete r.leaseUntil;
        if (status === 'sent') delete r.encrypted;
        tx.set(target, r);
        return 1;
      });
    },
  };
}
