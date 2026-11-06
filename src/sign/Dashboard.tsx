import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent, type ReactNode } from 'react';
import { api, type EnvelopeSummary, type Folder } from './api';
import { Link, navigate } from './router';
import { formatDate, Notice, Sheet, SignerDots, statusLabel, useBusy } from './ui';

const MAX_UPLOAD = 20 * 1024 * 1024;
const LIST_LIMIT = 500;
const ALL = 'all';
const DELETED = 'deleted';
const NO_FOLDER = 'none';
const VIEW_KEY = 'solaria-sign-view';

type Status = EnvelopeSummary['status'];

const GROUPS: [string, (status: Status) => boolean][] = [
  ['Drafts', (s) => s === 'draft'],
  ['Out for signature', (s) => s === 'sent'],
  ['Completed', (s) => s === 'completed'],
  ['Closed', (s) => s === 'declined' || s === 'voided' || s === 'expired'],
];

// A bulk send is one row, filed where its liveliest copy belongs: out for
// signature while anyone still has to sign, then completed, then closed.
type Item =
  | { kind: 'one'; env: EnvelopeSummary; status: Status }
  | { kind: 'batch'; id: string; envs: EnvelopeSummary[]; status: Status };

function itemsOf(envs: EnvelopeSummary[]): Item[] {
  const items: Item[] = [];
  const batches = new Map<string, Extract<Item, { kind: 'batch' }>>();
  for (const env of envs) {
    if (!env.batch) {
      items.push({ kind: 'one', env, status: env.status });
      continue;
    }
    let batch = batches.get(env.batch.id);
    if (!batch) {
      batch = { kind: 'batch', id: env.batch.id, envs: [], status: env.status };
      batches.set(env.batch.id, batch);
      items.push(batch);
    }
    batch.envs.push(env);
  }
  for (const batch of batches.values()) {
    const has = (status: Status) => batch.envs.some((e) => e.status === status);
    batch.status = batch.envs.length === 1 ? batch.envs[0].status : has('sent') ? 'sent' : has('completed') ? 'completed' : 'voided';
  }
  // A batch of one is just a document.
  return items.map((item) => (item.kind === 'batch' && item.envs.length === 1 ? { kind: 'one', env: item.envs[0], status: item.status } : item));
}

// The person a copy was sent to is the signer who differs from copy to copy.
function byPerson(envs: EnvelopeSummary[]): [EnvelopeSummary, string][] {
  const signers = (env: EnvelopeSummary) => env.recipients.filter((r) => r.role === 'signer');
  const shared = new Set(signers(envs[0]).map((r) => r.email).filter((email) => envs.every((env) => signers(env).some((r) => r.email === email))));
  return envs
    .map((env): [EnvelopeSummary, string] => [env, (signers(env).find((r) => !shared.has(r.email)) ?? signers(env)[0])?.name ?? ''])
    .sort((a, b) => a[1].localeCompare(b[1], undefined, { numeric: true }));
}

function batchSummary(envs: EnvelopeSummary[]) {
  const count = (status: Status) => envs.filter((e) => e.status === status).length;
  const parts = [`${count('completed')} of ${envs.length} complete`];
  for (const [status, label] of [['declined', 'declined'], ['voided', 'voided'], ['expired', 'expired']] as const) {
    if (count(status)) parts.push(`${count(status)} ${label}`);
  }
  return parts.join(' · ');
}

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

function ConfirmSheet({ title, action, keep, tone = 'danger', onClose, onConfirm, children }: {
  title: string;
  action: string;
  keep: string;
  tone?: 'danger' | 'primary';
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
        <button type="button" className={tone} disabled={busy} onClick={() => run(onConfirm)}>{busy && tone === 'primary' ? 'Sending' : action}</button>
        <button type="button" className="quiet" onClick={onClose}>{keep}</button>
      </div>
    </Sheet>
  );
}

