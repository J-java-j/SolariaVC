import { createServer } from 'node:http';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { OAuth2Client } from 'google-auth-library';
import { hostedTerminal, httpsOrigin, sessionDatabase } from './hosted-terminal.js';

// Run as a separate, IAM-private Cloud Run service. Neither browser cookies nor
// Firebase bearer tokens authorize a request to this listener.
const projectId = process.env.TEAM_FIREBASE_PROJECT;
const tenant = process.env.TEAM_FIREBASE_TENANT;
const caller = process.env.TEAM_TERMINAL_CALLER;
const audience = httpsOrigin(process.env.TEAM_VERIFIER_ORIGIN);
if (!projectId || !tenant || !caller || process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Incomplete verifier configuration.');
const app = initializeApp({ projectId });
const bridge = hostedTerminal(getAuth(app).tenantManager().authForTenant(tenant), sessionDatabase(app));
const oidc = new OAuth2Client();

createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const guard = /^\/guard\/(terminal|terminal-admin)$/.exec(req.url);
  const exchange = req.method === 'POST' && req.url === '/internal/terminal/exchange';
  if (!exchange && !(req.method === 'GET' && guard)) { res.writeHead(404).end(); return; }
  try {
    const token = /^Bearer (\S+)$/.exec(req.headers.authorization || '')?.[1];
    if (!token) throw new Error();
    const identity = (await oidc.verifyIdToken({ idToken: token, audience })).getPayload();
    if (!identity?.email_verified || identity.email !== caller) throw new Error();
  } catch { res.writeHead(403).end(); return; }
  try {
    if (exchange) {
      const grant = await bridge.exchange(req.headers['x-terminal-ticket']);
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(grant));
    } else {
      await bridge.check(req.headers['x-terminal-session'], guard[1]);
      res.writeHead(204).end();
    }
  } catch (err) {
    const status = err.code === 'auth/user-not-found' ? 401 : err.status;
    res.writeHead([401, 403].includes(status) ? status : 503).end();
  }
}).listen(Number(process.env.PORT || 8080), '0.0.0.0');
