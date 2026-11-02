// Firestore for envelopes and Cloud Storage for files. Both authenticate as the
// Cloud Run service identity, so there are no keys to manage.
//
// An envelope is one document holding its recipients, fields and audit chain, saved
// with a lastUpdateTime precondition. That makes every state change atomic and keeps
// the hash chain linear, since a losing writer retries on the fresh copy. It is kept
// as a JSON string so what is stored is byte-for-byte what the chain hashed.
//
// Files are written with ifGenerationMatch:0, so nothing can overwrite a stored
// original or sealed document, including this server.
import { Firestore } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';
import { ConflictError } from './store-local.js';

const ENVELOPES = 'sign_envelopes';
const recordCollection = (kind) => `sign_${kind}`;

// gRPC status codes: NOT_FOUND, ALREADY_EXISTS, FAILED_PRECONDITION, ABORTED.
const CONFLICT_CODES = new Set([6, 9, 10]);

export function createGcpStore({ bucket }) {
  const firestore = new Firestore({ preferRest: true, ignoreUndefinedProperties: true });
  const files = new Storage().bucket(bucket);
  const envelopes = firestore.collection(ENVELOPES);
  const fields = (env) => ({ json: JSON.stringify(env), status: env.status, createdAt: env.createdAt });

  return {
    async getEnvelope(id) {
      const snap = await envelopes.doc(id).get();
      return snap.exists ? { data: JSON.parse(snap.get('json')), rev: snap.updateTime } : null;
    },
    async createEnvelope(env) {
      try {
        return (await envelopes.doc(env.id).create(fields(env))).writeTime;
      } catch (e) {
        if (CONFLICT_CODES.has(e.code)) throw new ConflictError('envelope exists');
        throw e;
      }
    },
    async saveEnvelope(env, rev) {
      try {
        const result = await envelopes.doc(env.id).update(fields(env), { lastUpdateTime: rev });
        return result.writeTime;
      } catch (e) {
        if (CONFLICT_CODES.has(e.code)) throw new ConflictError('stale revision');
        throw e;
      }
    },
    async deleteEnvelope(id) {
      await envelopes.doc(id).delete();
    },
    async listEnvelopes(limit) {
      const snap = await envelopes.orderBy('createdAt', 'desc').limit(limit).get();
      return snap.docs.map((d) => JSON.parse(d.get('json')));
    },

    async getRecord(kind, id) {
      const snap = await firestore.collection(recordCollection(kind)).doc(id).get();
      return snap.exists ? snap.data() : null;
    },
    async putRecord(kind, id, data) {
      await firestore.collection(recordCollection(kind)).doc(id).set(data);
    },
    async deleteRecord(kind, id) {
      await firestore.collection(recordCollection(kind)).doc(id).delete();
    },
    async listRecords(kind) {
      const snap = await firestore.collection(recordCollection(kind)).get();
      return snap.docs.map((d) => d.data());
    },
    // Single use: the delete fails for whichever concurrent caller read second.
    async takeRecord(kind, id) {
      const ref = firestore.collection(recordCollection(kind)).doc(id);
      const snap = await ref.get();
      if (!snap.exists) return null;
      try {
        await ref.delete({ lastUpdateTime: snap.updateTime });
      } catch (e) {
        if (CONFLICT_CODES.has(e.code) || e.code === 5) return null;
        throw e;
      }
      return snap.data();
    },

    async putBlob(key, bytes, contentType) {
      try {
        await files.file(key).save(bytes, {
          contentType,
          resumable: false,
          preconditionOpts: { ifGenerationMatch: 0 },
        });
      } catch (e) {
        if (e.code === 412) throw new ConflictError('blob exists');
        throw e;
      }
    },
    async getBlob(key) {
      try {
        const [bytes] = await files.file(key).download();
        return bytes;
      } catch (e) {
        if (e.code === 404) return null;
        throw e;
      }
    },
    async deleteBlobs(prefix) {
      await files.deleteFiles({ prefix });
    },
    async copyBlob(from, to) {
      await files.file(from).copy(files.file(to));
    },
  };
}
