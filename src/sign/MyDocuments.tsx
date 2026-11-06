import { useCallback, useEffect, useState } from 'react';
import { ApiError } from './api';
import { Login } from './Login';
import { formatDate, Loading, Notice, PageMessage, useBusy, Wordmark } from './ui';

// The page anyone we've sent a document to can use to find all of theirs.
type Doc = {
  id: string;
  title: string;
  from: string;
  sentAt?: string;
  expiresAt?: string;
  completedAt: string | null;
  state: 'sign' | 'waiting' | 'signed' | 'sealing' | 'completed' | 'declined' | 'voided' | 'expired' | 'unavailable';
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/sign/my${path}`, { credentials: 'same-origin', ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? 'Something went wrong. Please try again.', res.status);
  return body as T;
}
const post = (path: string, body: unknown = {}) => call(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const GROUPS: [string, (d: Doc) => boolean][] = [
  ['Waiting for your signature', (d) => d.state === 'sign'],
  ['Waiting for someone to sign first', (d) => d.state === 'waiting'],
  ['Signed by you, waiting on others', (d) => d.state === 'signed' || d.state === 'sealing'],
  ['Completed', (d) => d.state === 'completed'],
  ['Closed', (d) => d.state === 'declined' || d.state === 'voided' || d.state === 'expired' || d.state === 'unavailable'],
];

const CLOSED_LABEL: Partial<Record<Doc['state'], string>> = { declined: 'Declined', voided: 'Cancelled by the sender', expired: 'Signing closed', unavailable: 'Not available' };

export default function MyDocuments() {
  const [token] = useState(() => window.location.hash.slice(1));
  const [data, setData] = useState<{ email: string; documents: Doc[] } | null | undefined>(undefined);
  const [opening, setOpening] = useState('');
  const { busy, error, run } = useBusy();

  const load = useCallback(() => call<{ email: string; documents: Doc[] }>('').then(setData).catch((e: ApiError) => {
    if (e.status === 401) setData(null);
    else throw e;
  }), []);

  useEffect(() => {
    if (!token) load();
  }, [token, load]);

  // A link opened in the tab already showing this page only changes the hash.
  useEffect(() => {
    const reopen = () => {
      if (window.location.hash.length > 1) window.location.reload();
    };
    window.addEventListener('hashchange', reopen);
    return () => window.removeEventListener('hashchange', reopen);
  }, []);

  // A button rather than opening at once, because mail scanners follow links.
  if (token && data === undefined) {
    return (
      <PageMessage title="Your documents">
        {error ? <Notice>{error}</Notice> : <p>Continue to see your documents on this device.</p>}
        {error
          ? <a className="primary" href="/sign">Get a new link</a>
          : <button type="button" className="primary" disabled={busy} onClick={() => run(async () => {
            await post('/open', { token });
            window.history.replaceState(null, '', '/sign');
            await load();
          })}>{busy ? 'Opening' : 'Continue'}</button>}
      </PageMessage>
    );
  }
  if (data === undefined) return <Loading />;
  if (data === null) return <Login />;

  const open = (doc: Doc) => run(async () => {
    setOpening(doc.id);
    const { url } = await post(`/${doc.id}/open`) as { url: string };
    window.location.assign(url);
  });
  const waiting = data.documents.filter((d) => d.state === 'sign');

  return (
    <div className="shell">
      <header className="bar">
        <Wordmark />
        <span className="bar-end">
          <span className="bar-user">{data.email}</span>
          <button type="button" className="quiet on-desk" onClick={() => post('/logout').finally(() => window.location.assign('/sign'))}>Sign out</button>
        </span>
      </header>
      <main className="ledger-page">
        <div className="ledger">
          <header className="ledger-head">
            <h1>Your documents</h1>
          </header>
          {waiting.length > 0
            ? <div className="mine"><strong>{waiting.length === 1 ? '1 document needs' : `${waiting.length} documents need`} your signature.</strong></div>
            : data.documents.length > 0 && <div className="mine mine-done"><strong>You're all caught up.</strong> Nothing is waiting for your signature.</div>}
          {error && <Notice>{error}</Notice>}
          {!data.documents.length && <p className="ledger-empty">There are no documents for {data.email}.</p>}
          {GROUPS.map(([title, match]) => {
            const docs = data.documents.filter(match);
            if (!docs.length) return null;
            return (
              <section key={title}>
                <h2>{title} ({docs.length})</h2>
                <ul>
                  {docs.map((doc) => (
                    <li key={doc.id} className="my-row">
                      <span className="my-main">
                        <span className="row-title">{doc.title || 'Untitled document'}</span>
                        <span className="row-people">
                          From {doc.from}
                          {doc.state === 'completed' && doc.completedAt ? ` · completed ${formatDate(doc.completedAt)}` : ''}
                          {(doc.state === 'sign' || doc.state === 'waiting') && doc.expiresAt ? ` · sign by ${formatDate(doc.expiresAt)}` : ''}
                          {CLOSED_LABEL[doc.state] ? ` · ${CLOSED_LABEL[doc.state]}` : ''}
                        </span>
                      </span>
                      {doc.state === 'sign' && (
                        <button type="button" className="primary" disabled={busy} onClick={() => open(doc)}>{opening === doc.id ? 'Opening' : 'Review and sign'}</button>
                      )}
                      {(doc.state === 'completed' || doc.state === 'signed' || doc.state === 'sealing') && (
                        <button type="button" className="secondary" disabled={busy} onClick={() => open(doc)}>{opening === doc.id ? 'Opening' : doc.state === 'completed' ? 'Get signed copy' : 'View'}</button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
