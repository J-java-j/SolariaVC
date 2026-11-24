import { createServer } from 'node:http';
import { profile, provision, roles } from './provider.js';
import { invite, outbox } from './invitations.js';
import { browserSession, destination } from './session.js';
import { terminalHandoff } from './terminal-handoff.js';
import { hostedTerminal, sessionDatabase, httpsOrigin } from './hosted-terminal.js';

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const forbidden = () => new HttpError(403, 'Access denied.');
const unauthorized = () => new HttpError(401, 'A valid Firebase ID token is required.');
const badInput = (message) => new HttpError(400, message);

function canManage(actor, role) {
  return (role === 'staff' && ['board-admin', 'owner'].includes(actor)) ||
    (role === 'board-admin' && actor === 'owner');
}

async function readFields(req, creating, provider) {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json') {
    throw new HttpError(415, 'Send an application/json body.');
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 8192) throw new HttpError(413, 'Request is too large.');
    chunks.push(chunk);
  }
  let fields;
  try { fields = JSON.parse(Buffer.concat(chunks).toString()); }
  catch { throw badInput('Invalid JSON.'); }
  if (creating === 'recovery') {
    if (!fields || Object.keys(fields).length !== 1 || typeof fields.email !== 'string') throw badInput('Enter your email.');
    const email = fields.email.trim().toLowerCase();
    if (email.length > 254 || !/^[^@\s]+@[^@\s]+$/.test(email)) throw badInput('Enter your email.');
    return { email };
  }
  const allowed = creating ? ['displayName', 'email', 'role'] : ['displayName', 'role', 'active'];
  if (!fields || typeof fields !== 'object' || Array.isArray(fields) || !Object.keys(fields).length ||
      Object.keys(fields).some(key => !allowed.includes(key))) throw badInput('Invalid account fields.');
  if (creating || 'displayName' in fields) {
    if (typeof fields.displayName !== 'string' || !fields.displayName.trim() || fields.displayName.trim().length > 120) {
      throw badInput('Enter a display name of 1 to 120 characters.');
    }
    fields.displayName = fields.displayName.trim();
  }
  if ((creating || 'role' in fields) && !roles.includes(fields.role)) throw badInput('Unknown role.');
  if ('active' in fields && typeof fields.active !== 'boolean') throw badInput('active must be a boolean.');
  if (creating) {
    if (typeof fields.email !== 'string' || !provider.accepts(fields.email.trim().toLowerCase())) {
      throw badInput(provider.base ? 'Use a fictional address at example.test.' : 'Use an approved team email.');
    }
    fields.email = fields.email.trim().toLowerCase();
  }
  return fields;
}

