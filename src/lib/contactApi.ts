export type ContactKind = 'founder' | 'investor' | 'other';

export type ContactPayload = {
  name: string;
  email: string;
  message: string;
  kind: ContactKind;
  website?: string;
  turnstileToken?: string;
};

export type ContactConfig = { siteKey: string; available: boolean };
export type ContactVerification = { verificationId: string };

type ApiResponse = {
  ok?: boolean;
  error?: string;
  siteKey?: string;
  available?: boolean;
  verificationRequired?: boolean;
  verificationId?: string;
  sent?: boolean;
};

export class ContactApiError extends Error {
  constructor(message: string, public retryAfterSeconds = 0) {
    super(message);
    this.name = 'ContactApiError';
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateContact(payload: ContactPayload): string | null {
  const name = payload.name.trim();
  const email = payload.email.trim();
  const message = payload.message.trim();

  if (!name || name.length > 120) return 'Please enter your name.';
  if (!email || !EMAIL_RE.test(email) || email.length > 200) {
    return 'Please enter a valid email address.';
  }
  if (message.length < 3) return 'Please add a short message (at least 3 characters).';
  if (message.length > 8000) return 'Message is too long (max 8,000 characters).';
  return null;
}

async function request(path: string, payload?: object): Promise<ApiResponse> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 90_000);
  try {
    const res = await fetch(path, {
      method: payload ? 'POST' : 'GET',
      headers: payload ? { 'Content-Type': 'application/json' } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
      cache: 'no-store',
      signal: controller.signal,
    });
    const data = await res.json().catch(() => null) as ApiResponse | null;
    if (!res.ok) {
      const retryAfter = Number(res.headers.get('Retry-After'));
      throw new ContactApiError(
        data?.error || `Something went wrong (${res.status}). Please try again.`,
        Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 0,
      );
    }
    if (!data || typeof data !== 'object') {
      throw new Error('The contact service returned an unexpected response. Please try again.');
    }
    return data;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('The request timed out. Please try again.');
    }
    throw err;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function getContactConfig(): Promise<ContactConfig> {
  const data = await request('/api/contact/config');
  if (data.available !== true || typeof data.siteKey !== 'string') {
    throw new Error('The contact form is temporarily unavailable. Please try again later.');
  }
  return { available: true, siteKey: data.siteKey };
}

export async function submitContact(payload: ContactPayload): Promise<ContactVerification> {
  const data = await request('/api/contact', {
    name: payload.name.trim(),
    email: payload.email.trim(),
    message: payload.message.trim(),
    kind: payload.kind,
    website: payload.website?.trim() || '',
    turnstileToken: payload.turnstileToken || '',
  });
  if (data.ok !== true || data.verificationRequired !== true || typeof data.verificationId !== 'string' || !data.verificationId) {
    throw new Error(data.error || 'Email verification could not be started. Please try again.');
  }
  return { verificationId: data.verificationId };
}

export async function verifyContact(verificationId: string, code: string): Promise<void> {
  const data = await request('/api/contact/verify', { verificationId, code: code.trim() });
  if (data.ok !== true || data.sent !== true) {
    throw new Error(data.error || 'Your message has not been sent. Please try again.');
  }
}
