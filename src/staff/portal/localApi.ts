import type { Account, Role } from './accounts';

type Profile = { uid: string; email: string; displayName: string; role: Role; active: boolean; awaitingSetup?: boolean };

export class ApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

const identity = (import.meta.env.DEV ? 'http://127.0.0.1:9099/' : 'https://') + 'identitytoolkit.googleapis.com/v1/accounts:';
const apiKey = import.meta.env.DEV ? 'local-demo' : import.meta.env.VITE_TEAM_FIREBASE_API_KEY;

async function firebase(action: string, fields: object) {
  if (!apiKey) throw new Error('The portal sign-in configuration is incomplete.');
  let response;
  try {
    response = await fetch(identity + action + '?key=' + encodeURIComponent(apiKey), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...fields, tenantId: import.meta.env.DEV ? undefined : import.meta.env.VITE_TEAM_FIREBASE_TENANT }),
    });
  } catch { throw new Error('Firebase is unavailable. Check your connection and try again.'); }
  const result = await response.json();
  if (!response.ok) {
    const code = result.error?.message?.split(' ')[0];
    if (['INVALID_OOB_CODE', 'EXPIRED_OOB_CODE'].includes(code)) throw new Error('This invitation has expired or has already been used.');
    if (['EMAIL_NOT_FOUND', 'INVALID_PASSWORD', 'INVALID_LOGIN_CREDENTIALS'].includes(code)) throw new ApiError(401, 'Check your email and password.');
    if (code === 'USER_DISABLED') throw new Error('This account is inactive. Contact your administrator.');
    if (code === 'WEAK_PASSWORD' || code === 'PASSWORD_DOES_NOT_MEET_REQUIREMENTS') throw new Error('Choose a stronger password and try again.');
    throw new Error('Firebase could not complete this request. Try again or contact your administrator.');
  }
  return result;
}

export async function invitation(code: string, newPassword?: string): Promise<string> {
  const result = await firebase('resetPassword', { oobCode: code, newPassword });
  return result.email;
}

export async function login(email: string, password: string): Promise<string> {
  return (await firebase('signInWithPassword', { email, password, returnSecureToken: true })).idToken;
}

export async function changePassword(user: Account, current: string, password: string): Promise<string> {
  let fresh;
  try { fresh = await login(user.username, current); }
  catch (err) {
    if (err instanceof ApiError && err.status === 401) throw new Error('Current password is incorrect. Re-enter your current password.');
    throw err;
  }
  if ((await currentAccount(fresh)).id !== user.id) throw new Error('Sign in again before changing your password.');
  return (await firebase('update', { idToken: fresh, password, returnSecureToken: true })).idToken;
}

export async function request<T>(path: string, method = 'GET', fields?: object, token?: string): Promise<T> {
  let response;
  try {
    response = await fetch('/staff/local-api' + path, {
      method, credentials: 'same-origin', headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), 'X-Team-Request': '1', 'Content-Type': 'application/json' },
      body: JSON.stringify(fields), cache: 'no-store',
    });
  } catch { throw new Error('Could not reach the local staff service.'); }
  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    throw new ApiError(response.status, details.error || 'The local staff service is unavailable.');
  }
  return response.json();
}

function toAccount(profile: Profile): Account {
  return { id: profile.uid, name: profile.displayName, username: profile.email, role: profile.role,
    awaitingSetup: profile.awaitingSetup, status: profile.active ? 'active' : 'inactive' };
}

export async function currentAccount(token?: string) {
  const profile = await request<Profile>('/me', 'GET', undefined, token);
  if (!profile.active) throw new ApiError(403, 'This account is inactive.');
  return toAccount(profile);
}

export async function roster() {
  const { accounts } = await request<{ accounts: Profile[] }>('/accounts');
  return accounts.map(toAccount);
}
