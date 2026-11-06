// Transactional email through Resend. Without a key, a local run writes each
// message to .sign-data/outbox so links can be followed in development and tests;
// production refuses instead of pretending to have delivered anything.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { ORG } from './config.js';

const esc = (s = '') => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

function layout({ heading, paragraphs, button, note }) {
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#2b2f2e;">${p}</p>`).join('');
  const cta = button
    ? `<p style="margin:22px 0 24px;"><a href="${esc(button.url)}" style="display:inline-block;background:#2f5249;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 22px;border-radius:6px;">${esc(button.label)}</a></p>`
    : '';
  const small = note ? `<p style="margin:0;font-size:13px;line-height:1.5;color:#6b7270;">${note}</p>` : '';
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f4f3ef;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3ef;padding:32px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e4e3dc;border-radius:10px;">
<tr><td style="padding:30px 32px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#49796b;margin-bottom:18px;">${esc(ORG.name)}</div>
<h1 style="margin:0 0 16px;font-size:21px;line-height:1.3;font-weight:600;color:#17201e;">${heading}</h1>
${body}${cta}${small}
</td></tr></table>
<p style="max-width:560px;margin:14px auto 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#8a908d;">${esc(ORG.legalName)}, ${esc(ORG.location)}. Questions? ${esc(ORG.contactEmail)}</p>
</td></tr></table></body></html>`;
}

export function signRequestEmail({ env, rec, url, reminder }) {
  const senderName = env.sender.name;
  const codeNote = rec.requireCode ? ' You will be asked for a code we email to you.' : '';
  return {
    subject: `${reminder ? 'Reminder: ' : ''}${senderName} sent you "${env.title}" to sign`,
    replyTo: env.sender.email,
    html: layout({
      heading: `${esc(senderName)} sent you a document to sign`,
      paragraphs: [
        `<strong>${esc(env.title)}</strong>`,
        ...(env.message ? [esc(env.message).replace(/\n/g, '<br>')] : []),
      ],
      button: { url, label: 'Review and sign' },
      note: `This link is personal to you, so please don't forward it.${esc(codeNote)} It works until ${esc(new Date(env.expiresAt).toUTCString().slice(5, 16))}. You can ask for a paper version at any time. To see everything you've been sent in one place, go to ${esc(`${new URL(url).origin}/sign`)}.`,
    }),
    text: [
      `${senderName} sent you a document to sign: ${env.title}`,
      env.message || null,
      `Review and sign: ${url}`,
      `This link is personal to you, so please don't forward it.${codeNote}`,
      `Everything you've been sent, in one place: ${new URL(url).origin}/sign`,
    ].filter(Boolean).join('\n\n'),
  };
}

export function codeEmail({ env, code }) {
  return {
    subject: `${code} is your Solaria signing code`,
    replyTo: env.sender.email,
    html: layout({
      heading: 'Your signing code',
      paragraphs: [
        `<span style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:30px;letter-spacing:.18em;color:#17201e;">${esc(code)}</span>`,
        `Enter this code to open a document from ${esc(env.sender.name)}. It expires in 10 minutes.`,
      ],
      note: 'If you did not expect this, someone may have your link. Ignore this email and let the sender know.',
    }),
    text: `Your signing code is ${code}. It expires in 10 minutes.\n\nIf you did not expect this, ignore this email and let ${env.sender.name} know.`,
  };
}

export function loginEmail({ url, requestedAt = new Date() }) {
  const time = requestedAt
    .toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
    .replace(/\s+/g, ' ');
  return {
    // The time gives each request its own subject, so mail apps keep them apart.
    subject: `Sign in to Solaria Sign (${time})`,
    html: layout({
      heading: 'Sign in to Solaria Sign',
      paragraphs: ['Use this link to sign in. It works once, expires in 15 minutes, and stops working if you ask for a newer one.'],
      button: { url, label: 'Sign in' },
      note: 'If you did not ask for this, you can ignore it.',
    }),
    text: `Sign in to Solaria Sign: ${url}\n\nThis link works once, expires in 15 minutes, and stops working if you ask for a newer one.`,
  };
}

export function myDocumentsEmail({ url }) {
  return {
    subject: 'Your documents to sign',
    html: layout({
      heading: 'Everything you have been asked to sign',
      paragraphs: [`Use this link to see every document ${esc(ORG.name)} has sent you, and sign the ones waiting for you. It works once and expires in 15 minutes.`],
      button: { url, label: 'See my documents' },
      note: 'If you did not ask for this, you can ignore it.',
    }),
    text: `See every document ${ORG.name} has sent you: ${url}\n\nThis link works once and expires in 15 minutes.`,
  };
}

export function digestReminderEmail({ name, senders, titles, url }) {
  const from = senders.length === 1 ? senders[0].name : ORG.name;
  const count = `${titles.length} documents`;
  return {
    subject: `Reminder: ${count} waiting for your signature`,
    replyTo: senders.length === 1 ? senders[0].email : undefined,
    html: layout({
      heading: `${esc(from)} is waiting on ${esc(count)} from you`,
      paragraphs: [
        `Hi ${esc(name.split(/\s+/)[0] || name)}, these still need your signature:`,
        `<ul style="margin:0;padding-left:20px;">${titles.map((t) => `<li style="margin:0 0 4px;">${esc(t)}</li>`).join('')}</ul>`,
        'Open your documents page to review and sign each one.',
      ],
      button: { url, label: 'Review and sign' },
      note: "This link is personal to you, so please don't forward it. It works for 14 days. You can ask for a paper version at any time.",
    }),
    text: [
      `${from} is waiting on ${count} from you:`,
      titles.map((t) => `- ${t}`).join('\n'),
      `Review and sign: ${url}`,
      "This link is personal to you, so please don't forward it. It works for 14 days.",
    ].join('\n\n'),
  };
}

