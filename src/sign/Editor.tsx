import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { api, type BulkResult, type Draft, type Envelope, type Field, type FieldType, type PageSize, type Recipient, type SentLink } from './api';
import { BULK_LIMIT, parseList, type Person } from './bulk';
import { detectFields } from './detect';
import type { User } from './App';
import { openPdf, type PdfDocument } from './pdf';
import { PdfPages } from './PdfPages';
import { Link, navigate } from './router';
import { Loading, Notice, Sheet, useBusy, Wordmark } from './ui';

const EXPIRY_DAYS = [7, 14, 30, 60, 90];
const MIN_SIZE = 0.012;

const PALETTE: { type: FieldType; label: string; size: [number, number] }[] = [
  { type: 'signature', label: 'Signature', size: [170, 42] },
  { type: 'initials', label: 'Initials', size: [64, 34] },
  { type: 'date', label: 'Date signed', size: [120, 16] },
  { type: 'name', label: 'Full name', size: [150, 16] },
  { type: 'text', label: 'Text', size: [170, 16] },
  { type: 'checkbox', label: 'Checkbox', size: [16, 16] },
];
const DRAG_TYPE = 'application/x-solaria-field';
const LABELS = Object.fromEntries(PALETTE.map((p) => [p.type, p.label])) as Record<FieldType, string>;

// Each person's fields keep one colour, so the page shows at a glance who does what.
const TINTS = ['#1f6f8b', '#a8481f', '#6a3fa0', '#1e7a52', '#a12c6b', '#6f6410', '#3350b0', '#8c3b3b', '#0f7575', '#7a4a8c'];

const hex = () => Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => b.toString(16).padStart(2, '0')).join('');
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function blankRecipient(role: Recipient['role'] = 'signer'): Recipient {
  return { id: `r${hex()}`, name: '', email: '', role, order: 1, delivery: 'email', requireCode: false, status: 'draft' };
}

type FieldBoxProps = {
  field: Field;
  tint: string;
  owner: string;
  selected: boolean;
  people: Recipient[];
  onSelect: () => void;
  onChange: (patch: Partial<Field>) => void;
  onRemove: () => void;
};

function FieldBox({ field, tint, owner, selected, people, onSelect, onChange, onRemove }: FieldBoxProps) {
  const drag = useRef<{ mode: 'move' | 'size'; x: number; y: number; start: Field; page: DOMRect } | null>(null);

  const begin = (mode: 'move' | 'size') => (e: PointerEvent<HTMLElement>) => {
    e.stopPropagation();
    onSelect();
    const page = e.currentTarget.closest('.page')!.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { mode, x: e.clientX, y: e.clientY, start: field, page };
  };

  const move = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.x) / d.page.width;
    const dy = (e.clientY - d.y) / d.page.height;
    if (d.mode === 'move') {
      onChange({ x: clamp(d.start.x + dx, 0, 1 - field.w), y: clamp(d.start.y + dy, 0, 1 - field.h) });
    } else {
      onChange({ w: clamp(d.start.w + dx, MIN_SIZE, 1 - field.x), h: clamp(d.start.h + dy, MIN_SIZE, 1 - field.y) });
    }
  };

  const end = () => {
    drag.current = null;
  };

  const nudge = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 0.02 : 0.004;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onRemove();
    } else if (moves[e.key]) {
      e.preventDefault();
      onChange({ x: clamp(field.x + moves[e.key][0], 0, 1 - field.w), y: clamp(field.y + moves[e.key][1], 0, 1 - field.h) });
    }
  };

  const style: CSSProperties = {
    left: `${field.x * 100}%`,
    top: `${field.y * 100}%`,
    width: `${field.w * 100}%`,
    height: `${field.h * 100}%`,
    color: tint,
  };
  const small = field.type === 'checkbox';
  return (
    <div className={selected ? 'mark-box mark-selected' : 'mark-box'} style={style}>
      <div
        className="mark-grip"
        role="button"
        tabIndex={0}
        aria-label={`${LABELS[field.type]} field for ${owner || 'unnamed signer'}, page ${field.page}. Arrow keys move it, Delete removes it.`}
        onPointerDown={begin('move')}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onKeyDown={nudge}
        onFocus={onSelect}
      >
        {!small && <span className="mark-label">{field.label || LABELS[field.type]}</span>}
      </div>
      {selected && (
        <>
          <span className="mark-size" aria-hidden="true" onPointerDown={begin('size')} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />
          <div
            className={`mark-tools${field.x > 0.5 ? ' mark-tools-right' : ''}${field.y > 0.82 ? ' mark-tools-above' : ''}`}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <label>
              For
              <select value={field.recipientId} onChange={(e) => onChange({ recipientId: e.target.value })}>
                {people.map((r) => <option key={r.id} value={r.id}>{r.name || r.email || 'Unnamed signer'}</option>)}
              </select>
            </label>
            {field.type === 'text' && (
              <label>
                Hint
                <input value={field.label} maxLength={60} placeholder="e.g. Entity name" onChange={(e) => onChange({ label: e.target.value })} />
              </label>
            )}
            {(field.type === 'text' || field.type === 'checkbox') && (
              <label className="check">
                <input type="checkbox" checked={field.required} onChange={(e) => onChange({ required: e.target.checked })} />
                Required
              </label>
            )}
            <button type="button" className="quiet" onClick={onRemove}>Remove</button>
          </div>
        </>
      )}
    </div>
  );
}

