import { provision } from './provider.js';

export const fixturePassword = 'Fictional-local-2026!';
export const fixtures = [
  { role: 'staff', displayName: 'Avery Morgan' },
  { role: 'board-admin', displayName: 'Riley Chen' },
  { role: 'owner', displayName: 'Alex Rowan' }
].map(user => ({
  ...user, uid: 'seed-' + user.role, email: user.role + '@example.test'
}));

export async function seed(provider) {
  for (const { uid, email, displayName, role } of fixtures) {
    try {
      const existing = await provider.auth.getUser(uid);
      if (existing.email !== email || !existing.customClaims?.role) {
        throw new Error('Conflicting seed identity: ' + uid);
      }
    } catch (err) {
      if (err.code !== 'auth/user-not-found') throw err;
      await provision(provider, { uid, email, displayName, password: fixturePassword }, role);
    }
  }
}

export function passwordSignIn(identity, email, password) {
  return fetch(identity + '/accounts:signInWithPassword?key=local-demo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });
}
