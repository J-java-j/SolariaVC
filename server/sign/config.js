// Solaria Sign settings.
//
// Owners are fixed here rather than read from the environment, for the same reason
// CONTACT_TO is hardcoded in server/index.js: a stale Cloud Run variable must never
// be able to widen access. An owner adds and removes admins on the Team page. Those
// live with the other records, so nothing stored can remove an owner.
export const OWNERS = new Map([
  ['johnsonjiang@solariavc.com', { name: 'Johnson Jiang', title: 'Founder & Managing Partner' }],
]);

export const ORG = {
  legalName: 'Solaria Capital, LLC',
  name: 'Solaria Capital',
  contactEmail: 'contact@solariavc.com',
  location: 'La Jolla, California',
};

export const LIMITS = {
  uploadBytes: 20 * 1024 * 1024,
  pages: 500,
  // Above this the completed copy is linked rather than attached; most inboxes
  // reject messages over 25 MB and base64 adds a third.
  attachmentBytes: 15 * 1024 * 1024,
  recipients: 10,
  fields: 300,
  signatureBytes: 512 * 1024,
  textValue: 500,
  title: 200,
  message: 2000,
  reason: 500,
};

export const TIMES = {
  session: 24 * 3_600_000,
  loginToken: 15 * 60_000,
  code: 10 * 60_000,
  codeResend: 30_000,
  verified: 2 * 3_600_000,
  sealLease: 2 * 60_000,
};

export const EXPIRY_DAYS = [7, 14, 30, 60, 90];

// The first TSA that answers wins. All four chain to roots on the Adobe Approved
// Trust List, and RFC 3161 tokens authenticate themselves, so plain HTTP is normal.
const DEFAULT_TSAS = [
  'http://timestamp.digicert.com',
  'http://timestamp.sectigo.com',
  'http://timestamp.globalsign.com/tsa/r6advanced1',
  'http://timestamp.entrust.net/TSS/RFC3161sha2TS',
];

export function loadConfig(env = process.env) {
  const onCloudRun = Boolean(env.K_SERVICE);
  const store = env.SIGN_STORE || (onCloudRun ? 'gcp' : 'local');
  return {
    production: onCloudRun,
    store,
    baseUrl: (env.SIGN_BASE_URL || (onCloudRun ? 'https://solariavc.com' : 'http://localhost:5173')).replace(/\/+$/, ''),
    bucket: env.SIGN_BUCKET || 'gen-lang-client-0188652481-solaria-sign',
    dataDir: env.SIGN_DATA_DIR || new URL('../../.sign-data/', import.meta.url).pathname,
    from: env.SIGN_FROM_EMAIL || 'Solaria Capital <sign@solariavc.com>',
    resendKey: env.RESEND_API_KEY || '',
    tsaUrls: env.SIGN_TSA_URLS === undefined
      ? DEFAULT_TSAS
      : env.SIGN_TSA_URLS.split(',').map((s) => s.trim()).filter(Boolean),
  };
}
