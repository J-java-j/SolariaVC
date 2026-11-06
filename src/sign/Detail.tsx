import { useEffect, useState, type FormEvent } from 'react';
import { api, saveFile, signedFileName, type Envelope, type PageSize, type Recipient } from './api';
import { openPdf, pageSizes, type PdfDocument } from './pdf';
import { PdfPages } from './PdfPages';
import { Link, navigate } from './router';
import { Seal } from './Seal';
import { formatDate, formatDateTime, Loading, Notice, Sheet, StatusText, useBusy } from './ui';

const REFRESH_MS = 20_000;

function personStatus(r: Recipient) {
  switch (r.status) {
    case 'signed': return `Signed ${formatDateTime(r.signedAt)}`;
    case 'declined': return r.declineReason ? `Declined: ${r.declineReason}` : 'Declined';
    case 'viewed': return `Opened ${formatDateTime(r.viewedAt)}`;
    case 'waiting': return 'Waiting for their turn';
    case 'copy': return r.copySentAt ? `Copy sent ${formatDate(r.copySentAt)}` : 'Gets a copy when everyone has signed';
    default: return r.delivery === 'link' ? 'Link ready to share' : `Sent ${formatDateTime(r.sentAt)}`;
  }
}

function PersonLine({ env, person, onChanged }: { env: Envelope; person: Recipient; onChanged: () => void }) {
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState('');
  const { busy, error, run } = useBusy();
  const open = env.status === 'sent' && !env.sealing && person.role === 'signer' && person.status !== 'signed';
  const canRemind = open && person.status !== 'waiting' && person.delivery === 'email';

  const remind = () => run(async () => {
    await api.remind(env.id, person.id);
    setNotice('Reminder sent.');
    onChanged();
  });
  const newLink = () => run(async () => {
    setLink((await api.newLink(env.id, person.id)).url);
    setCopied(false);
    onChanged();
  });
  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
  };

  return (
    <li className="party">
      <div>
        <strong>{person.name}</strong>
        <span className="muted">{person.email}</span>
      </div>
      <p>{personStatus(person)}</p>
      {open && (
        <div className="party-actions">
          {canRemind && <button type="button" className="secondary" disabled={busy} onClick={remind}>Send a reminder</button>}
          <button type="button" className="quiet" disabled={busy} onClick={newLink}>Get a new link</button>
        </div>
      )}
      {link && (
        <div className="party-link">
          <input readOnly aria-label={`Signing link for ${person.name}`} value={link} onFocus={(e) => e.target.select()} />
          <button type="button" className="secondary" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
          <p className="muted">This replaces any earlier link. They confirm their email with a code before signing.</p>
        </div>
      )}
      {notice && <Notice tone="quiet">{notice}</Notice>}
      {error && <Notice>{error}</Notice>}
    </li>
  );
}

function VoidSheet({ env, onClose, onDone }: { env: Envelope; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const { busy, error, run } = useBusy();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api.voidEnvelope(env.id, reason);
      onDone();
    });
  };
  return (
    <Sheet title="Void this document?" onClose={onClose}>
      <p>Signing stops for everyone, and anyone already asked to sign is told why. This can't be undone.</p>
      <form onSubmit={submit} className="stack">
        <label className="field">
          Reason
          <textarea rows={2} required maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        {error && <Notice>{error}</Notice>}
        <div className="actions">
          <button className="danger" disabled={busy}>Void document</button>
          <button type="button" className="quiet" onClick={onClose}>Keep it out for signature</button>
        </div>
      </form>
    </Sheet>
  );
}