function VoidSheet({ count, skipped, onClose, onConfirm }: { count: number; skipped: number; onClose: () => void; onConfirm: (reason: string) => Promise<unknown> }) {
  const [reason, setReason] = useState('');
  const { busy, error, run } = useBusy();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(() => onConfirm(reason));
  };
  return (
    <Sheet title={`Void ${count === 1 ? 'this document' : `${count} documents`}?`} onClose={onClose}>
      <p>Signing stops for everyone on {count === 1 ? 'it' : 'them'}, and anyone already asked to sign is emailed the reason. This can't be undone.</p>
      {skipped > 0 && <p className="muted">{skipped} other selected {skipped === 1 ? 'document isn\'t' : 'documents aren\'t'} out for signature and will be left as {skipped === 1 ? 'it is' : 'they are'}.</p>}
      <form onSubmit={submit} className="stack">
        <label className="field">
          Reason, sent to signers
          <textarea rows={2} required maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        {error && <Notice>{error}</Notice>}
        <div className="actions">
          <button className="danger" disabled={busy}>{busy ? 'Voiding' : count === 1 ? 'Void document' : `Void ${count} documents`}</button>
          <button type="button" className="quiet" onClick={onClose}>Keep them out for signature</button>
        </div>
      </form>
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

function PickBox({ label, rows, picked, onChange }: { label: string; rows: EnvelopeSummary[]; picked: ReadonlySet<string>; onChange: () => void }) {
  const all = rows.every((env) => picked.has(env.id));
  const some = rows.some((env) => picked.has(env.id));
  return (
    <label className="pick">
      <input
        type="checkbox"
        aria-label={label}
        checked={all}
        ref={(box) => {
          if (box) box.indeterminate = some && !all;
        }}
        onChange={onChange}
      />
    </label>
  );
}

// Inside a batch the title is the same on every row, so the person leads instead.
function DocRow({ env, picked, showSender, onToggle, person }: {
  env: EnvelopeSummary;
  picked: ReadonlySet<string>;
  showSender: boolean;
  onToggle: () => void;
  person?: string;
}) {
  const title = env.title || 'Untitled document';
  return (
    <li className="row-item">
      <label className="pick">
        <input type="checkbox" aria-label={`Select ${person ? `${person}'s copy` : title}`} checked={picked.has(env.id)} onChange={onToggle} />
      </label>
      <Link to={`/sign/e/${env.id}`} className="row">
        <span className="row-title">{person ?? title}</span>
        <span className="row-people">{person ? env.recipients.find((r) => r.name === person)?.email : people(env)}</span>
        <SignerDots recipients={env.recipients} />
        <span className="row-when">{when(env)}{showSender && ` by ${env.sender.name}`}</span>
      </Link>
    </li>
  );
}

export default function Dashboard({ user }: { user: { owner: boolean; email: string } }) {
  const [envelopes, setEnvelopes] = useState<EnvelopeSummary[] | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [view, setView] = useState(savedView);
  const [sentBy, setSentBy] = useState('');
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [sheet, setSheet] = useState<'new' | 'rename' | 'delete-folder' | 'delete' | 'erase' | 'void' | 'remind' | null>(null);
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
  const voidable = selected.filter((env) => env.status === 'sent' && !env.sealing);
  // Who a reminder would reach: emailed signers whose turn it is, other than you.
  const due = voidable.flatMap((env) => env.recipients.filter((r) => r.role === 'signer' && r.delivery === 'email' && r.email !== user.email && r.status !== 'signed' && r.status !== 'waiting'));
  const [notice, setNotice] = useState('');

  const open = (next: string) => {
    setView(next);
    saveView(next);
    setPicked(new Set());
  };

  // Ticks every row given, or clears them if they are all ticked already.
  const toggleAll = (rows: EnvelopeSummary[]) => {
    const next = new Set(picked);
    const all = rows.every((env) => next.has(env.id));
    for (const env of rows) {
      if (all) next.delete(env.id);
      else next.add(env.id);
    }
    setPicked(next);
  };
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());
  const flip = (id: string) => {
    const next = new Set(opened);
    if (!next.delete(id)) next.add(id);
    setOpened(next);
  };
  const allPicked = shown.length > 0 && shown.every((env) => picked.has(env.id));

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
        {notice && <Notice tone="quiet">{notice}</Notice>}
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
                  {due.length > 0 && <button type="button" className="secondary" disabled={busy} onClick={() => setSheet('remind')}>Remind{due.length > 1 ? ` ${due.length}` : ''}</button>}
                  {voidable.length > 0 && <button type="button" className="quiet quiet-danger" disabled={busy} onClick={() => setSheet('void')}>Void{voidable.length > 1 ? ` ${voidable.length}` : ''}</button>}
                  <button type="button" className="quiet quiet-danger" disabled={busy || stillOut} onClick={() => setSheet('delete')}>Delete</button>
                </>
              )}
            {!allPicked && <button type="button" className="quiet" onClick={() => toggleAll(shown)}>Select all {shown.length}</button>}
            <button type="button" className="quiet" onClick={() => setPicked(new Set())}>Clear</button>
          </div>
        )}
        {selected.length === 0 && shown.length > 1 && (
          <button type="button" className="quiet select-all" onClick={() => toggleAll(shown)}>Select all</button>
        )}
        {stillOut && !inDeleted && <p className="muted">To delete a document that is out for signature, void it first.</p>}

        {envelopes && !empty && !shown.length && (
          <p className="ledger-empty">
            {folder ? 'This folder is empty. Select documents in All documents and move them here, or upload a PDF while this folder is open.' : 'Nothing here.'}
          </p>
        )}
        {GROUPS.map(([title, match]) => {
          const items = itemsOf(shown).filter((item) => match(item.status));
          if (!items.length) return null;
          const rows = items.flatMap((item) => (item.kind === 'one' ? [item.env] : item.envs));
          return (
            <section key={title}>
              <h2 className="group-head">
                <PickBox label={`Select all ${title.toLowerCase()}`} rows={rows} picked={picked} onChange={() => toggleAll(rows)} />
                {title} ({items.length})
              </h2>
              <ul>
                {items.map((item) => (item.kind === 'one'
                  ? <DocRow key={item.env.id} env={item.env} picked={picked} showSender={senders.size > 1} onToggle={() => toggle(item.env.id)} />
                  : (
                    <li key={item.id} className="batch">
                      <div className="row-item">
                        <PickBox label={`Select all ${item.envs.length} copies of ${item.envs[0].title}`} rows={item.envs} picked={picked} onChange={() => toggleAll(item.envs)} />
                        <button type="button" className="row row-batch" aria-expanded={opened.has(item.id)} onClick={() => flip(item.id)}>
                          <span className="row-title">{item.envs[0].title || 'Untitled document'}</span>
                          <span className="row-people"><span className="batch-count">{item.envs.length} people</span> sent as a list</span>
                          <span className="batch-bar" role="img" aria-label={batchSummary(item.envs)}>
                            <i style={{ width: `${(100 * item.envs.filter((e) => e.status === 'completed').length) / item.envs.length}%` }} />
                          </span>
                          <span className="row-when">{batchSummary(item.envs)}</span>
                          <span className="batch-chevron" aria-hidden="true" />
                        </button>
                      </div>
                      {opened.has(item.id) && (
                        <ul className="batch-list">
                          {byPerson(item.envs).map(([env, person]) => (
                            <DocRow key={env.id} env={env} person={person} picked={picked} showSender={senders.size > 1} onToggle={() => toggle(env.id)} />
                          ))}
                        </ul>
                      )}
                    </li>
                  )))}
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
      {sheet === 'remind' && (
        <ConfirmSheet
          title={`Remind ${due.length === 1 ? '1 person' : `${due.length} people`}?`}
          action="Send reminders"
          keep="Not now"
          tone="primary"
          onClose={() => setSheet(null)}
          onConfirm={async () => {
            const sent = await api.remindDocuments(voidable.map((env) => env.id));
            setNotice(sent.failed.length
              ? `Reminded ${sent.reminded}. Email to ${sent.failed.join(', ')} did not go through.`
              : `Reminded ${sent.reminded} ${sent.reminded === 1 ? 'person' : 'people'}.`);
            await finish();
          }}
        >
          <p>Everyone whose turn it is gets a fresh email with their signing link. People who already signed or are still waiting for someone before them are left alone.</p>
          {voidable.some((env) => env.recipients.some((r) => r.role === 'signer' && r.status !== 'signed' && (r.delivery === 'link' || r.email === user.email))) && (
            <p className="muted">You aren't emailed, and neither are signers whose links you hand out yourself.</p>
          )}
        </ConfirmSheet>
      )}
      {sheet === 'void' && (
        <VoidSheet
          count={voidable.length}
          skipped={selected.length - voidable.length}
          onClose={() => setSheet(null)}
          onConfirm={async (reason) => {
            await api.voidDocuments(voidable.map((env) => env.id), reason);
            await finish();
          }}
        />
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
