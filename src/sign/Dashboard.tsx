import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent, type ReactNode } from 'react';
import { api, type EnvelopeSummary, type Folder } from './api';
import { Link, navigate } from './router';
import { formatDate, Notice, Sheet, SignerDots, statusLabel, useBusy } from './ui';

const MAX_UPLOAD = 20 * 1024 * 1024;
const LIST_LIMIT = 200;
const ALL = 'all';
const DELETED = 'deleted';
const NO_FOLDER = 'none';
const VIEW_KEY = 'solaria-sign-view';

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
  if (env.deletedAt) return `Deleted ${formatDate(env.deletedAt)}`;
  if (env.status === 'draft') return `Created ${formatDate(env.createdAt)}`;
  if (env.status === 'completed') return `Completed ${formatDate(env.completedAt)}`;
  if (env.status === 'sent' && !env.sealing) return `Sent ${formatDate(env.sentAt)}`;
  return statusLabel(env);
}

// Keeps the open folder when someone opens a document and comes back. Only a
// convenience, so it falls back quietly where storage is blocked.
function savedView() {
  try {
    return window.sessionStorage.getItem(VIEW_KEY) ?? ALL;
  } catch {
    return ALL;
  }
}

function saveView(view: string) {
  try {
    window.sessionStorage.setItem(VIEW_KEY, view);
  } catch { /* the view just resets next time */ }
}

function FolderSheet({ title, action, initial = '', onClose, onSave }: {
  title: string;
  action: string;
  initial?: string;
  onClose: () => void;
  onSave: (name: string) => Promise<unknown>;
}) {
  const [name, setName] = useState(initial);
  const { busy, error, run } = useBusy();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(() => onSave(name));
  };
  return (
    <Sheet title={title} onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <label className="field">
          Folder name
          <input required maxLength={60} autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        {error && <Notice>{error}</Notice>}
        <div className="actions">
          <button className="primary" disabled={busy}>{action}</button>
          <button type="button" className="quiet" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Sheet>
  );
}

function ConfirmSheet({ title, action, keep, onClose, onConfirm, children }: {
  title: string;
  action: string;
  keep: string;
  onClose: () => void;
  onConfirm: () => Promise<unknown>;
  children: ReactNode;
}) {
  const { busy, error, run } = useBusy();
  return (
    <Sheet title={title} onClose={onClose}>
      {children}
      {error && <Notice>{error}</Notice>}
      <div className="actions">
        <button type="button" className="danger" disabled={busy} onClick={() => run(onConfirm)}>{action}</button>
        <button type="button" className="quiet" onClick={onClose}>{keep}</button>
      </div>
    </Sheet>
  );
}

function EraseSheet({ count, onClose, onConfirm }: { count: number; onClose: () => void; onConfirm: () => Promise<unknown> }) {
  const [typed, setTyped] = useState('');
  const { busy, error, run } = useBusy();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(onConfirm);
  };
  return (
    <Sheet title={`Permanently delete ${count === 1 ? 'this document' : `${count} documents`}?`} onClose={onClose}>
      <p>This erases the file, its certificate and its audit trail from Solaria Sign, and it can't be undone. Signing links stop working, and the file can no longer be checked at solariavc.com/sign/verify.</p>
      <p>Copies people already received stay with them. Download anything you need to keep first.</p>
      <form onSubmit={submit} className="stack">
        <label className="field">
          Type DELETE to confirm
          <input autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
        </label>
        {error && <Notice>{error}</Notice>}
        <div className="actions">
          <button className="danger" disabled={busy || typed !== 'DELETE'}>Delete forever</button>
          <button type="button" className="quiet" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Sheet>
  );
}