export function staffServer(provider) {
  const { auth } = provider;
  const session = browserSession(provider);
  const db = provider.app && sessionDatabase(provider.app);
  const hosted = db && hostedTerminal(auth, db, httpsOrigin(process.env.TEAM_TERMINAL_ORIGIN));
  const terminal = hosted || (provider.base && process.env.TEAM_LOCAL_TERMINAL === '1' ? terminalHandoff() : null);
  // This independently running service is the single portal writer. Serialize
  // authorization and mutation together, including competing role/status edits.
  let lastWrite = Promise.resolve();
  function serialize(write) {
    const result = lastWrite.then(write);
    lastWrite = result.catch(() => {});
    return result;
  }

  async function currentRole(req, management = false, cookieOnly = false, cookie = session.read(req), fresh = req.method !== 'GET') {
    const token = !cookieOnly && /^Bearer (\S+)$/.exec(req.headers.authorization || '')?.[1];
    if (!token && !cookie) throw unauthorized();
    if (hosted && !token) {
      // Only portal page reads may use the 10-second memory; changes and guards check fresh.
      const actor = profile(await hosted.user(cookie, fresh));
      if (management && actor.role === 'staff') throw forbidden();
      return actor;
    }
    const { uid } = token ? await auth.verifyIdToken(token, true) : await auth.verifySessionCookie(cookie, true);
    const actor = profile(await auth.getUser(uid));
    if (!actor.active || !roles.includes(actor.role) || (management && actor.role === 'staff')) throw forbidden();
    return actor;
  }

  async function handle(req) {
    const path = new URL(req.url, 'http://127.0.0.1').pathname;
    if (req.method === 'GET' && path === '/health') {
      await auth.listUsers(1);
      return [200, { status: 'ok', project: provider.projectId }];
    }
    if (req.method === 'GET' && path === '/me') return [200, await currentRole(req)];
    if (req.method === 'GET' && path === '/accounts') {
      const actor = await currentRole(req, true);
      const accounts = [];
      let page;
      do {
        const batch = await auth.listUsers(1000, page);
        accounts.push(...batch.users.filter(user => canManage(actor.role, user.customClaims?.role)).map(user => ({
          ...profile(user), awaitingSetup: !user.providerData.some(p => p.providerId === 'password')
        })));
        page = batch.pageToken;
      } while (page);
      return [200, { accounts }];
    }
    const create = req.method === 'POST' && path === '/accounts';
    const target = req.method === 'PATCH' && /^\/accounts\/([A-Za-z0-9_-]+)$/.exec(path);
    const resend = req.method === 'POST' && /^\/accounts\/([A-Za-z0-9_-]+)\/invite$/.exec(path);
    if (!create && !target && !resend) throw new HttpError(404, 'Unknown endpoint.');
    await currentRole(req, true);
    const fields = resend ? {} : await readFields(req, create, provider);
    return serialize(async () => {
      const actor = await currentRole(req, true);
      if ('role' in fields && !canManage(actor.role, fields.role)) throw forbidden();
      if (create) {
        const { email, displayName, role } = fields;
        return [201, await provision(provider, { email, displayName }, role, true)];
      }
      const user = await auth.getUser((resend || target)[1]);
      if (!canManage(actor.role, user.customClaims?.role)) throw forbidden();
      if (resend) {
        if (user.disabled || !provider.accepts(user.email) || user.providerData.some(p => p.providerId === 'password')) {
          throw badInput('Invitations are for active accounts awaiting password setup.');
        }
        await invite(provider, user.email);
        return [200, { sent: true }];
      }
      return [200, profile(await provider.updateAccount(user, fields))];
    });
  }

  return createServer(async (req, res) => {
    let status, body;
    const path = new URL(req.url, 'http://localhost').pathname;
    const launch = /^\/staff\/launch\/([^/]+)$/.exec(path);
    const guard = /^\/guard\/([^/]+)$/.exec(path);
    const inbox = provider.base && ['/staff/outbox', '/outbox'].includes(path);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    try {
      if (path === '/recovery' && req.method === 'POST') {
        if (!session.sameOrigin(req)) throw forbidden();
        const fields = await readFields(req, 'recovery', provider);
        if (provider.accepts(fields.email)) {
          const user = await auth.getUserByEmail(fields.email).catch(err => {
            if (err.code !== 'auth/user-not-found') throw err;
            return null;
          });
          if (user && !user.disabled && roles.includes(user.customClaims?.role)) {
            const ref = db?.collection('teamRecoveryMail').doc(user.uid);
            const send = !ref || await db.runTransaction(async tx => {
              const last = (await tx.get(ref)).get('requestedAt');
              if (last && Date.now() - last.toMillis() < 120000) return false;
              tx.set(ref, { requestedAt: new Date() });
              return true;
            });
            if (send) {
              await invite(provider, fields.email, user.providerData.some(p => p.providerId === 'password'));
              console.info('Team recovery email accepted by mail provider');
            }
          }
        }
        res.writeHead(202, { 'Content-Type': 'application/json' }).end('{}');
        return;
      }
      if (!hosted && terminal && path === '/internal/terminal/exchange' && req.method === 'POST') {
        // This loopback endpoint accepts only a one-time ticket from Terminal's backchannel.
        const grant = terminal.exchange(req.headers['x-terminal-ticket']);
        if (!grant) throw unauthorized();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(grant)); return;
      }
      if (req.method !== 'GET' && (!/^Bearer \S+$/.test(req.headers.authorization || '') || path === '/session') && !session.sameOrigin(req)) throw forbidden();
      if (path === '/session' && req.method === 'POST') {
        const token = /^Bearer (\S+)$/.exec(req.headers.authorization || '')?.[1];
        if (!token) throw unauthorized();
        const claims = await auth.verifyIdToken(token, true);
        if (Date.now() / 1000 - claims.auth_time > 300) throw unauthorized();
        await currentRole(req);
        if (hosted) await hosted.forget(session.read(req));
        res.setHeader('Set-Cookie', hosted ? session.header(await hosted.start(claims)) : await session.issue(token));
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{}'); return;
      }
      if (path === '/session' && req.method === 'DELETE') {
        await terminal?.forget(session.read(req));
        res.setHeader('Set-Cookie', session.clear);
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{}'); return;
      }
      let actor;
      if (launch || guard || inbox) {
        if (req.method !== 'GET') throw new HttpError(405, 'Method not allowed.');
        const id = (launch || guard)?.[1] ?? 'outbox';
        const item = destination(id, Boolean(provider.base));
        if (!item) throw new HttpError(404, 'Unknown shortcut.');
        const terminalEntry = id === 'terminal' || id === 'terminal-admin';
        let cookie = session.read(req);
        if (!hosted && guard && terminalEntry && req.headers['x-terminal-session']) {
          cookie = terminal?.cookie(req.headers['x-terminal-session']);
          if (!cookie) throw unauthorized();
        }
        const authorize = async () => {
          // Guards always check fresh: the website authorizes every Sign page and Sign API
          // call, writes included, through a GET to /guard/<id>.
          const user = await currentRole(req, false, true, cookie, Boolean(guard) || req.method !== 'GET');
          if (item.roles && !item.roles.includes(user.role)) throw forbidden();
          return user;
        };
        if (launch && terminal && terminalEntry && cookie && process.env.TEAM_TERMINAL_HANDOFF !== 'off') {
          await terminal.launch(res, id, cookie, authorize);
          return;
        }
        actor = await authorize();
        if (launch) { res.writeHead(303, { Location: item.href }); res.end(); return; }
        if (guard) { res.writeHead(204); res.end(); return; }
      }
      if (inbox) {
        const html = await outbox(provider, actor.role);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
          'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'" });
        res.end(html);
        return;
      }
      [status, body] = await handle(req);
    } catch (err) {
      let error = err;
      if (err.code === 'auth/user-disabled') error = forbidden();
      if (['auth/invalid-id-token', 'auth/id-token-expired', 'auth/id-token-revoked', 'auth/argument-error', 'auth/session-cookie-expired', 'auth/session-cookie-revoked', 'auth/invalid-session-cookie'].includes(err.code)) error = unauthorized();
      if (err.code === 'auth/user-not-found') error = new HttpError(404, 'Account not found.');
      if (err.code === 'auth/email-already-exists') error = new HttpError(409, 'Email address already in use.');
      if (err.code === 'auth/invalid-email') error = badInput('Invalid email.');
      status = error.status || 503;
      if ((launch || inbox) && status === 401) {
        const origin = path === '/outbox' ? provider.portalOrigin : '';
        res.writeHead(303, { Location: origin + '/staff?launch=' + encodeURIComponent(launch?.[1] || 'outbox'), 'Set-Cookie': session.clear });
        res.end(); return;
      }
      if ((launch || inbox) && status === 403) {
        res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<!doctype html><title>Access denied</title><h1>Access denied</h1><a href="/staff">Team portal</a>'); return;
      }
      body = { error: error.status ? error.message : 'Local authentication service unavailable.' };
      if (!error.status) console.error('Staff provider request failed', err.code || err.name);
    }
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  });
}