export default function Detail({ env, onChange }: { env: Envelope; onChange: (env: Envelope) => void }) {
  const [preview, setPreview] = useState<{ doc: PdfDocument; sizes: PageSize[] } | null>(null);
  const [voiding, setVoiding] = useState(false);
  const { busy, error, run } = useBusy();
  const sealedKey = env.sealed?.sha256;
  const refresh = () => api.get(env.id).then(onChange);

  useEffect(() => {
    let opened: PdfDocument | null = null;
    let cancelled = false;
    (sealedKey ? api.sealed(env.id) : api.original(env.id)).then(openPdf).then(async (pdf) => {
      opened = pdf;
      const sizes = await pageSizes(pdf);
      if (cancelled) pdf.destroy();
      else setPreview({ doc: pdf, sizes });
    }).catch(() => undefined);
    return () => {
      cancelled = true;
      opened?.destroy();
    };
  }, [env.id, sealedKey]);

  useEffect(() => {
    if (env.status !== 'sent') return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh().catch(() => undefined);
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [env.id, env.status]);

  const useAgain = () => run(async () => navigate(`/sign/e/${(await api.duplicate(env.id)).id}`));
  const finish = () => run(async () => onChange(await api.finish(env.id)));
  const retryTimestamp = () => run(async () => onChange(await api.timestamp(env.id)));
  const downloadSealed = () => run(async () => saveFile(await api.sealed(env.id), signedFileName(env.title)));
  const restore = () => run(async () => {
    await api.restoreDocuments([env.id]);
    await refresh();
  });
  const remove = () => run(async () => {
    await api.deleteDocuments([env.id]);
    await refresh();
  });
  const downloadOriginal = () => run(async () => saveFile(await api.original(env.id), env.document.fileName));

  const stamp = env.sealed?.timestamp;
  return (
    <div className="detail">
      <section className="detail-main">
        <Link to="/sign" className="link on-desk">All documents</Link>
        <div className="detail-sheet">
          {env.sealed && <Seal reference={env.reference} size={112} />}
          <h1>{env.title}</h1>
          <p className="detail-status">
            <StatusText env={env} />
            {env.status === 'sent' && env.expiresAt && <span className="muted">Signing closes {formatDate(env.expiresAt)}</span>}
            {env.completedAt && <span className="muted">{formatDateTime(env.completedAt)}</span>}
          </p>
          <p className="muted">Reference {env.reference}</p>
          {env.deletedAt && (
            <div className="toast">
              <span>This document is in the Deleted folder.</span>
              <button type="button" className="secondary" disabled={busy} onClick={restore}>Restore</button>
            </div>
          )}

          {env.sealError && (
            <div className="stack">
              <Notice>{env.sealError}</Notice>
              <button type="button" className="primary" disabled={busy} onClick={finish}>Try sealing again</button>
            </div>
          )}
          {env.sealing && !env.sealError && (
            <button type="button" className="secondary" disabled={busy} onClick={finish}>Finish sealing</button>
          )}
          {error && <Notice>{error}</Notice>}

          <div className="actions">
            {env.sealed && <button type="button" className="primary" disabled={busy} onClick={downloadSealed}>Download signed copy</button>}
            <button type="button" className="secondary" disabled={busy} onClick={downloadOriginal}>Download original</button>
            <button type="button" className="quiet" disabled={busy} onClick={useAgain}>Use again</button>
            {env.status === 'sent' && !env.sealing && <button type="button" className="quiet quiet-danger" onClick={() => setVoiding(true)}>Void</button>}
            {env.status !== 'sent' && !env.deletedAt && <button type="button" className="quiet quiet-danger" disabled={busy} onClick={remove}>Move to Deleted</button>}
          </div>

          <h2>People</h2>
          <ul className="parties">
            {env.recipients.map((person) => <PersonLine key={person.id} env={env} person={person} onChanged={() => refresh().catch(() => undefined)} />)}
          </ul>

          {env.sealed && (
            <>
              <h2>Proof</h2>
              {!stamp && (
                <div className="stack">
                  <Notice>No timestamp authority answered when this was sealed, so it has no trusted timestamp yet.</Notice>
                  <button type="button" className="secondary" disabled={busy} onClick={retryTimestamp}>Try the timestamp again</button>
                </div>
              )}
              <dl className="facts">
                {stamp && <dt>Timestamped</dt>}
                {stamp && <dd>{formatDateTime(stamp.genTime)} by {stamp.tsa}</dd>}
                <dt>Signed file SHA-256</dt>
                <dd className="hash">{env.sealed.sha256}</dd>
                <dt>Original file SHA-256</dt>
                <dd className="hash">{env.document.sha256}</dd>
              </dl>
            </>
          )}

          <details className="audit">
            <summary>Audit trail ({env.events.length} events)</summary>
            {env.chainValid
              ? <p className="muted">The hash chain is intact, so no event has been changed or removed.</p>
              : <Notice>The hash chain does not verify. Treat this audit trail as altered and contact your counsel.</Notice>}
            <ol>
              {env.events.map((event) => (
                <li key={event.seq}>
                  <time dateTime={event.at}>{formatDateTime(event.at)}</time>
                  <span>{event.label}</span>
                  <span className="muted">{[event.by, event.ip].filter(Boolean).join(', ')}</span>
                </li>
              ))}
            </ol>
          </details>
        </div>
      </section>

      <section className="detail-doc" aria-label="Document preview">
        {preview ? <PdfPages doc={preview.doc} sizes={preview.sizes} /> : <Loading label="Opening the document" />}
      </section>

      {voiding && <VoidSheet env={env} onClose={() => setVoiding(false)} onDone={() => {
        setVoiding(false);
        refresh().catch(() => undefined);
      }} />}
    </div>
  );
}
