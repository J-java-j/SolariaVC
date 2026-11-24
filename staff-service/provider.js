import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { invite } from './invitations.js';

// Only these two loopback emulators are supported. Never discover a cloud project
// or use a service-account credential from the website environment.
export function connectEmulator(test = false) {
  const projectId = test ? 'demo-solaria-staff-test' : 'demo-solaria-staff';
  const host = test ? '127.0.0.1:9199' : '127.0.0.1:9099';
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST !== host) {
    throw new Error('Conflicting Firebase Auth emulator host.');
  }
  process.env.FIREBASE_AUTH_EMULATOR_HOST = host;
  const auth = getAuth(initializeApp({ projectId }, projectId));
  const base = 'http://' + host;
  const identity = base + '/identitytoolkit.googleapis.com/v1';

  return { auth, base, identity, projectId, portalOrigin: 'http://127.0.0.1:5173',
    accepts: email => /^[a-z0-9._+-]+@example\.test$/i.test(email),
    updateAccount: accountWriter(auth, projectId, identity, async () => 'owner') };
}

export function configuredProvider() {
  if (process.env.TEAM_AUTH_MODE === 'emulator-test') return connectEmulator(true);
  if (!process.env.TEAM_AUTH_MODE || process.env.TEAM_AUTH_MODE === 'emulator') return connectEmulator();
  const production = process.env.TEAM_AUTH_MODE === 'production';
  if ((!production && process.env.TEAM_AUTH_MODE !== 'staging') || process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Conflicting auth environment.');
  const needed = ['TEAM_FIREBASE_PROJECT', 'TEAM_FIREBASE_TENANT', 'TEAM_PORTAL_ORIGIN', 'TEAM_INVITE_EMAILS'];
  for (const key of needed) if (!process.env[key]?.trim()) throw new Error('Missing ' + key);
  const projectId = process.env.TEAM_FIREBASE_PROJECT;
  const origin = new URL(process.env.TEAM_PORTAL_ORIGIN);
  if (origin.protocol !== 'https:' || origin.origin !== process.env.TEAM_PORTAL_ORIGIN || projectId.startsWith('demo-')) {
    throw new Error('Configure an HTTPS staging origin and a dedicated Firebase project.');
  }
  const sender = process.env.TEAM_MAIL_FROM || (production && process.env.CONTACT_FROM_EMAIL);
  const key = process.env.TEAM_RESEND_API_KEY || (production && process.env.RESEND_API_KEY);
  if (!sender || !key) throw new Error('Configure the Team invitation sender.');
  if (production && (origin.origin !== 'https://solariavc.com' || projectId !== 'gen-lang-client-0188652481' ||
      process.env.TEAM_FIREBASE_TENANT !== 'team-login-prod-drkt6' || process.env.TEAM_SESSION_DATABASE !== 'team-login-prod')) {
    throw new Error('Unexpected production Team Login identity configuration.');
  }
  const allowed = new Set(process.env.TEAM_INVITE_EMAILS.toLowerCase().split(',').map(s => s.trim()));
  const credential = applicationDefault();
  const tenantId = process.env.TEAM_FIREBASE_TENANT;
  const app = initializeApp({ projectId, credential }, projectId);
  const auth = getAuth(app).tenantManager().authForTenant(tenantId);
  return { auth, app, projectId, portalOrigin: origin.origin, accepts: email => allowed.has(email),
    mail: { sender, key },
    updateAccount: accountWriter(auth, projectId + '/tenants/' + encodeURIComponent(tenantId), 'https://identitytoolkit.googleapis.com/v1', async () => (await credential.getAccessToken()).access_token) };
}

function accountWriter(auth, projectId, identity, accessToken) {
  return async function updateAccount(user, changes) {
    // One Identity Toolkit admin update applies a combined edit atomically.
    const fields = { localId: user.uid };
    if ('displayName' in changes) fields.displayName = changes.displayName;
    if ('active' in changes) fields.disableUser = !changes.active;
    if ('role' in changes) {
      fields.customAttributes = JSON.stringify({ ...user.customClaims, role: changes.role });
    }
    const response = await fetch(identity + '/projects/' + projectId + '/accounts:update', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + await accessToken(), 'Content-Type': 'application/json' },
      body: JSON.stringify(fields)
    });
    if (!response.ok) throw new Error('Local Firebase account update failed.');
    return auth.getUser(user.uid);
  };
}

export const roles = ['staff', 'board-admin', 'owner'];

export function profile(user) {
  return {
    uid: user.uid, email: user.email, displayName: user.displayName,
    role: user.customClaims?.role, active: !user.disabled
  };
}

export async function provision(provider, fields, role, sendInvite = false) {
  const user = await provider.auth.createUser(fields);
  try {
    // Passwordless until the invited user redeems the provider's single-use link.
    // Firebase records the action link in its local emulator outbox.
    await provider.auth.setCustomUserClaims(user.uid, { role });
  } catch (error) {
    await provider.auth.deleteUser(user.uid);
    throw error;
  }
  // Keep the account on delivery failure. A manager can retry the invitation.
  if (sendInvite) {
    try { await invite(provider, user.email); }
    catch { throw Object.assign(new Error('Account created. Use Resend invitation to retry delivery.'), { status: 502 }); }
  }
  return { ...profile(user), role };
}
