export type FieldType = 'signature' | 'initials' | 'date' | 'name' | 'text' | 'checkbox';

export type Field = {
  id: string;
  recipientId: string;
  type: FieldType;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  required: boolean;
  label: string;
  value?: string | boolean;
};

export type Recipient = {
  id: string;
  name: string;
  email: string;
  role: 'signer' | 'cc';
  order: number;
  delivery: 'email' | 'link';
  requireCode: boolean;
  status: string;
  sentAt?: string;
  viewedAt?: string;
  signedAt?: string;
  declinedAt?: string;
  declineReason?: string;
  copySentAt?: string;
};

export type PageSize = { width: number; height: number };

export type AuditEvent = {
  seq: number;
  at: string;
  type: string;
  label: string;
  by: string;
  ip?: string;
  ua?: string;
  hash: string;
};

export type EnvelopeSummary = {
  id: string;
  reference: string;
  title: string;
  status: 'draft' | 'sent' | 'completed' | 'declined' | 'voided' | 'expired';
  sealing: boolean;
  createdAt: string;
  sentAt?: string;
  completedAt?: string;
  expiresAt?: string;
  sender: { name: string; email: string };
  recipients: Recipient[];
  folderId: string | null;
  deletedAt: string | null;
};

export type Envelope = EnvelopeSummary & {
  message: string;
  sequential: boolean;
  expiryDays: number;
  document: { fileName: string; bytes: number; pages: number; sizes: PageSize[]; sha256: string };
  fields: Field[];
  sealed: {
    sha256: string;
    bytes: number;
    at: string;
    timestamp: { tsa: string; genTime: string; embedded: boolean } | null;
  } | null;
  sealError: string | null;
  chainValid: boolean;
  events: AuditEvent[];
};

export type Draft = Pick<Envelope, 'title' | 'message' | 'sequential' | 'expiryDays' | 'recipients' | 'fields'>;

export type SentLink = { recipientId: string; name: string; url: string };

export type BulkResult = { name: string; email: string; ok: boolean; id?: string; links?: SentLink[]; emailFailed?: boolean; error?: string };

export type Folder = { id: string; name: string };

export type TeamMember = { email: string; name: string; title?: string; owner: boolean; addedAt?: string };

export type Disclosure = {
  version: string;
  title: string;
  intro: string;
  sections: { heading: string; body: string }[];
  agreement: string;
};

export type OtherField = Pick<Field, 'id' | 'type' | 'page' | 'x' | 'y' | 'w' | 'h' | 'value'> & { image?: string };

export type SignerSession = {
  state: 'code' | 'sign' | 'signed' | 'waiting' | 'sealing' | 'completed' | 'declined' | 'voided' | 'expired' | 'unavailable';
  reference: string;
  sender: { name: string };
  org: string;
  maskedEmail?: string;
  title?: string;
  sha256?: string;
  recipient?: { name: string; email: string };
  message?: string;
  fileName?: string;
  pages?: number;
  sizes?: PageSize[];
  needsConsent?: boolean;
  disclosure?: Disclosure;
  intent?: { version: string; adopt: string; finish: string };
  fields?: Field[];
  others?: OtherField[];
};

