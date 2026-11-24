import { createHash, randomBytes } from 'node:crypto';
import { getFirestore } from 'firebase-admin/firestore';
import { postTicket } from './terminal-handoff.js';
import { destination } from './session.js';
import { roles } from './provider.js';

const secret = () => randomBytes(32).toString('base64url');
const key = value => createHash('sha256').update(value).digest('hex');
const valid = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
const active = record => record && record.expires.toMillis() > Date.now();
const denied = (status = 401) => Object.assign(new Error(status === 403 ? 'Access denied.' : 'Team login required.'), { status });
// The portal page asks /me on nearly every click. Remember a passed sign-in check for up to
// 10 s, never past the session's own end, keyed by the cookie's hash. Refusals are never kept;
// signing out and every fresh check (all changes ask for one) replace what was remembered.
const KEEP_MS = 10_000;
const KEEP_MAX = 1000;

export function httpsOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.origin !== value) throw new Error('Expected an exact HTTPS origin.');
  return url.origin;
}

export function sessionDatabase(app) {
  const name = process.env.TEAM_SESSION_DATABASE;
  if (!name || name === '(default)' || process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Configure a dedicated session database.');
  return getFirestore(app, name);
}

export function hostedTerminal(auth, db, origin) {
  const parents = db.collection('teamBrowserSessions');
  const tickets = db.collection('terminalTickets');
  const handles = db.collection('terminalSessions');
  const recent = new Map();
  async function user(parent) {
    if (!active(parent)) throw denied();
    const account = await auth.getUser(parent.uid);
    if (account.disabled || !roles.includes(account.customClaims?.role)) throw denied(403);
    if (Date.parse(account.tokensValidAfterTime) > parent.authTime * 1000) throw denied();
    return account;
  }
  return {
    async start(claims) {
      const cookie = secret();
      await parents.doc(key(cookie)).create({ uid: claims.uid, authTime: claims.auth_time, expires: new Date(Date.now() + 8 * 3600_000) });
      return cookie;
    },
    async user(cookie, fresh = false) {
      if (!valid(cookie)) throw denied();
      const id = key(cookie);
      const kept = recent.get(id);
      if (!fresh && kept && kept.until > Date.now()) return kept.account;
      recent.delete(id);
      const parent = (await parents.doc(id).get()).data();
      const account = await user(parent);
      if (recent.size >= KEEP_MAX) recent.clear();
      recent.set(id, { account, until: Math.min(Date.now() + KEEP_MS, parent.expires.toMillis()) });
      return account;
    },
    async forget(cookie) {
      if (!valid(cookie)) return;
      recent.delete(key(cookie));
      await parents.doc(key(cookie)).delete();
    },
    async launch(res, id, cookie, authorize) {
      await authorize();
      const ticket = secret();
      await tickets.doc(key(ticket)).create({ parent: key(cookie), id, expires: new Date(Date.now() + 30_000) });
      postTicket(res, origin, ticket);
    },
    async exchange(ticket) {
      if (!valid(ticket)) throw denied();
      const ref = tickets.doc(key(ticket));
      const handle = secret();
      return db.runTransaction(async tx => {
        const grant = (await tx.get(ref)).data();
        if (!active(grant) || !['terminal', 'terminal-admin'].includes(grant.id)) throw denied();
        const parent = (await tx.get(parents.doc(grant.parent))).data();
        const account = await user(parent);
        const allowed = destination(grant.id, false).roles;
        if (allowed && !allowed.includes(account.customClaims.role)) throw denied(403);
        tx.delete(ref);
        tx.create(handles.doc(key(handle)), { parent: grant.parent, expires: parent.expires });
        return { handle, entry: grant.id === 'terminal-admin' ? '/admin' : '/' };
      });
    },
    async check(handle, id) {
      if (!valid(handle)) throw denied();
      const linked = (await handles.doc(key(handle)).get()).data();
      if (!active(linked)) throw denied();
      const account = await user((await parents.doc(linked.parent).get()).data());
      const allowed = destination(id, false).roles;
      if (allowed && !allowed.includes(account.customClaims.role)) throw denied(403);
    },
  };
}