export default function Dashboard({ user }: { user: { owner: boolean } }) {
  const [envelopes, setEnvelopes] = useState<EnvelopeSummary[] | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [view, setView] = useState(savedView);
  const [sentBy, setSentBy] = useState('');
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [sheet, setSheet] = useState<'new' | 'rename' | 'delete-folder' | 'delete' | 'erase' | null>(null);
  const [over, setOver] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const { busy, error, run, setError } = useBusy();

  const load = useCallback(async () => {
    const [list, saved] = await Promise.all([api.list(), api.folders()]);
    setEnvelopes(list.envelopes);
    setFolders(saved.folders);
  }, []);

  useEffect(() => {
    load().catch((e: Error) => setError(e.message));
  }, [load, setError]);

  const folder = folders.find((f) => f.id === view);
  const inDeleted = view === DELETED;
  const current = inDeleted ? DELETED : folder?.id ?? ALL;
  const live = (envelopes ?? []).filter((env) => !env.deletedAt);
  const deleted = (envelopes ?? []).filter((env) => env.deletedAt);
  const inFolder = (id: string) => live.filter((env) => env.folderId === id);
  const inView = inDeleted ? deleted : folder ? inFolder(folder.id) : live;
  const senders = new Map((envelopes ?? []).map((env) => [env.sender.email, env.sender.name] as const));
  const shown = inView.filter((env) => !sentBy || env.sender.email === sentBy);
  const selected = shown.filter((env) => picked.has(env.id));
  const stillOut = selected.some((env) => env.status === 'sent');

  const open = (next: string) => {
    setView(next);
    saveView(next);
    setPicked(new Set());
  };

  const toggle = (id: string) => {
    const next = new Set(picked);
    if (!next.delete(id)) next.add(id);
    setPicked(next);
  };

  // Clears what was selected and reloads, so the lists and counts match the server.
  const finish = async () => {
    setSheet(null);
    setPicked(new Set());
    await load();
  };

  const ids = selected.map((env) => env.id);
  const move = (e: ChangeEvent<HTMLSelectElement>) => {
    const target = e.target.value;
    run(async () => {
      await api.moveDocuments(ids, target === NO_FOLDER ? null : target);
      await finish();
    });
  };
  const restore = () => run(async () => {
    await api.restoreDocuments(ids);
    await finish();
  });

  const upload = (file?: File) => {
    if (!file) return;
    if (file.size > MAX_UPLOAD) {
      setError('That file is over 20 MB. Save a smaller copy and upload it again.');
      return;
    }
    run(async () => navigate(`/sign/e/${(await api.upload(file, folder?.id)).id}`));
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

  const tab = (id: string, label: string, count: number) => (
    <button key={id} type="button" aria-current={current === id ? 'true' : undefined} onClick={() => open(id)}>
      {label} ({count})
    </button>
  );

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
            {busy ? 'Working' : 'Upload a PDF'}
          </button>
          <input ref={picker} type="file" accept="application/pdf,.pdf" hidden onChange={pick} />
        </header>
        {error && <Notice>{error}</Notice>}
        {empty && <p className="ledger-empty">Upload a PDF to prepare it for signature, or drop one anywhere on this page.</p>}

        {envelopes && !empty && (
          <nav className="folders" aria-label="Folders">
            {tab(ALL, 'All documents', live.length)}
            {folders.map((f) => tab(f.id, f.name, inFolder(f.id).length))}
            {(deleted.length > 0 || inDeleted) && tab(DELETED, 'Deleted', deleted.length)}
            <button type="button" className="quiet" onClick={() => setSheet('new')}>New folder</button>
          </nav>
        )}
        {folder && (
          <div className="folder-tools">
            <button type="button" className="quiet" onClick={() => setSheet('rename')}>Rename folder</button>
            <button type="button" className="quiet quiet-danger" onClick={() => setSheet('delete-folder')}>Delete folder</button>
          </div>
        )}
        {inDeleted && <p className="muted">Documents here stay on record and can be restored. Signers keep their copies and links.</p>}

        {senders.size > 1 && (
          <label className="field ledger-filter">
            Sent by
            <select
              value={sentBy}
              onChange={(e) => {
                setSentBy(e.target.value);
                setPicked(new Set());
              }}
            >
              <option value="">Everyone</option>
              {[...senders].map(([email, name]) => <option key={email} value={email}>{name}</option>)}
            </select>
          </label>
        )}

        {selected.length > 0 && (
          <div className="picked">
            <strong>{selected.length} selected</strong>
            {inDeleted
              ? (
                <>
                  <button type="button" className="secondary" disabled={busy} onClick={restore}>Restore</button>
                  {user.owner && <button type="button" className="quiet quiet-danger" disabled={busy} onClick={() => setSheet('erase')}>Delete forever</button>}
                </>
              )
              : (
                <>
                  <select aria-label="Move to a folder" value="" disabled={busy} onChange={move}>
                    <option value="" disabled>Move to a folder</option>
                    {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                    <option value={NO_FOLDER}>No folder</option>
                  </select>
                  <button type="button" className="quiet quiet-danger" disabled={busy || stillOut} onClick={() => setSheet('delete')}>Delete</button>
                </>
              )}
            <button type="button" className="quiet" onClick={() => setPicked(new Set())}>Clear</button>
          </div>
        )}
        {stillOut && !inDeleted && <p className="muted">To delete a document that is out for signature, open it and void it first.</p>}

        {envelopes && !empty && !shown.length && (
          <p className="ledger-empty">
            {folder ? 'This folder is empty. Select documents in All documents and move them here, or upload a PDF while this folder is open.' : 'Nothing here.'}
          </p>
        )}
        {GROUPS.map(([title, match]) => {
          const rows = shown.filter(match);
          if (!rows.length) return null;
          return (
            <section key={title}>
              <h2>{title} ({rows.length})</h2>
              <ul>
                {rows.map((env) => (
                  <li key={env.id} className="row-item">
                    <label className="pick">
                      <input
                        type="checkbox"
                        aria-label={`Select ${env.title || 'Untitled document'}`}
                        checked={picked.has(env.id)}
                        onChange={() => toggle(env.id)}
                      />
                    </label>
                    <Link to={`/sign/e/${env.id}`} className="row">
                      <span className="row-title">{env.title || 'Untitled document'}</span>
                      <span className="row-people">{people(env)}</span>
                      <SignerDots recipients={env.recipients} />
                      <span className="row-when">{when(env)}{senders.size > 1 && ` by ${env.sender.name}`}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        {envelopes && envelopes.length >= LIST_LIMIT && <p className="muted">Showing the {LIST_LIMIT} most recent documents.</p>}
      </div>

      {sheet === 'new' && (
        <FolderSheet
          title="New folder"
          action="Create folder"
          onClose={() => setSheet(null)}
          onSave={async (name) => {
            const created = await api.createFolder(name);
            await finish();
            open(created.id);
          }}
        />
      )}
      {sheet === 'rename' && folder && (
        <FolderSheet
          title="Rename folder"
          action="Save name"
          initial={folder.name}
          onClose={() => setSheet(null)}
          onSave={async (name) => {
            await api.renameFolder(folder.id, name);
            await finish();
          }}
        />
      )}
      {sheet === 'delete-folder' && folder && (
        <ConfirmSheet
          title={`Delete ${folder.name}?`}
          action="Delete folder"
          keep="Keep it"
          onClose={() => setSheet(null)}
          onConfirm={async () => {
            await api.deleteFolder(folder.id);
            await finish();
            open(ALL);
          }}
        >
          <p>Only the folder goes. The documents in it stay in All documents.</p>
        </ConfirmSheet>
      )}
      {sheet === 'delete' && (
        <ConfirmSheet
          title={`Delete ${selected.length === 1 ? 'this document' : `${selected.length} documents`}?`}
          action="Delete"
          keep="Keep them"
          onClose={() => setSheet(null)}
          onConfirm={async () => {
            await api.deleteDocuments(ids);
            await finish();
          }}
        >
          <p>Drafts are erased for good. Anything else moves to Deleted, where you can restore it. Signers keep their copies either way.</p>
        </ConfirmSheet>
      )}
      {sheet === 'erase' && (
        <EraseSheet
          count={selected.length}
          onClose={() => setSheet(null)}
          onConfirm={async () => {
            await api.eraseDocuments(ids);
            await finish();
          }}
        />
      )}
    </main>
  );
}
