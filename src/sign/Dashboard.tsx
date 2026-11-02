import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { api, type EnvelopeSummary } from './api';
import { Link, navigate } from './router';
import { formatDate, Notice, SignerDots, statusLabel, useBusy } from './ui';

const MAX_UPLOAD = 20 * 1024 * 1024;

const GROUPS: [string, (e: EnvelopeSummary) => boolean][] = [
  ['Drafts', (e) => e.status === 'draft'],
  ['Out for signature', (e) => e.status === 'sent'],
  ['Completed', (e) => e.status === 'completed'],
  ['Closed', (e) => e.status === 'declined' || e.status === 'voided' || e.status === 'expired'],
];

function people(env: EnvelopeSummary) {
  const names = env.recipients.filter((r) => r.role === 'signer').map((r) => r.name).filter(Boolean);
  if (!names.length) return 'No signers yet';
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} and ${names.length - 2} more` : names.join(' and ');
}

function when(env: EnvelopeSummary) {
  if (env.status === 'draft') return `Created ${formatDate(env.createdAt)}`;
  if (env.status === 'completed') return `Completed ${formatDate(env.completedAt)}`;
  if (env.status === 'sent' && !env.sealing) return `Sent ${formatDate(env.sentAt)}`;
  return statusLabel(env);
}

export default function Dashboard() {
  const [envelopes, setEnvelopes] = useState<EnvelopeSummary[] | null>(null);
  const [over, setOver] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const { busy, error, run, setError } = useBusy();

  useEffect(() => {
    api.list().then((r) => setEnvelopes(r.envelopes)).catch((e: Error) => setError(e.message));
  }, [setError]);

  const upload = (file?: File) => {
    if (!file) return;
    if (file.size > MAX_UPLOAD) {
      setError('That file is over 20 MB. Save a smaller copy and upload it again.');
      return;
    }
    run(async () => navigate(`/sign/e/${(await api.upload(file)).id}`));
  };

  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    upload(e.dataTransfer.files[0]);
  };

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    upload(e.target.files?.[0]);
    e.target.value = '';
  };

  const empty = envelopes?.length === 0;
  return (
    <main
      className={over ? 'ledger-page ledger-over' : 'ledger-page'}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false);
      }}
      onDrop={drop}
    >
      <div className="ledger">
        <header className="ledger-head">
          <h1>Documents</h1>
          <button type="button" className="primary" disabled={busy} onClick={() => picker.current?.click()}>
            {busy ? 'Uploading' : 'Upload a PDF'}
          </button>
          <input ref={picker} type="file" accept="application/pdf,.pdf" hidden onChange={pick} />
        </header>
        {error && <Notice>{error}</Notice>}
        {empty && <p className="ledger-empty">Upload a PDF to prepare it for signature, or drop one anywhere on this page.</p>}
        {envelopes && GROUPS.map(([title, match]) => {
          const rows = envelopes.filter(match);
          if (!rows.length) return null;
          return (
            <section key={title}>
              <h2>{title}</h2>
              <ul>
                {rows.map((env) => (
                  <li key={env.id}>
                    <Link to={`/sign/e/${env.id}`} className="row">
                      <span className="row-title">{env.title || 'Untitled document'}</span>
                      <span className="row-people">{people(env)}</span>
                      <SignerDots recipients={env.recipients} />
                      <span className="row-when">{when(env)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}
