import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { api, type EnvelopeSummary, type Recipient } from './api';
import { Link } from './router';

export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg className="mark" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <path d="M19.5 15.9A21 21 0 1 1 20.07 48.55" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M53.28 37.43A21 21 0 0 1 29.35 52.68" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="28.1" cy="31.9" r="15.5" fill="currentColor" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="wordmark">
      <Mark />
      <span className="wordmark-name">Solaria Sign</span>
    </span>
  );
}

export function Notice({ tone = 'error', children }: { tone?: 'error' | 'quiet'; children: ReactNode }) {
  return <p className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</p>;
}

// A sheet of paper laid over the desk. A real dialog, so focus stays inside it.
export function Sheet({ title, onClose, children }: { title: string; onClose?: () => void; children: ReactNode }) {
  const box = useRef<HTMLDialogElement>(null);
  // A layout effect, so it's open before anything inside measures itself.
  useLayoutEffect(() => {
    const dialog = box.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={box}
      className="sheet"
      aria-labelledby={id(title)}
      onCancel={(e) => {
        e.preventDefault();
        onClose?.();
      }}
    >
      <h2 id={id(title)}>{title}</h2>
      {children}
    </dialog>
  );
}

const id = (title: string) => `sheet-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`;

export function useBusy() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work. Try again.');
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run, setError };
}

const STATUS: Record<EnvelopeSummary['status'], string> = {
  draft: 'Draft',
  sent: 'Out for signature',
  completed: 'Completed',
  declined: 'Declined',
  voided: 'Voided',
  expired: 'Expired',
};

export function statusLabel(env: Pick<EnvelopeSummary, 'status' | 'sealing'>) {
  return env.sealing && env.status === 'sent' ? 'Sealing' : STATUS[env.status];
}

export function StatusText({ env }: { env: Pick<EnvelopeSummary, 'status' | 'sealing'> }) {
  return <span className={`status status-${env.status}`}>{statusLabel(env)}</span>;
}

// One dot per signer, filled once they have signed.
export function SignerDots({ recipients }: { recipients: Recipient[] }) {
  const signers = recipients.filter((r) => r.role === 'signer');
  const done = signers.filter((r) => r.status === 'signed').length;
  return (
    <span className="dots" role="img" aria-label={`${done} of ${signers.length} signed`}>
      {signers.map((r) => <i key={r.id} className={r.status === 'signed' ? 'dot dot-on' : 'dot'} title={r.name} />)}
    </span>
  );
}

export const formatDate = (iso?: string) => (iso
  ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  : '');

export const formatDateTime = (iso?: string) => (iso
  ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  : '');

export function Shell({ user, children }: { user: { name: string; owner: boolean }; children: ReactNode }) {
  const signOut = () => api.logout().finally(() => window.location.assign('/sign'));
  return (
    <div className="shell">
      <header className="bar">
        <Link to="/sign"><Wordmark /></Link>
        <span className="bar-end">
          <span className="bar-user">{user.name}</span>
          {user.owner && <Link to="/sign/team" className="quiet on-desk">Team</Link>}
          <button type="button" className="quiet on-desk" onClick={signOut}>Sign out</button>
        </span>
      </header>
      {children}
    </div>
  );
}

// When email sends again after the day's limit ran out, in the reader's own time.
// The limit resets at midnight UTC, which is mid-afternoon in California.
export function afterReset(resumes?: string | null) {
  if (!resumes) return 'once the limit resets';
  const at = new Date(resumes);
  const time = at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `after ${time} ${at.toDateString() === new Date().toDateString() ? 'today' : 'tomorrow'}`;
}

// Whole days until signing closes, for a document still waiting on someone.
export function closesIn(env: Pick<EnvelopeSummary, 'status' | 'sealing' | 'expiresAt'>) {
  if (env.status !== 'sent' || env.sealing || !env.expiresAt) return null;
  return Math.max(0, Math.ceil((Date.parse(env.expiresAt) - Date.now()) / 86_400_000));
}

export const closesLabel = (days: number) => (days <= 0 ? 'Closes today' : days === 1 ? 'Closes tomorrow' : `Closes in ${days} days`);

const MORE_DAYS = [7, 14, 30, 60, 90];

// Moves the signing deadline back on one document or many. `reopening` is when
// every one of them has already run out of time.
export function ExtendSheet({ ids, reopening, onClose, onDone }: {
  ids: string[];
  reopening: boolean;
  onClose: () => void;
  onDone: (extended: number) => Promise<unknown> | void;
}) {
  const [days, setDays] = useState(14);
  const { busy, error, run } = useBusy();
  const many = ids.length > 1;
  const title = reopening
    ? (many ? `Reopen ${ids.length} documents for signing?` : 'Reopen this document for signing?')
    : (many ? `Give more time on ${ids.length} documents?` : 'Give more time to sign?');
  return (
    <Sheet title={title} onClose={onClose}>
      <p>
        {reopening
          ? `Signing opens again for the time you choose, counted from today.`
          : `${many ? 'Each deadline' : 'The deadline'} moves back by the time you choose${many ? '; one that has already passed counts from today' : ''}.`}
        {' '}Signatures already given stay as they are.
      </p>
      <label className="field">
        {reopening ? 'Keep it open for' : 'Add'}
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
          {MORE_DAYS.map((d) => <option key={d} value={d}>{d} days</option>)}
        </select>
      </label>
      <p className="muted">Nobody is emailed about this. Send a reminder afterwards if you want signers to know.</p>
      {error && <Notice>{error}</Notice>}
      <div className="actions">
        <button
          type="button"
          className="primary"
          disabled={busy}
          onClick={() => run(async () => {
            const { extended } = await api.extendDocuments(ids, days);
            await onDone(extended);
          })}
        >
          {busy ? 'Saving' : reopening ? 'Reopen' : 'Give more time'}
        </button>
        <button type="button" className="quiet" onClick={onClose}>Cancel</button>
      </div>
    </Sheet>
  );
}

export function PageMessage({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="desk-center">
      <div className="note">
        <Wordmark />
        <h1>{title}</h1>
        {children}
      </div>
    </div>
  );
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return <div className="desk-center"><p className="loading" role="status">{label}</p></div>;
}