function PersonRow({ person, tint, active, sequential, position, count, onPick, onChange, onMove, onRemove }: {
  person: Recipient;
  tint: string;
  active: boolean;
  sequential: boolean;
  position: number;
  count: number;
  onPick: () => void;
  onChange: (patch: Partial<Recipient>) => void;
  onMove: (by: number) => void;
  onRemove: () => void;
}) {
  const signer = person.role === 'signer';
  return (
    <li className={active ? 'person person-active' : 'person'}>
      <div className="person-head">
        <button
          type="button"
          className="person-pick"
          aria-pressed={active}
          aria-label={`Place fields for ${person.name || 'this person'}`}
          disabled={!signer}
          onClick={onPick}
          style={{ background: signer ? tint : 'transparent', borderColor: tint }}
        >
          {sequential && signer ? position : ''}
        </button>
        <input aria-label="Name" placeholder="Name" value={person.name} maxLength={120} onChange={(e) => onChange({ name: e.target.value })} />
        {sequential && signer && (
          <span className="person-order">
            <button type="button" className="quiet" aria-label="Sign earlier" disabled={position === 1} onClick={() => onMove(-1)}>Up</button>
            <button type="button" className="quiet" aria-label="Sign later" disabled={position === count} onClick={() => onMove(1)}>Down</button>
          </span>
        )}
      </div>
      <input aria-label="Email" placeholder="Email" type="email" value={person.email} maxLength={200} onChange={(e) => onChange({ email: e.target.value })} />
      <div className="person-options">
        <select aria-label="Role" value={person.role} onChange={(e) => onChange({ role: e.target.value as Recipient['role'] })}>
          <option value="signer">Signs</option>
          <option value="cc">Gets a copy</option>
        </select>
        {signer && (
          <select aria-label="How they get it" value={person.delivery} onChange={(e) => onChange({ delivery: e.target.value as Recipient['delivery'] })}>
            <option value="email">By email</option>
            <option value="link">By link</option>
          </select>
        )}
        <button type="button" className="quiet" onClick={onRemove}>Remove</button>
      </div>
      {signer && person.delivery === 'email' && (
        <label className="check">
          <input type="checkbox" checked={person.requireCode} onChange={(e) => onChange({ requireCode: e.target.checked })} />
          Also ask for an emailed code
        </label>
      )}
      {signer && person.delivery === 'link' && <p className="muted">You share the link. They confirm their email with a code before opening it.</p>}
    </li>
  );
}

type Bulk = { slotId: string; list: string };

