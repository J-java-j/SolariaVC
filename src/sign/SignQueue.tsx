import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type Disclosure, type Envelope, type EnvelopeSummary, type Field, type Mark } from './api';
import type { User } from './App';
import { openPdf, type PdfDocument } from './pdf';
import { PdfPages } from './PdfPages';
import { navigate } from './router';
import { SignaturePad } from './SignaturePad';
import { Loading, Notice } from './ui';

// Two at a time: fast enough for a batch of forty, gentle on the mail sender,
// and each request stays well inside the server's time limit even when the
// signature seals a finished document.
const AT_ONCE = 2;

type Terms = { disclosure: Disclosure; intent: { version: string; adopt: string; finish: string } };

// Documents where it is this person's turn to sign.
export function waitingOn(envs: EnvelopeSummary[], email: string) {
  return envs.filter((env) => !env.deletedAt && env.status === 'sent' && !env.sealing && env.recipients.some(
    (r) => r.role === 'signer' && r.email === email && r.status !== 'signed' && r.status !== 'waiting',
  ));
}

// One document to sign: its file's hash and the other people on it.
export type QueueItem = { id: string; title: string; sha256: string; others: string };
type Opened = { recipients: Pick<Envelope['recipients'][number], 'id' | 'email' | 'role'>[]; fields: Field[]; document: { sizes: Envelope['document']['sizes'] } };

// Where the documents come from: the team's documents page, or a signer's own page.
export type QueueSource = {
  list: () => Promise<QueueItem[]>;
  get: (id: string) => Promise<Opened>;
  original: (id: string) => Promise<ArrayBuffer>;
  sign: (id: string, body: Parameters<typeof api.signMine>[1]) => Promise<unknown>;
  done: () => void;
  doneLabel: string;
};

// Copies of one file are signed together after it is shown once; a different file
// is always shown before it can be signed.
function byFile(items: QueueItem[]) {
  const groups = new Map<string, QueueItem[]>();
  for (const item of items) groups.set(item.sha256, [...(groups.get(item.sha256) ?? []), item]);
  return [...groups.values()];
}

const otherPeople = (env: EnvelopeSummary, email: string) => env.recipients
  .filter((r) => r.role === 'signer' && r.email !== email)
  .map((r) => r.name)
  .join(', ');

const teamSource = (email: string): QueueSource => ({
  list: async () => {
    const list = await api.list();
    // /sign/queue?ids=… signs just the documents picked; without it, everything waiting.
    const only = new URLSearchParams(window.location.search).get('ids')?.split(',').filter(Boolean);
    const waiting = waitingOn(list.envelopes, email);
    return (only?.length ? waiting.filter((env) => only.includes(env.id)) : waiting)
      .map((env) => ({ id: env.id, title: env.title, sha256: env.sha256, others: otherPeople(env, email) }));
  },
  get: (id) => api.get(id),
  original: (id) => api.original(id),
  sign: (id, body) => api.signMine(id, body),
  done: () => navigate('/sign'),
  doneLabel: 'Back to documents',
});

export default function SignQueue({ user }: { user: User }) {
  const source = useMemo(() => teamSource(user.email), [user.email]);
  return <Queue email={user.email} name={user.name} source={source} />;
}