export type Mark = { dataUrl: string; method: 'draw' | 'type'; name: string };

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function failure(res: Response): Promise<never> {
  const body = await res.json().catch(() => null) as { error?: string } | null;
  throw new ApiError(body?.error ?? 'The server did not respond. Check your connection and try again.', res.status);
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/sign/${path}`, init).catch(() => {
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0);
  });
  if (!res.ok) await failure(res);
  return res.json() as Promise<T>;
}

async function bytes(path: string, init?: RequestInit): Promise<ArrayBuffer> {
  const res = await fetch(`/api/sign/${path}`, init).catch(() => {
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0);
  });
  if (!res.ok) await failure(res);
  return res.arrayBuffer();
}

const post = (body?: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body ?? {}),
});

export const api = {
  me: () => call<{ user: { name: string; email: string; owner: boolean } | null }>('me'),
  requestLogin: (email: string) => call('auth/request', post({ email })),
  verifyLogin: (token: string) => call('auth/verify', post({ token })),
  logout: () => call('auth/logout', post()),

  team: () => call<{ people: TeamMember[] }>('team'),
  addAdmin: (person: { name: string; email: string; title: string }) => call<{ admin: TeamMember; invited: boolean }>('team', post(person)),
  removeAdmin: (email: string) => call('team/remove', post({ email })),

  folders: () => call<{ folders: Folder[] }>('folders'),
  createFolder: (name: string) => call<Folder>('folders', post({ name })),
  renameFolder: (id: string, name: string) => call<Folder>(`folders/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  }),
  deleteFolder: (id: string) => call(`folders/${id}`, { method: 'DELETE' }),

  list: () => call<{ envelopes: EnvelopeSummary[] }>('envelopes'),
  get: (id: string) => call<Envelope>(`envelopes/${id}`),
  upload: (file: File, folderId?: string) => call<Envelope>(`envelopes?name=${encodeURIComponent(file.name)}${folderId ? `&folder=${folderId}` : ''}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/pdf' },
    body: file,
  }),
  save: (id: string, draft: Draft) => call<Envelope>(`envelopes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draft),
  }),
  remove: (id: string) => call(`envelopes/${id}`, { method: 'DELETE' }),
  deleteDocuments: (ids: string[]) => call('envelopes/selection/delete', post({ ids })),
  restoreDocuments: (ids: string[]) => call('envelopes/selection/restore', post({ ids })),
  eraseDocuments: (ids: string[]) => call('envelopes/selection/erase', post({ ids })),
  voidDocuments: (ids: string[], reason: string) => call('envelopes/selection/void', post({ ids, reason })),
  moveDocuments: (ids: string[], folderId: string | null) => call('envelopes/selection/move', post({ ids, folderId })),
  send: (id: string) => call<{ envelope: Envelope; links: SentLink[]; failed: string[] }>(`envelopes/${id}/send`, post()),
  remind: (id: string, recipientId: string) => call(`envelopes/${id}/remind`, post({ recipientId })),
  newLink: (id: string, recipientId: string) => call<{ url: string }>(`envelopes/${id}/link`, post({ recipientId })),
  voidEnvelope: (id: string, reason: string) => call(`envelopes/${id}/void`, post({ reason })),
  duplicate: (id: string) => call<Envelope>(`envelopes/${id}/duplicate`, post()),
  bulkSend: (id: string, recipientId: string, people: { name: string; email: string }[]) =>
    call<{ batch: string; results: BulkResult[] }>(`envelopes/${id}/bulk`, post({ recipientId, people })),
  finish: (id: string) => call<Envelope>(`envelopes/${id}/finish`, post()),
  timestamp: (id: string) => call<Envelope>(`envelopes/${id}/timestamp`, post()),
  original: (id: string) => bytes(`envelopes/${id}/original`),
  sealed: (id: string) => bytes(`envelopes/${id}/sealed`),

  verify: (sha256: string) => call<{
    found: boolean;
    reference?: string;
    title?: string;
    completedAt?: string;
    timestamp?: { tsa: string; genTime: string } | null;
    signers?: { name: string; signedAt: string }[];
  }>(`verify/${sha256}`),
};

export function signerApi(token: string, verified: () => string | null) {
  const auth = (init: RequestInit = {}): RequestInit => ({
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      ...(verified() ? { 'X-Sign-Verified': verified()! } : {}),
    },
  });
  return {
    session: () => call<SignerSession>('s/session', auth()),
    sendCode: () => call('s/code/send', auth(post())),
    verifyCode: (code: string) => call<{ verified: string }>('s/code/verify', auth(post({ code }))),
    document: () => bytes('s/document', auth()),
    viewed: () => call('s/viewed', auth(post())),
    consent: (version: string) => call('s/consent', auth(post({ version, previewed: true }))),
    submit: (body: object) => call<SignerSession>('s/submit', auth(post(body))),
    finish: () => call<SignerSession>('s/finish', auth(post())),
    decline: (body: { reason?: string; paper?: boolean }) => call('s/decline', auth(post(body))),
    sealed: () => bytes('s/sealed', auth()),
  };
}

export function saveFile(data: ArrayBuffer, fileName: string) {
  const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const signedFileName = (title: string) => `${title.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Document'} - signed.pdf`;
