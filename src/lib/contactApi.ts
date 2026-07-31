export type ContactKind = 'founder' | 'investor' | 'other';

export type ContactPayload = {
  name: string;
  email: string;
  message: string;
  kind: ContactKind;
  website?: string;
};

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

export async function submitContact(payload: ContactPayload): Promise<void> {
  const res = await fetch('/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: payload.name.trim(),
      email: payload.email.trim(),
      message: payload.message.trim(),
      kind: payload.kind,
      website: payload.website?.trim() || '',
    }),
  });

  let data: { ok?: boolean; error?: string } = {};
  try {
    data = (await res.json()) as { ok?: boolean; error?: string };
  } catch {
    // ignore parse errors
  }

  if (!res.ok) {
    throw new Error(data.error || `Something went wrong (${res.status}). Please try again.`);
  }

  if (!data.ok) {
    throw new Error(data.error || 'Submission failed. Please try again.');
  }
}