export function Queue({ email, name, source }: { email: string; name: string; source: QueueSource }) {
  const user = { email, name };
  const [groups, setGroups] = useState<QueueItem[][] | null>(null);
  const [terms, setTerms] = useState<Terms | null>(null);
  const [loadError, setLoadError] = useState('');
  const [index, setIndex] = useState(0);
  const [sample, setSample] = useState<Opened | null>(null);
  const [doc, setDoc] = useState<PdfDocument | null>(null);
  const [rendered, setRendered] = useState<ReadonlySet<string>>(new Set());
  const [agreed, setAgreed] = useState(false);
  const [marks, setMarks] = useState<{ signature?: Mark; initials?: Mark }>({});
  const [adopting, setAdopting] = useState<'signature' | 'initials' | null>(null);
  const [running, setRunning] = useState(false);
  const [outcomes, setOutcomes] = useState<Record<string, string>>({});
  const stop = useRef(false);

  useEffect(() => {
    Promise.all([source.list(), api.disclosure()])
      .then(([items, t]) => {
        setGroups(byFile(items));
        setTerms(t);
      })
      .catch((e: Error) => setLoadError(e.message));
    return () => {
      stop.current = true;
    };
  }, [source]);

  const group = groups?.[index];

  // Opens the first copy of the current file, and its fields, to show it.
  useEffect(() => {
    if (!group) return;
    let opened: PdfDocument | null = null;
    let cancelled = false;
    setDoc(null);
    setSample(null);
    source.get(group[0].id).then(async (env) => {
      const pdf = await openPdf(await source.original(group[0].id));
      opened = pdf;
      if (cancelled) pdf.destroy();
      else {
        setSample(env);
        setDoc(pdf);
      }
    }).catch((e: Error) => setLoadError(e.message));
    return () => {
      cancelled = true;
      opened?.destroy();
    };
  }, [group, source]);

  const me = sample?.recipients.find((r) => r.email === user.email && r.role === 'signer');
  const mine = useMemo(() => (sample && me ? sample.fields.filter((f) => f.recipientId === me.id) : []), [sample, me]);
  const needsInitials = mine.some((f) => f.type === 'initials');
  // One box per blank on the page, numbered to match a marker on the document.
  // Copies of one file have the same blanks in the same order, so each answer
  // goes into the same place on every copy.
  const questions = useMemo(() => mine
    .filter((f) => f.type === 'text')
    .map((f, index) => ({ index, field: f, label: f.label.trim() || 'Text', required: f.required })), [mine]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [focused, setFocused] = useState<number | null>(null);
  useEffect(() => setAnswers([]), [group]);
  const answerOf = (index: number) => answers[index] ?? (/e-?mail/i.test(questions[index]?.label ?? '') ? user.email : '');
  const numberOf = (id: string) => questions.findIndex((q) => q.field.id === id);
  const answered = questions.every((q) => !q.required || answerOf(q.index).trim());
  const shown = group ? rendered.has(group[0].sha256) : false;
  const done = group ? group.filter((env) => outcomes[env.id] === 'ok').length : 0;
  const finished = group ? group.every((env) => outcomes[env.id]) : false;
  const ready = shown && agreed && answered && Boolean(marks.signature) && (!needsInitials || Boolean(marks.initials)) && !running && !finished;

  const signAll = async () => {
    if (!group || !terms) return;
    setRunning(true);
    const queue = group.filter((env) => !outcomes[env.id]);
    const body = {
      rendered: [...rendered],
      consent: true as const,
      disclosureVersion: terms.disclosure.version,
      intent: true as const,
      signature: marks.signature!,
      ...(marks.initials ? { initials: marks.initials } : {}),
      answers: questions.map((q) => answerOf(q.index).trim()),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    const worker = async () => {
      for (let env = queue.shift(); env && !stop.current; env = queue.shift()) {
        const id = env.id;
        try {
          await source.sign(id, body);
          setOutcomes((prior) => ({ ...prior, [id]: 'ok' }));
        } catch (e) {
          setOutcomes((prior) => ({ ...prior, [id]: (e as Error).message }));
        }
      }
    };
    await Promise.all(Array.from({ length: AT_ONCE }, worker));
    setRunning(false);
  };

  if (loadError) {
    return (
      <div className="queue">
        <Notice>{loadError}</Notice>
        <button type="button" className="secondary" onClick={source.done}>{source.doneLabel}</button>
      </div>
    );
  }
  if (!groups || !terms) return <Loading label="Finding your documents" />;
  if (!groups.length || !group) {
    return (
      <div className="queue">
        <h1>Nothing to sign</h1>
        <p className="muted">No document is waiting for your signature right now.</p>
        <button type="button" className="primary" onClick={source.done}>{source.doneLabel}</button>
      </div>
    );
  }

  const total = groups.reduce((sum, g) => sum + g.length, 0);
  const failures = group.filter((env) => outcomes[env.id] && outcomes[env.id] !== 'ok');
  const last = index === groups.length - 1;

  return (
    <div className="queue">
      <p className="queue-step">
        {groups.length > 1 ? `Document ${index + 1} of ${groups.length} · ` : ''}{total} waiting for your signature
      </p>
      <h1>{group[0].title || 'Untitled document'}</h1>
      <p className="muted">
        {group.length === 1
          ? `With ${group[0].others || 'no one else'}.`
          : !group.some((item) => item.others)
            ? `${group.length} copies of this file. They are the same document, and you sign each one.`
            : `${group.length} copies of this file, one each for ${group.map((item) => item.others).filter(Boolean).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).slice(0, 6).join('; ')}${group.length > 6 ? ` and ${group.length - 6} more` : ''}. They are the same document, and you sign each one.`}
      </p>

      <section className="queue-doc">
        <div className="consent-window queue-window">
          {doc && sample ? (
            <PdfPages
              doc={doc}
              sizes={sample.document.sizes}
              onRendered={() => setRendered((prior) => new Set(prior).add(group[0].sha256))}
              onError={() => setLoadError('This document could not be displayed, so it cannot be signed here.')}
              overlay={(page) => mine.filter((f) => f.page === page).map((f) => (
                <span
                  key={f.id}
                  data-answer={f.id}
                  className={`queue-spot${f.type === 'text' && numberOf(f.id) === focused ? ' queue-spot-on' : ''}`}
                  style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%`, width: `${f.w * 100}%`, height: `${f.h * 100}%` }}
                >
                  {(f.type === 'signature' || f.type === 'initials') && marks[f.type]
                    ? <img src={marks[f.type]!.dataUrl} alt="" />
                    : <>{f.type === 'text' && <b className="queue-num">{numberOf(f.id) + 1}</b>}<em>{f.type === 'text' && answerOf(numberOf(f.id)) ? answerOf(numberOf(f.id)) : f.type === 'date' ? 'Date' : f.type === 'name' ? 'Name' : f.type === 'initials' ? 'Initials' : f.type === 'signature' ? 'Sign' : f.label || 'Field'}</em></>}
                </span>
              ))}
            />
          ) : <Loading label="Opening the document" />}
        </div>
        <p className="muted">Scroll to read it. Your places to sign are outlined.</p>
      </section>

      <section className="queue-steps">
        <label className="check queue-check">
          <input type="checkbox" checked={agreed} disabled={running} onChange={(e) => setAgreed(e.target.checked)} />
          <span>{terms.disclosure.agreement}</span>
        </label>
        <details className="queue-terms">
          <summary>Read the electronic records disclosure</summary>
          <div className="legal">
            <p>{terms.disclosure.intro}</p>
            {terms.disclosure.sections.map((section) => (
              <p key={section.heading}><strong>{section.heading}.</strong> {section.body}</p>
            ))}
          </div>
        </details>

        {questions.length > 0 && (
          <div className="queue-answers">
            <p className="muted">Fill in {questions.length === 1 ? 'the blank' : `the ${questions.length} blanks`} marked on the document{group.length > 1 ? '. Each answer goes on every copy' : ''}.</p>
            {questions.map((q) => (
              <label key={q.field.id} className="field queue-answer">
                <span><b className="queue-num">{q.index + 1}</b> {q.label}<span className="muted"> · page {q.field.page}{q.required ? '' : ' · optional'}</span></span>
                <input
                  value={answerOf(q.index)}
                  maxLength={500}
                  disabled={running}
                  onFocus={() => {
                    setFocused(q.index);
                    document.querySelector(`[data-answer="${q.field.id}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
                  }}
                  onBlur={() => setFocused(null)}
                  onChange={(e) => {
                    const value = e.target.value;
                    setAnswers((prior) => {
                      const next = questions.map((other) => prior[other.index] ?? answerOf(other.index));
                      next[q.index] = value;
                      return next;
                    });
                  }}
                />
              </label>
            ))}
          </div>
        )}

        <div className="queue-marks">
          {marks.signature
            ? <span className="queue-mark"><img src={marks.signature.dataUrl} alt="Your signature" /><button type="button" className="quiet" disabled={running} onClick={() => setAdopting('signature')}>Change</button></span>
            : <button type="button" className="secondary" onClick={() => setAdopting('signature')}>Adopt your signature</button>}
          {needsInitials && (marks.initials
            ? <span className="queue-mark"><img src={marks.initials.dataUrl} alt="Your initials" /><button type="button" className="quiet" disabled={running} onClick={() => setAdopting('initials')}>Change</button></span>
            : <button type="button" className="secondary" onClick={() => setAdopting('initials')}>Adopt your initials</button>)}
        </div>

        <p className="legal queue-intent">{terms.intent.finish}</p>
        {!shown && <p className="muted" role="status">Waiting for the document to display.</p>}

        {(running || done > 0) && (
          <div className="queue-progress" role="status">
            <span className="batch-bar"><i style={{ width: `${(100 * done) / group.length}%` }} /></span>
            <span>Signed {done} of {group.length}{running ? '' : '.'}</span>
          </div>
        )}
        {failures.length > 0 && (
          <Notice>
            {failures.length} not signed: {failures.slice(0, 5).map((env) => outcomes[env.id]).join(' ')}{failures.length > 5 ? ' …' : ''}
          </Notice>
        )}

        <div className="actions">
          {!finished && (
            <button type="button" className="primary" disabled={!ready} onClick={signAll}>
              {running ? 'Signing' : group.length === 1 ? 'Finish and sign' : `Finish and sign all ${group.length}`}
            </button>
          )}
          {finished && !last && (
            <button type="button" className="primary" onClick={() => setIndex(index + 1)}>Next document</button>
          )}
          {finished && last && <button type="button" className="primary" onClick={source.done}>Done</button>}
          {!finished && <button type="button" className="quiet" disabled={running} onClick={source.done}>Not now</button>}
          {!finished && !last && !running && <button type="button" className="quiet" onClick={() => setIndex(index + 1)}>Skip this one</button>}
        </div>
      </section>

      {adopting && (
        <SignaturePad
          kind={adopting}
          name={marks.signature?.name ?? user.name}
          intent={terms.intent.adopt}
          onCancel={() => setAdopting(null)}
          onAdopt={(mark) => {
            setMarks((prior) => ({ ...prior, [adopting]: mark }));
            setAdopting(null);
          }}
        />
      )}
    </div>
  );
}
