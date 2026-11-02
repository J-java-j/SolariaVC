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

export function Shell({ user, children }: { user: { name: string }; children: ReactNode }) {
  const signOut = () => api.logout().finally(() => window.location.assign('/sign'));
  return (
    <div className="shell">
      <header className="bar">
        <Link to="/sign"><Wordmark /></Link>
        <span className="bar-end">
          <span className="bar-user">{user.name}</span>
          <button type="button" className="quiet on-desk" onClick={signOut}>Sign out</button>
        </span>
      </header>
      {children}
    </div>
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