export function inviteEmail({ admin, inviter, url }) {
  const about = `${inviter} added you as an admin of Solaria Sign, ${ORG.name}'s document signing tool. You can send documents for signature and see everything the firm has sent.`;
  const howTo = `Sign in with ${admin.email}. We email you a link each time, so there is no password to set.`;
  return {
    subject: `${inviter} added you to Solaria Sign`,
    html: layout({
      heading: 'You can now send documents with Solaria Sign',
      paragraphs: [esc(about), esc(howTo)],
      button: { url, label: 'Open Solaria Sign' },
      note: `If you were not expecting this, let ${esc(ORG.contactEmail)} know.`,
    }),
    text: `${about}\n\n${howTo}\n\n${url}`,
  };
}

export function completedEmail({ env, url, sha256, attached, recipientIsSender }) {
  return {
    subject: `Completed: ${env.title}`,
    replyTo: env.sender.email,
    html: layout({
      heading: 'Everyone has signed',
      paragraphs: [
        `<strong>${esc(env.title)}</strong> is complete.`,
        attached
          ? 'Your signed copy is attached, with its certificate of completion. Please keep it for your records.'
          : 'Your signed copy is too large to attach. Download it and keep it for your records.',
      ],
      button: url ? { url, label: recipientIsSender ? 'Open in Solaria Sign' : 'Download signed copy' } : null,
      note: `SHA-256 of this file: <span style="font-family:ui-monospace,Menlo,Consolas,monospace;word-break:break-all;">${esc(sha256)}</span><br>Keep this email. You can check the file against it at any time at solariavc.com/sign/verify.`,
    }),
    text: [
      `${env.title} is complete. Please keep your signed copy for your records.`,
      url ? `Your copy: ${url}` : null,
      `SHA-256 of this file: ${sha256}`,
      'Check the file at any time at https://solariavc.com/sign/verify',
    ].filter(Boolean).join('\n\n'),
  };
}

export function declinedEmail({ env, rec, reason, paper }) {
  const action = paper ? 'asked for a paper version of' : 'declined to sign';
  return {
    subject: `${rec.name} ${action} "${env.title}"`,
    replyTo: rec.email,
    html: layout({
      heading: `${esc(rec.name)} ${action} this document`,
      paragraphs: [
        `<strong>${esc(env.title)}</strong>`,
        ...(reason ? [`Their note: ${esc(reason)}`] : []),
        paper ? 'Nobody else can sign it electronically now. Reply to arrange the paper process.' : 'Nobody else can sign it now.',
      ],
    }),
    text: `${rec.name} ${action} "${env.title}".\n\n${reason ? `Their note: ${reason}\n\n` : ''}Nobody else can sign it electronically now.`,
  };
}

export function voidedEmail({ env, reason }) {
  return {
    subject: `Cancelled: ${env.title}`,
    replyTo: env.sender.email,
    html: layout({
      heading: 'This signing request was cancelled',
      paragraphs: [
        `${esc(env.sender.name)} cancelled <strong>${esc(env.title)}</strong>, so its signing link no longer works.`,
        ...(reason ? [`Reason: ${esc(reason)}`] : []),
      ],
    }),
    text: `${env.sender.name} cancelled "${env.title}", so its signing link no longer works.${reason ? `\n\nReason: ${reason}` : ''}`,
  };
}

export function nextSignerEmail({ env, rec, url }) {
  return {
    subject: `${rec.name} can now sign "${env.title}"`,
    html: layout({
      heading: `It is ${esc(rec.name)}'s turn to sign`,
      paragraphs: [
        `<strong>${esc(env.title)}</strong> is ready for them. You chose to share their link yourself, so please send it now.`,
      ],
      button: { url, label: 'Open document' },
    }),
    text: `It is ${rec.name}'s turn to sign "${env.title}". You chose to share their link yourself: ${url}`,
  };
}

export function createMailer(config) {
  return async function send({ to, subject, html, text, replyTo, attachments }) {
    if (!config.resendKey) {
      if (config.production) throw new Error('RESEND_API_KEY is not set');
      const dir = path.join(config.dataDir, 'outbox');
      mkdirSync(dir, { recursive: true });
      const id = `${Date.now()}-${randomBytes(3).toString('hex')}`;
      writeFileSync(path.join(dir, `${id}.json`), JSON.stringify({
        to, subject, text, replyTo, attachments: (attachments ?? []).map((a) => a.filename),
      }, null, 2));
      return id;
    }
    const post = () => fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.from,
        to: [to],
        subject,
        html,
        text,
        // A value no other message has keeps Gmail from folding repeats into one thread.
        headers: { 'X-Entity-Ref-ID': randomBytes(16).toString('hex') },
        ...(replyTo ? { reply_to: replyTo } : {}),
        ...(attachments?.length ? { attachments } : {}),
      }),
      signal: AbortSignal.timeout(30_000),
    });
    // A burst can meet Resend's rate limit; waiting and trying again is all it asks.
    for (let attempt = 1; ; attempt++) {
      const res = await post();
      if (res.status === 429 && attempt < 4) {
        const wait = Number(res.headers.get('retry-after')) || attempt;
        await new Promise((done) => setTimeout(done, Math.min(wait, 5) * 1000));
        continue;
      }
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`resend http ${res.status}: ${body.slice(0, 200)}`);
      }
      return (await res.json().catch(() => ({}))).id ?? null;
    }
  };
}