function SendSheet({ draft, onChange, onSend, onBulkSend, onClose, busy, error }: {
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
  onSend: () => void;
  onBulkSend: (slotId: string, people: Person[]) => void;
  onClose: () => void;
  busy: boolean;
  error: string;
}) {
  const signers = draft.recipients.filter((r) => r.role === 'signer');
  const [mode, setMode] = useState<'once' | 'list'>('once');
  // The signer left blank is the obvious one to fill from the list.
  const [bulk, setBulk] = useState<Bulk>(() => ({ slotId: (signers.find((r) => !r.email) ?? signers[0])?.id ?? '', list: '' }));
  const parsed = useMemo(() => parseList(bulk.list), [bulk.list]);
  const slot = signers.find((r) => r.id === bulk.slotId);
  const others = draft.recipients.filter((r) => r.id !== bulk.slotId);
  const listReady = Boolean(slot) && parsed.people.length > 0 && parsed.problems.length === 0;
  const count = parsed.people.length;
  return (
    <Sheet title="Send for signature" onClose={onClose}>
      {signers.length > 0 && (
        <div className="tabs" role="group" aria-label="How to send">
          <button type="button" aria-pressed={mode === 'once'} onClick={() => setMode('once')}>Send once</button>
          <button type="button" aria-pressed={mode === 'list'} onClick={() => setMode('list')}>Send to a list</button>
        </div>
      )}
      {mode === 'once' ? (
        <ul className="send-list">
          {draft.recipients.map((r) => (
            <li key={r.id}>
              <strong>{r.name || 'Unnamed'}</strong>
              <span>{r.role === 'cc' ? `gets a copy at ${r.email}` : r.delivery === 'link' ? `signs by a link you share, confirmed at ${r.email}` : `signs by email at ${r.email}`}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="bulk">
          <p className="muted">
            Each person gets their own copy to sign, with its own record. Up to {BULK_LIMIT} at a time. This draft stays, so you can use it again.
          </p>
          {signers.length > 1 && (
            <label className="field">
              Signer to fill from the list
              <select value={bulk.slotId} onChange={(e) => setBulk({ ...bulk, slotId: e.target.value })}>
                {signers.map((r) => <option key={r.id} value={r.id}>{r.name || r.email || 'Unnamed signer'}</option>)}
              </select>
            </label>
          )}
          <label className="field">
            People, one per line
            <textarea
              rows={7}
              spellCheck={false}
              placeholder={'Ada Lovelace, ada@example.com\nAlan Turing, alan@example.com'}
              value={bulk.list}
              onChange={(e) => setBulk({ ...bulk, list: e.target.value })}
            />
          </label>
          <p className="muted">Paste from a spreadsheet, a CSV or an email. Each line needs a name and an email address.</p>
          {parsed.problems.length > 0 ? (
            <Notice>{parsed.problems.slice(0, 4).join(' ')}{parsed.problems.length > 4 ? ` And ${parsed.problems.length - 4} more.` : ''}</Notice>
          ) : count > 0 && (
            <p className="bulk-count" role="status">{count} {count === 1 ? 'person' : 'people'} ready</p>
          )}
          {others.length > 0 && (
            <p className="muted">
              Also on every copy: {others.map((r) => `${r.name || r.email || 'an unnamed person'}${r.role === 'cc' ? ' (copy)' : ''}`).join(', ')}.
            </p>
          )}
        </div>
      )}
      <label className="field">
        Message to signers (optional)
        <textarea rows={3} maxLength={2000} value={draft.message} onChange={(e) => onChange({ message: e.target.value })} />
      </label>
      <label className="field">
        Signing closes after
        <select value={draft.expiryDays} onChange={(e) => onChange({ expiryDays: Number(e.target.value) })}>
          {EXPIRY_DAYS.map((days) => <option key={days} value={days}>{days} days</option>)}
        </select>
      </label>
      <p className="muted">
        Electronic signatures can't be used for wills, testamentary trusts, family-law papers, court
        documents, some legal notices, or anything that must be notarized.
      </p>
      {error && <Notice>{error}</Notice>}
      {busy && mode === 'list' && <p className="muted" role="status">Sending {count} copies. Keep this page open; it takes about {Math.max(5, Math.ceil(count * 1.2))} seconds.</p>}
      <div className="actions">
        {mode === 'once' ? (
          <button type="button" className="primary" disabled={busy} onClick={onSend}>{busy ? 'Sending' : 'Send'}</button>
        ) : (
          <button type="button" className="primary" disabled={busy || !listReady} onClick={() => onBulkSend(bulk.slotId, parsed.people)}>
            {busy ? 'Sending' : count > 0 ? `Send ${count} ${count === 1 ? 'copy' : 'copies'}` : 'Send copies'}
          </button>
        )}
        <button type="button" className="quiet" disabled={busy} onClick={onClose}>Keep editing</button>
      </div>
    </Sheet>
  );
}

function BulkSentSheet({ results, onDone }: { results: BulkResult[]; onDone: () => void }) {
  const [copied, setCopied] = useState('');
  const sent = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  const unmailed = sent.filter((r) => r.emailFailed);
  const links = sent.flatMap((r) => r.links ?? []);
  const copy = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
  };
  return (
    <Sheet title={failed.length ? `Sent ${sent.length} of ${results.length}` : `Sent ${sent.length} ${sent.length === 1 ? 'copy' : 'copies'}`} onClose={onDone}>
      {failed.length > 0 && (
        <Notice>
          These were not sent: {failed.map((r) => `${r.name} (${r.error})`).join('; ')}. Fix them and send again with just those people.
        </Notice>
      )}
      {unmailed.length > 0 && (
        <Notice>Email to {unmailed.map((r) => r.name).join(', ')} did not go through. Open their document to get a link instead.</Notice>
      )}
      {links.length > 0 ? (
        <>
          <p>Each link belongs to one person. Copy them now, because they can't be shown again.</p>
          <button type="button" className="secondary" onClick={() => copy('all', links.map((l) => `${l.name}\t${l.url}`).join('\n'))}>
            {copied === 'all' ? 'Copied all' : 'Copy all links'}
          </button>
          <ul className="link-list">
            {links.map((link) => (
              <li key={link.recipientId}>
                <span>{link.name}</span>
                <input readOnly aria-label={`Signing link for ${link.name}`} value={link.url} onFocus={(e) => e.target.select()} />
                <button type="button" className="secondary" onClick={() => copy(link.recipientId, link.url)}>{copied === link.recipientId ? 'Copied' : 'Copy link'}</button>
              </li>
            ))}
          </ul>
        </>
      ) : sent.length > 0 && (
        <p>Everyone on the list has an email asking them to sign. Each copy shows on your documents page, where you can follow it.</p>
      )}
      <div className="actions">
        <button type="button" className="primary" onClick={onDone}>Done</button>
      </div>
    </Sheet>
  );
}

function SentSheet({ links, failed, onDone }: { links: SentLink[]; failed: string[]; onDone: () => void }) {
  const [copied, setCopied] = useState('');
  const copy = async (link: SentLink) => {
    await navigator.clipboard.writeText(link.url);
    setCopied(link.recipientId);
  };
  return (
    <Sheet title={links.length ? 'Share these links' : 'Sent, with a problem'} onClose={onDone}>
      {failed.length > 0 && <Notice>Email to {failed.join(' and ')} did not go through. Open the document to get a link for them instead.</Notice>}
      {links.length > 0 && <p>Each link belongs to one person. Copy them now, because they can't be shown again. A new link replaces the old one.</p>}
      <ul className="link-list">
        {links.map((link) => (
          <li key={link.recipientId}>
            <span>{link.name}</span>
            <input readOnly aria-label={`Signing link for ${link.name}`} value={link.url} onFocus={(e) => e.target.select()} />
            <button type="button" className="secondary" onClick={() => copy(link)}>{copied === link.recipientId ? 'Copied' : 'Copy link'}</button>
          </li>
        ))}
      </ul>
      <div className="actions">
        <button type="button" className="primary" onClick={onDone}>Done</button>
      </div>
    </Sheet>
  );
}

type Props = { env: Envelope; user: User; onSent: (env: Envelope) => void };

export default function Editor({ env, user, onSent }: Props) {
  const [draft, setDraft] = useState<Draft>({
    title: env.title,
    message: env.message,
    sequential: env.sequential,
    expiryDays: env.expiryDays,
    recipients: env.recipients.length ? env.recipients : [blankRecipient()],
    fields: env.fields,
  });
  const [doc, setDoc] = useState<PdfDocument | null>(null);
  const [loadError, setLoadError] = useState('');
  const [activeId, setActiveId] = useState('');
  const [armed, setArmed] = useState<FieldType | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'failed'>('saved');
  const [sheet, setSheet] = useState<'send' | 'delete' | null>(null);
  const [result, setResult] = useState<{ envelope: Envelope; links: SentLink[]; failed: string[] } | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkResult[] | null>(null);
  const { busy, error, run, setError } = useBusy();

  const latest = useRef(draft);
  latest.current = draft;
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const timer = useRef(0);
  const edited = useRef(false);

  // Saves run one at a time, so an older snapshot can never land after a newer one.
  const save = useCallback(() => {
    const next = queue.current.catch(() => undefined).then(async () => {
      const snapshot = latest.current;
      await api.save(env.id, snapshot);
      if (snapshot === latest.current) {
        edited.current = false;
        setSaveState('saved');
      }
    });
    queue.current = next;
    return next;
  }, [env.id]);

  useEffect(() => {
    if (!edited.current) return;
    setSaveState('saving');
    timer.current = window.setTimeout(() => save().catch(() => setSaveState('failed')), 500);
    return () => window.clearTimeout(timer.current);
  }, [draft, save]);

  useEffect(() => () => {
    if (edited.current) save().catch(() => undefined);
  }, [save]);

  useEffect(() => {
    let opened: PdfDocument | null = null;
    let cancelled = false;
    api.original(env.id).then(openPdf).then((pdf) => {
      opened = pdf;
      if (cancelled) pdf.destroy();
      else setDoc(pdf);
    }).catch((e: Error) => setLoadError(e.message));
    return () => {
      cancelled = true;
      opened?.destroy();
    };
  }, [env.id]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setArmed(null);
        setSelected(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const update = (patch: Partial<Draft> | ((prior: Draft) => Draft)) => {
    edited.current = true;
    setDraft((prior) => (typeof patch === 'function' ? patch(prior) : { ...prior, ...patch }));
  };

  const signers = useMemo(() => draft.recipients.filter((r) => r.role === 'signer'), [draft.recipients]);
  const active = signers.find((r) => r.id === activeId) ?? signers[0];
  const tintOf = (id: string) => TINTS[Math.max(draft.recipients.findIndex((r) => r.id === id), 0) % TINTS.length];

  const addPerson = (person: Recipient) => {
    update((prior) => ({ ...prior, recipients: [...prior.recipients, person] }));
    if (person.role === 'signer') setActiveId(person.id);
  };

  const changePerson = (id: string, patch: Partial<Recipient>) => update((prior) => ({
    ...prior,
    recipients: prior.recipients.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    // The server keeps fields only for signers, so the page must show the same.
    fields: patch.role === 'cc' ? prior.fields.filter((f) => f.recipientId !== id) : prior.fields,
  }));

  const removePerson = (id: string) => update((prior) => ({
    ...prior,
    recipients: prior.recipients.filter((r) => r.id !== id),
    fields: prior.fields.filter((f) => f.recipientId !== id),
  }));

  const movePerson = (id: string, by: number) => update((prior) => {
    const order = prior.recipients.filter((r) => r.role === 'signer');
    const from = order.findIndex((r) => r.id === id);
    const [moved] = order.splice(from, 1);
    order.splice(from + by, 0, moved);
    const copies = prior.recipients.filter((r) => r.role === 'cc');
    return { ...prior, recipients: [...order, ...copies] };
  });

  // Drops a new field centred where the page was clicked, or where one was dragged to.
  const placeAt = (type: FieldType, page: number, size: PageSize, rect: DOMRect, clientX: number, clientY: number, keepArmed = false) => {
    if (!active) return;
    const [width, height] = PALETTE.find((p) => p.type === type)!.size;
    const w = Math.min(width / size.width, 1);
    const h = Math.min(height / size.height, 1);
    const field: Field = {
      id: `f${hex()}`,
      recipientId: active.id,
      type,
      page,
      x: clamp((clientX - rect.left) / rect.width - w / 2, 0, 1 - w),
      y: clamp((clientY - rect.top) / rect.height - h / 2, 0, 1 - h),
      w,
      h,
      required: true,
      label: '',
    };
    update((prior) => ({ ...prior, fields: [...prior.fields, field] }));
    setSelected(field.id);
    if (!keepArmed) setArmed(null);
  };

  const placeField = (page: number, size: PageSize, e: PointerEvent<HTMLDivElement>) => {
    if (!armed || !active) {
      setSelected(null);
      return;
    }
    placeAt(armed, page, size, e.currentTarget.getBoundingClientRect(), e.clientX, e.clientY, e.shiftKey);
  };

  const [finding, setFinding] = useState('');
  const findFields = async () => {
    if (!doc || !active) return;
    setFinding('Looking for places to sign');
    try {
      const found = await detectFields(doc);
      const clash = (f: { page: number; x: number; y: number; w: number; h: number }) => draft.fields.some(
        (o) => o.page === f.page && f.x < o.x + o.w && o.x < f.x + f.w && f.y < o.y + o.h && o.y < f.y + f.h,
      );
      const fresh = found.filter((f) => !clash(f)).map((f): Field => ({
        id: `f${hex()}`,
        recipientId: active.id,
        type: f.type,
        page: f.page,
        x: f.x,
        y: f.y,
        w: f.w,
        h: f.h,
        required: f.type !== 'text',
        label: f.label,
      }));
      if (!fresh.length) {
        setFinding(found.length ? 'Every place found already has a field.' : 'No signature lines found. Drag fields onto the page instead.');
        return;
      }
      update((prior) => ({ ...prior, fields: [...prior.fields, ...fresh] }));
      const count = (type: FieldType) => fresh.filter((f) => f.type === type).length;
      const parts = PALETTE.filter((p) => count(p.type)).map((p) => `${count(p.type)} ${p.label.toLowerCase()}`);
      setFinding(`Added ${parts.join(', ')} for ${active.name || 'this signer'}. Check each one; click a field to move it, remove it, or give it to someone else.`);
    } catch {
      setFinding('This document could not be read for fields. Drag fields onto the page instead.');
    }
  };

  const changeField = (id: string, patch: Partial<Field>) => update((prior) => ({
    ...prior,
    fields: prior.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)),
  }));

  const removeField = (id: string) => {
    update((prior) => ({ ...prior, fields: prior.fields.filter((f) => f.id !== id) }));
    setSelected(null);
  };

  const send = () => run(async () => {
    window.clearTimeout(timer.current);
    await save();
    const sent = await api.send(env.id);
    edited.current = false;
    if (sent.links.length || sent.failed.length) {
      setSheet(null);
      setResult(sent);
    } else {
      onSent(sent.envelope);
    }
  });

  const bulkSend = (slotId: string, people: Person[]) => run(async () => {
    window.clearTimeout(timer.current);
    await save();
    const { results } = await api.bulkSend(env.id, slotId, people);
    setSheet(null);
    setBulkResult(results);
  });

  const remove = () => run(async () => {
    edited.current = false;
    await api.deleteDocuments([env.id]);
    navigate('/sign');
  });

  const overlay = (page: number, size: PageSize) => (
    <div
      className={armed ? 'marks marks-armed' : 'marks'}
      onPointerDown={(e) => placeField(page, size, e)}
      onDragOver={(e) => {
        if (!active || !e.dataTransfer.types.includes(DRAG_TYPE)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={(e) => {
        const type = e.dataTransfer.getData(DRAG_TYPE) as FieldType;
        if (!type || !LABELS[type]) return;
        e.preventDefault();
        placeAt(type, page, size, e.currentTarget.getBoundingClientRect(), e.clientX, e.clientY);
      }}
    >
      {draft.fields.filter((f) => f.page === page).map((f) => (
        <FieldBox
          key={f.id}
          field={f}
          tint={tintOf(f.recipientId)}
          owner={draft.recipients.find((r) => r.id === f.recipientId)?.name ?? ''}
          selected={selected === f.id}
          people={signers}
          onSelect={() => {
            setSelected(f.id);
            setArmed(null);
          }}
          onChange={(patch) => changeField(f.id, patch)}
          onRemove={() => removeField(f.id)}
        />
      ))}
    </div>
  );

  const saveLabel = saveState === 'failed' ? 'Not saved' : saveState === 'saving' ? 'Saving' : 'Saved';
  return (
    <div className="editor">
      <header className="bar editor-bar">
        <Link to="/sign"><Wordmark /></Link>
        <input
          className="title-input"
          aria-label="Document title"
          value={draft.title}
          maxLength={200}
          onChange={(e) => update({ title: e.target.value })}
        />
        <span className="bar-end">
          <span className={saveState === 'failed' ? 'save-state save-failed' : 'save-state'} role="status">{saveLabel}</span>
          <button
            type="button"
            className="primary"
            onClick={() => {
              setError('');
              setSheet('send');
            }}
          >
            Review and send
          </button>
        </span>
      </header>

      <aside className="rail">
        <section>
          <h2>Who needs to sign</h2>
          <ul className="people">
            {draft.recipients.map((person) => (
              <PersonRow
                key={person.id}
                person={person}
                tint={tintOf(person.id)}
                active={person.id === active?.id}
                sequential={draft.sequential}
                position={signers.findIndex((r) => r.id === person.id) + 1}
                count={signers.length}
                onPick={() => setActiveId(person.id)}
                onChange={(patch) => changePerson(person.id, patch)}
                onMove={(by) => movePerson(person.id, by)}
                onRemove={() => removePerson(person.id)}
              />
            ))}
          </ul>
          <div className="rail-actions">
            <button type="button" className="secondary" onClick={() => addPerson(blankRecipient())}>Add a signer</button>
            {!draft.recipients.some((r) => r.email === user.email) && (
              <button type="button" className="quiet" onClick={() => addPerson({ ...blankRecipient(), name: user.name, email: user.email })}>Add myself</button>
            )}
            <button type="button" className="quiet" onClick={() => addPerson(blankRecipient('cc'))}>Add a copy</button>
          </div>
          {signers.length > 1 && (
            <label className="check">
              <input type="checkbox" checked={draft.sequential} onChange={(e) => update({ sequential: e.target.checked })} />
              Sign in this order
            </label>
          )}
        </section>
        <button type="button" className="quiet rail-delete" onClick={() => setSheet('delete')}>Delete draft</button>
      </aside>

      <div className="palette" role="group" aria-label="Fields to place">
        <p>{active ? <>Fields for <strong style={{ color: tintOf(active.id) }}>{active.name || 'this signer'}</strong></> : 'Add a signer to place fields'}</p>
        <div className="palette-items">
          {PALETTE.map((item) => (
            <button
              key={item.type}
              type="button"
              disabled={!active}
              draggable={Boolean(active)}
              title="Click, then click the page. Or drag it onto the page."
              aria-pressed={armed === item.type}
              onClick={() => setArmed(armed === item.type ? null : item.type)}
              onDragStart={(e) => {
                e.dataTransfer.setData(DRAG_TYPE, item.type);
                e.dataTransfer.effectAllowed = 'copy';
                setArmed(null);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button type="button" className="secondary palette-find" disabled={!active || !doc} onClick={findFields}>Find fields automatically</button>
        {armed
          ? <p className="palette-hint" role="status">Click the page to place it. Hold Shift to place several, or press Esc to stop.</p>
          : finding
            ? <p className="palette-hint" role="status">{finding}</p>
            : active && <p className="palette-hint">Drag a field onto the page, or click it and then click the page.</p>}
      </div>

      <main className="editor-doc" onPointerDown={(e) => {
        if (e.target === e.currentTarget) setSelected(null);
      }}>
        {loadError && <Notice>{loadError}</Notice>}
        {doc ? <PdfPages doc={doc} sizes={env.document.sizes} overlay={overlay} /> : !loadError && <Loading label="Opening the document" />}
      </main>

      {sheet === 'send' && <SendSheet draft={draft} onChange={update} onSend={send} onBulkSend={bulkSend} onClose={() => setSheet(null)} busy={busy} error={error} />}
      {sheet === 'delete' && (
        <Sheet title="Delete this draft?" onClose={() => setSheet(null)}>
          <p>It moves to the Deleted folder on your documents page, where you can restore it. Nothing has been sent.</p>
          {error && <Notice>{error}</Notice>}
          <div className="actions">
            <button type="button" className="danger" disabled={busy} onClick={remove}>Delete draft</button>
            <button type="button" className="quiet" onClick={() => setSheet(null)}>Keep it</button>
          </div>
        </Sheet>
      )}
      {result && <SentSheet links={result.links} failed={result.failed} onDone={() => onSent(result.envelope)} />}
      {bulkResult && <BulkSentSheet results={bulkResult} onDone={() => navigate('/sign')} />}
    </div>
  );
}
