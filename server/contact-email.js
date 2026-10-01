import { getCardProfile } from './card-profiles.js';

const CONTACT_TO = 'contact@solariavc.com';
// Digital-card exchanges go to the owner selected from the server allowlist.
function recipientFor(payload) {
  return payload.kind === 'card' ? getCardProfile(payload.cardId)?.email : CONTACT_TO;
}
const KIND_LABEL = {
  fund: 'Medallion Fund',
  ventures: 'Founder',
  founder: 'Founder',
  investor: 'Investor',
  research: 'Research',
  subscribe: 'Research · Subscribe',
  card: 'Digital card · New connection',
  other: 'General',
};

function esc(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderContactHtml(p) {
  const kindLabel = KIND_LABEL[p.kind] || KIND_LABEL.other;
  const card = p.kind === 'card' ? getCardProfile(p.cardId) : null;
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #04080a; color: #e5e7eb; padding: 28px 24px; max-width: 620px; margin: 0 auto;">
      <div style="border-left: 3px solid #10b981; padding-left: 12px; margin-bottom: 22px;">
        <div style="font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: #34d399;">Solaria Capital · ${p.kind === 'card' ? 'New connection' : 'New inquiry'}</div>
        <div style="font-size: 22px; font-weight: 600; margin-top: 6px;">${esc(kindLabel)}</div>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 6px 0; color: #9ca3af; width: 140px;">From</td><td style="padding: 6px 0;">${esc(p.name)} &lt;${esc(p.email)}&gt;</td></tr>
        ${p.phone ? `<tr><td style="padding: 6px 0; color: #9ca3af;">Phone</td><td style="padding: 6px 0;"><a href="tel:${esc(p.phone.replace(/[^+\d]/g, ''))}" style="color: #6ee7b7;">${esc(p.phone)}</a></td></tr>` : ''}
        ${p.organization ? `<tr><td style="padding: 6px 0; color: #9ca3af;">Organization</td><td style="padding: 6px 0;">${esc(p.organization)}</td></tr>` : ''}
        <tr><td style="padding: 6px 0; color: #9ca3af;">Inquiry</td><td style="padding: 6px 0;">${esc(kindLabel)}</td></tr>
        <tr><td style="padding: 6px 0; color: #9ca3af;">Submitted</td><td style="padding: 6px 0;">${p.submittedAt}</td></tr>
      </table>
      <div style="margin-top: 22px; padding-top: 18px; border-top: 1px solid #1f2937;">
        <div style="font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #9ca3af;">Message</div>
        <div style="margin-top: 10px; white-space: pre-wrap; line-height: 1.55;">${esc(p.message)}</div>
      </div>
      <div style="margin-top: 28px; font-size: 11px; color: #6b7280;">
        Sent from ${card ? `${esc(card.first)}'s digital card` : 'the Solaria Capital contact form'}. Reply directly to this email to respond to ${esc(p.name)}.
      </div>
    </div>
  `;
}

function renderContactText(p) {
  const kindLabel = KIND_LABEL[p.kind] || KIND_LABEL.other;
  const card = p.kind === 'card' ? getCardProfile(p.cardId) : null;
  return [
    `Solaria Capital — ${p.kind === 'card' ? 'new connection via digital card' : `new ${kindLabel} inquiry`}`,
    '',
    `From:         ${p.name} <${p.email}>`,
    p.phone ? `Phone:        ${p.phone}` : null,
    p.organization ? `Organization: ${p.organization}` : null,
    `Inquiry:      ${kindLabel}`,
    `Submitted:    ${p.submittedAt}`,
    '',
    '---',
    '',
    p.message,
    card ? `Sent from ${card.first}'s digital card (${card.page}).` : null,
  ]
    .filter(Boolean)
    .join('\n');
}


export function buildInquiryEmail(payload, from) {
  const to = recipientFor(payload);
  if (!to) throw new Error('card recipient is not configured');
  const kindLabel = KIND_LABEL[payload.kind] || KIND_LABEL.other;
  return { from, to: [to], reply_to: payload.email,
    subject: `[Solaria Capital · ${kindLabel}] ${payload.name}`,
    html: renderContactHtml(payload), text: renderContactText(payload) };
}

export function buildVerificationEmail(email, code, from) {
  return { from, to: [email], subject: 'Verify your Solaria contact request',
    text: `Your Solaria verification code is ${code}. It expires in 10 minutes. Enter it only in the form you just submitted on solariavc.com. Your message has not been sent to the team yet. If you did not request this code, ignore this email.`,
    html: `<p>Your Solaria verification code is:</p><p style="font-size:28px;letter-spacing:4px"><strong>${code}</strong></p><p>It expires in 10 minutes. Enter it only in the form you just submitted on solariavc.com.</p><p>Your message has not been sent to the team yet. If you did not request this code, ignore this email.</p>` };
}

export function createEmailSender({ apiKey, fetchImpl = fetch }) {
  return async (email, idempotencyKey) => {
    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(email),
    });
    // Do not log provider bodies: they may contain recipient details.
    if (!res.ok) throw new Error(`email provider status ${res.status}`);
    const result = await res.json();
    if (typeof result.id !== 'string' || !result.id) throw new Error('invalid email provider response');
  };
}
