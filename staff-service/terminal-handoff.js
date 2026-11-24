import { randomBytes } from 'node:crypto';

const origin = 'http://localhost:8790';
const random = () => randomBytes(32).toString('base64url');

// Local, single-process bridge. Only the portal holds the Firebase session.
export function terminalHandoff() {
  const tickets = new Map();
  const sessions = new Map();
  const lifetime = 8 * 60 * 60_000;
  function lookup(store, key) {
    const record = store.get(key);
    if (record?.expires > Date.now()) return record;
    store.delete(key);
  }
  function prune() {
    for (const store of [tickets, sessions]) {
      for (const key of store.keys()) lookup(store, key);
    }
  }
  return {
    async launch(res, id, cookie, authorize) {
      prune();
      const ticket = random();
      tickets.set(ticket, { id, cookie, expires: Date.now() + 30_000 });
      // Register before the asynchronous Firebase check. A concurrent sign-out
      // can invalidate the grant even while this launch is waiting for a role.
      try {
        await authorize();
      } catch (err) {
        tickets.delete(ticket);
        throw err;
      }
      if (!lookup(tickets, ticket)) {
        res.writeHead(303, { Location: '/staff?launch=' + id });
        res.end(); return;
      }
      postTicket(res, origin, ticket);
    },
    exchange(ticket) {
      const record = lookup(tickets, ticket);
      if (!record) return null;
      tickets.delete(ticket);
      const handle = random();
      sessions.set(handle, { cookie: record.cookie, expires: Date.now() + lifetime });
      return { handle, entry: record.id === 'terminal-admin' ? '/admin' : '/' };
    },
    cookie(handle) { return lookup(sessions, handle)?.cookie; },
    forget(cookie) {
      for (const store of [tickets, sessions]) {
        for (const [key, record] of store) if (record.cookie === cookie) store.delete(key);
      }
    },
  };
}

export function postTicket(res, origin, ticket) {
  const nonce = random();
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Referrer-Policy': 'strict-origin',
    'Content-Security-Policy': `default-src 'none'; base-uri 'none'; frame-ancestors 'none'; script-src 'nonce-${nonce}'; form-action ${origin}`,
  });
  res.end(`<!doctype html><title>Opening Terminal</title><form action="${origin}/team/session" method="post"><input type="hidden" name="ticket" value="${ticket}"><noscript><button>Continue to Terminal</button></noscript></form><script nonce="${nonce}">document.forms[0].submit()</script>`);
}
