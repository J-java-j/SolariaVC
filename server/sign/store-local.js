// File-backed store for `npm run server` and tests. It has the same contract as
// store-gcp.js, including write-once blobs and optimistic concurrency, so anything
// that works here behaves the same way against Firestore and Cloud Storage.
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

export class ConflictError extends Error {}

export function createLocalStore(root) {
  const file = (...parts) => path.join(root, ...parts);
  const envelopePath = (id) => file('envelopes', `${id}.json`);
  const recordPath = (kind, id) => file('records', kind, `${id}.json`);

  function write(target, data) {
    mkdirSync(path.dirname(target), { recursive: true });
    const temp = `${target}.${randomBytes(4).toString('hex')}.tmp`;
    writeFileSync(temp, data);
    renameSync(temp, target);
  }
  const readJson = (target) => (existsSync(target) ? JSON.parse(readFileSync(target, 'utf8')) : null);

  return {
    async getEnvelope(id) {
      const stored = readJson(envelopePath(id));
      return stored ? { data: stored.data, rev: stored.rev } : null;
    },
    async createEnvelope(env) {
      if (existsSync(envelopePath(env.id))) throw new ConflictError('envelope exists');
      write(envelopePath(env.id), JSON.stringify({ rev: 1, data: env }));
      return 1;
    },
    // Synchronous from read to write, which is atomic within this one process.
    async saveEnvelope(env, rev) {
      const stored = readJson(envelopePath(env.id));
      if (!stored || stored.rev !== rev) throw new ConflictError('stale revision');
      write(envelopePath(env.id), JSON.stringify({ rev: rev + 1, data: env }));
      return rev + 1;
    },
    async deleteEnvelope(id) {
      rmSync(envelopePath(id), { force: true });
    },
    async listEnvelopes(limit) {
      const dir = file('envelopes');
      if (!existsSync(dir)) return [];
      return readdirSync(dir)
        .filter((name) => name.endsWith('.json'))
        .map((name) => readJson(path.join(dir, name)).data)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit);
    },

    async getRecord(kind, id) {
      return readJson(recordPath(kind, id));
    },
    async putRecord(kind, id, data) {
      write(recordPath(kind, id), JSON.stringify(data));
    },
    async deleteRecord(kind, id) {
      rmSync(recordPath(kind, id), { force: true });
    },
    // Single use: of any concurrent callers exactly one gets the record.
    async takeRecord(kind, id) {
      const data = readJson(recordPath(kind, id));
      if (data) rmSync(recordPath(kind, id));
      return data;
    },

    async putBlob(key, bytes) {
      const target = file('blobs', key);
      if (existsSync(target)) throw new ConflictError('blob exists');
      write(target, bytes);
    },
    async getBlob(key) {
      const target = file('blobs', key);
      return existsSync(target) ? readFileSync(target) : null;
    },
    async deleteBlobs(prefix) {
      rmSync(file('blobs', prefix), { recursive: true, force: true });
    },
    async copyBlob(from, to) {
      const bytes = readFileSync(file('blobs', from));
      write(file('blobs', to), bytes);
    },
  };
}
