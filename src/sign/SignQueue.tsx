import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type Disclosure, type Envelope, type EnvelopeSummary, type Mark } from './api';
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

// Copies of one file are signed together after it is shown once; a different file
// is always shown before it can be signed.
function byFile(envs: EnvelopeSummary[]) {
  const groups = new Map<string, EnvelopeSummary[]>();
  for (const env of envs) groups.set(env.sha256, [...(groups.get(env.sha256) ?? []), env]);
  return [...groups.values()];
}

const otherPeople = (env: EnvelopeSummary, email: string) => env.recipients
  .filter((r) => r.role === 'signer' && r.email !== email)
  .map((r) => r.name)
  .join(', ');

export default function SignQueue({ user }: { user: User }) {
  const [groups, setGroups] = useState<EnvelopeSummary[][] | null>(null);
  const [terms, setTerms] = useState<Terms | null>(null);
  const [loadError, setLoadError] = useState('');
  const [index, setIndex] = useState(0);
  const [sample, setSample] = useState<Envelope | null>(null);
  const [doc, setDoc] = useState<PdfDocument | null>(null);
  const [rendered, setRendered] = useState<ReadonlySet<string>>(new Set());
  const [agreed, setAgreed] = useState(false);
  const [marks, setMarks] = useState<{ signature?: Mark; initials?: Mark }>({});
  const [adopting, setAdopting] = useState<'signature' | 'initials' | null>(null);
  const [running, setRunning] = useState(false);
  const [outcomes, setOutcomes] = useState<Record<string, string>>({});
  const stop = useRef(false);

  useEffect(() => {
    Promise.all([api.list(), api.disclosure()])
      .then(([list, t]) => {
        setGroups(byFile(waitingOn(list.envelopes, user.email)));
        setTerms(t);
      })
      .catch((e: Error) => setLoadError(e.message));
    return () => {
      stop.current = true;
    };
  }, [user.email]);

  const group = groups?.[index];

  // Opens the first copy of the current file, and its fields, to show it.
  useEffect(() => {
    if (!group) return;
    let opened: PdfDocument | null = null;
    let cancelled = false;
    setDoc(null);
    setSample(null);
    api.get(group[0].id).then(async (env) => {
      const pdf = await openPdf(await api.original(env.id));
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
  }, [group]);

  const me = sample?.recipients.find((r) => r.email === user.email && r.role === 'signer');
  const mine = useMemo(() => (sample && me ? sample.fields.filter((f) => f.recipientId === me.id) : []), [sample, me]);
  const needsInitials = mine.some((f) => f.type === 'initials');
  const shown = group ? rendered.has(group[0].sha256) : false;
  const done = group ? group.filter((env) => outcomes[env.id] === 'ok').length : 0;
  const finished = group ? group.every((env) => outcomes[env.id]) : false;
  const ready = shown && agreed && Boolean(marks.signature) && (!needsInitials || Boolean(marks.initials)) && !running && !finished;

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
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    const worker = async () => {
      for (let env = queue.shift(); env && !stop.current; env = queue.shift()) {
        const id = env.id;
        try {
          await api.signMine(id, body);
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
        <button type="button" className="secondary" onClick={() => navigate('/sign')}>Back to documents</button>
      </div>
    );
  }
  if (!groups || !terms) return <Loading label="Finding your documents" />;
  if (!groups.length || !group) {
    return (
      <div className="queue">
        <h1>Nothing to sign</h1>
        <p className="muted">No document is waiting for your signature right now.</p>
        <button type="button" className="primary" onClick={() => navigate('/sign')}>Back to documents</button>
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
          ? `With ${otherPeople(group[0], user.email) || 'no one else'}.`
          : `${group.length} copies of this file, one each for ${group.map((env) => otherPeople(env, user.email)).filter(Boolean).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).slice(0, 6).join('; ')}${group.length > 6 ? ` and ${group.length - 6} more` : ''}. They are the same document, and you sign each one.`}
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
                  className="queue-spot"
                  style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%`, width: `${f.w * 100}%`, height: `${f.h * 100}%` }}
                >
                  {(f.type === 'signature' || f.type === 'initials') && marks[f.type]
                    ? <img src={marks[f.type]!.dataUrl} alt="" />
                    : <em>{f.type === 'date' ? 'Date' : f.type === 'name' ? 'Name' : f.type === 'initials' ? 'Initials' : f.type === 'signature' ? 'Sign' : f.label || 'Field'}</em>}
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
          {finished && last && <button type="button" className="primary" onClick={() => navigate('/sign')}>Done</button>}
          {!finished && <button type="button" className="quiet" disabled={running} onClick={() => navigate('/sign')}>Not now</button>}
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
