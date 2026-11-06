import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { ApiError, saveFile, signedFileName, signerApi, type Field, type Mark, type OtherField, type PageSize, type SignerSession } from './api';
import { openPdf, type PdfDocument } from './pdf';
import { PdfPages } from './PdfPages';
import { Link } from './router';
import { Seal } from './Seal';
import { SignaturePad } from './SignaturePad';
import { Loading, Notice, PageMessage, Sheet, Wordmark, useBusy } from './ui';

type SignerApi = ReturnType<typeof signerApi>;

const FLAG: Record<string, string> = { signature: 'Sign', initials: 'Initial', text: 'Fill in', checkbox: 'Check' };
// Wide enough for the flag to sit beside its field. Closer to the edge it sits above.
const FLAG_ROOM = 76;

const box = (f: Pick<Field, 'x' | 'y' | 'w' | 'h'>): CSSProperties => ({
  left: `${f.x * 100}%`,
  top: `${f.y * 100}%`,
  width: `${f.w * 100}%`,
  height: `${f.h * 100}%`,
});

// Matches how the sealed PDF sizes its text, so the page looks the same afterwards.
const fieldText = (f: Pick<Field, 'h'>, size: PageSize, cssWidth: number) => ({
  fontSize: Math.min(f.h * size.height * 0.72, 14) * (cssWidth / size.width),
});

const longDate = () => new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(new Date());

function CodeGate({ session, signer, onVerified }: { session: SignerSession; signer: SignerApi; onVerified: (secret: string) => void }) {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const { busy, error, run, setError } = useBusy();

  const send = () => run(async () => {
    await signer.sendCode();
    setSent(true);
    setCode('');
  });
  const verify = (e: FormEvent) => {
    e.preventDefault();
    run(async () => onVerified((await signer.verifyCode(code)).verified));
  };

  return (
    <PageMessage title="Confirm it's you">
      <p>{session.sender.name} at {session.org} sent you a document. To open it, enter the code we email to {session.maskedEmail}.</p>
      {!sent && <button type="button" className="primary" disabled={busy} onClick={send}>{busy ? 'Sending' : 'Email me a code'}</button>}
      {sent && (
        <form onSubmit={verify} className="stack">
          <label className="field">
            6-digit code
            <input
              className="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
              value={code}
              onChange={(e) => {
                setError('');
                setCode(e.target.value.replace(/\D/g, ''));
              }}
            />
          </label>
          {error && <Notice>{error}</Notice>}
          <button className="primary" disabled={busy || code.length !== 6}>{busy ? 'Checking' : 'Continue'}</button>
          <button type="button" className="quiet" disabled={busy} onClick={send}>Email a new code</button>
        </form>
      )}
      {!sent && error && <Notice>{error}</Notice>}
    </PageMessage>
  );
}

function Consent({ session, signer, doc, failed, onAgree, onAction }: {
  session: SignerSession;
  signer: SignerApi;
  doc: PdfDocument | null;
  failed: boolean;
  onAgree: () => void;
  onAction: (sheet: 'paper' | 'decline') => void;
}) {
  const [shown, setShown] = useState(false);
  const [broken, setBroken] = useState(false);
  const recorded = useRef(false);
  const { busy, error, run } = useBusy();
  const disclosure = session.disclosure!;
  const unreadable = failed || broken;

  // Consent has to rest on this document having displayed on this device.
  const rendered = useCallback(() => {
    if (recorded.current) return;
    recorded.current = true;
    signer.viewed().then(() => setShown(true)).catch(() => {
      recorded.current = false;
      setBroken(true);
    });
  }, [signer]);

  const agree = () => run(async () => {
    await signer.consent(disclosure.version);
    onAgree();
  });

  return (
    <>
    <header className="bar">
      <Wordmark />
      <span className="bar-user bar-from">From {session.sender.name}, {session.org}</span>
    </header>
    <div className="consent">
      <aside className="consent-preview">
        <p className="consent-caption">{session.title}, page 1</p>
        <div className="consent-window">
          {doc && <PdfPages doc={doc} sizes={session.sizes!} limit={1} onRendered={rendered} onError={() => setBroken(true)} />}
          {!doc && !failed && <p className="loading" role="status">Opening the document</p>}
          {unreadable && <Notice>This document can't be displayed on this device, so it can't be signed here. Try another device, or choose I need paper instead.</Notice>}
        </div>
      </aside>
      <article className="consent-text">
        <h1>{disclosure.title}</h1>
        <div className="legal">
          <p>{disclosure.intro}</p>
          {disclosure.sections.map((section) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              <p>{section.body}</p>
            </section>
          ))}
        </div>
        <div className="consent-agree">
          <p className="legal">{disclosure.agreement}</p>
          {error && <Notice>{error}</Notice>}
          <div className="actions">
            <button type="button" className="primary" disabled={!shown || busy} onClick={agree}>{busy ? 'Saving' : 'Agree and continue'}</button>
            <button type="button" className="secondary" onClick={() => onAction('paper')}>I need paper instead</button>
            <button type="button" className="quiet" onClick={() => onAction('decline')}>Decline</button>
          </div>
        </div>
      </article>
    </div>
    </>
  );
}

function OtherMark({ field, size, cssWidth }: { field: OtherField; size: PageSize; cssWidth: number }) {
  return (
    <div className="placed" style={box(field)}>
      {field.image && <img src={field.image} alt="" />}
      {field.type === 'checkbox' && field.value === true && <span className="tick" aria-label="Checked" />}
      {typeof field.value === 'string' && <span style={fieldText(field, size, cssWidth)}>{field.value}</span>}
    </div>
  );
}

function DocumentRoom({ session, signer, doc, failed, onDone, onAction }: {
  session: SignerSession;
  signer: SignerApi;
  doc: PdfDocument | null;
  failed: boolean;
  onDone: (next: SignerSession) => void;
  onAction: (sheet: 'paper' | 'decline') => void;
}) {
  const fields = session.fields!;
  // An "Email" blank starts with the address this link was sent to; the signer can change it.
  const [values, setValues] = useState<Record<string, string | boolean>>(() => Object.fromEntries(fields
    .filter((f) => f.type === 'text' && /e-?mail/i.test(f.label) && session.recipient?.email)
    .map((f) => [f.id, session.recipient!.email])));
  const [placed, setPlaced] = useState<Set<string>>(new Set());
  const [marks, setMarks] = useState<{ signature?: Mark; initials?: Mark }>({});
  const [adopting, setAdopting] = useState<Field | null>(null);
  const [typing, setTyping] = useState<Field | null>(null);
  const [draft, setDraft] = useState('');
  const [finishing, setFinishing] = useState(false);
  const [arrived, setArrived] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const { busy, error, run } = useBusy();
  const room = useRef<HTMLDivElement>(null);

  const steps = useMemo(() => fields
    .filter((f) => f.type in FLAG)
    .sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x), [fields]);

  const done = (f: Field) => (f.type === 'text' ? Boolean(values[f.id]) : f.type === 'checkbox' ? values[f.id] === true : placed.has(f.id));
  const required = steps.filter((f) => f.required);
  const left = required.filter((f) => !done(f));
  const current = steps.find((f) => f.required && !done(f)) ?? null;
  const name = marks.signature?.name ?? session.recipient!.name;

  useEffect(() => {
    if (!placed.size) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [placed.size]);

  const goTo = (f: Field) => {
    room.current?.querySelector(`[data-field="${f.id}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setArrived(f.id);
  };

  const place = (f: Field) => setPlaced((prior) => new Set(prior).add(f.id));

  const act = (f: Field) => {
    if (f.type === 'checkbox') {
      setValues((prior) => ({ ...prior, [f.id]: prior[f.id] !== true }));
    } else if (f.type === 'text') {
      setDraft(String(values[f.id] ?? ''));
      setTyping(f);
    } else if (placed.has(f.id)) {
      setPlaced((prior) => {
        const next = new Set(prior);
        next.delete(f.id);
        return next;
      });
    } else if (marks[f.type as 'signature' | 'initials']) {
      place(f);
    } else {
      setAdopting(f);
    }
  };

  const redo = () => {
    setPlaced((prior) => new Set([...prior].filter((id) => fields.find((f) => f.id === id)?.type !== 'signature')));
    setMarks((prior) => ({ ...prior, signature: undefined }));
  };

  const submit = () => run(async () => {
    const needsInitials = fields.some((f) => f.type === 'initials');
    onDone(await signer.submit({
      intent: true,
      values,
      signature: marks.signature,
      ...(needsInitials ? { initials: marks.initials } : {}),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }));
  });

  const overlay = (page: number, size: PageSize, cssWidth: number) => (
    <>
      {session.others!.filter((f) => f.page === page).map((f) => <OtherMark key={f.id} field={f} size={size} cssWidth={cssWidth} />)}
      {fields.filter((f) => f.page === page).map((f) => {
        if (f.type === 'date' || f.type === 'name') {
          return (
            <div key={f.id} className="placed placed-auto" style={box(f)}>
              <span style={fieldText(f, size, cssWidth)}>{f.type === 'date' ? longDate() : name}</span>
            </div>
          );
        }
        const mark = marks[f.type as 'signature' | 'initials'];
        const filled = done(f);
        const isCurrent = current?.id === f.id;
        const beside = f.x * cssWidth >= FLAG_ROOM;
        return (
          <button
            key={f.id}
            type="button"
            data-field={f.id}
            className={`spot spot-${f.type}${filled ? ' spot-done' : ''}${f.required ? '' : ' spot-optional'}`}
            style={box(f)}
            aria-label={`${f.label || FLAG[f.type]}, page ${page}${filled ? ', done' : ''}${f.required ? '' : ', optional'}`}
            onClick={() => act(f)}
          >
            {filled && mark && placed.has(f.id) && <img className="ink" src={mark.dataUrl} alt="" />}
            {f.type === 'text' && filled && <span style={fieldText(f, size, cssWidth)}>{String(values[f.id])}</span>}
            {f.type === 'text' && !filled && f.label && <span className="spot-hint" style={fieldText(f, size, cssWidth)}>{f.label}</span>}
            {f.type === 'checkbox' && filled && <span className="tick" />}
            {isCurrent && <span className={beside ? 'flag' : 'flag flag-above'}>{FLAG[f.type]}</span>}
          </button>
        );
      })}
    </>
  );

  const saveText = (e: FormEvent) => {
    e.preventDefault();
    setValues((prior) => ({ ...prior, [typing!.id]: draft.trim() }));
    setTyping(null);
  };

  return (
    <div className="room" ref={room}>
      <header className="bar bar-sticky">
        <Wordmark />
        <button type="button" className="quiet on-desk room-more" aria-expanded={menu} onClick={() => setMenu(!menu)}>More</button>
        <span className={menu ? 'room-menu room-menu-open' : 'room-menu'}>
          <button type="button" className="quiet" onClick={async () => saveFile(await signer.document(), session.fileName!)}>Download</button>
          <button type="button" className="quiet" onClick={() => onAction('paper')}>I need paper instead</button>
          <button type="button" className="quiet" onClick={() => onAction('decline')}>Decline</button>
        </span>
      </header>

      <div className="room-intro">
        <h1>{session.title}</h1>
        <p>From {session.sender.name}, {session.org}</p>
        {session.message && <p className="legal letter">{session.message}</p>}
      </div>

      {failed && <PageMessage title="This document can't be displayed on this device">
        <p>Try another device, or choose I need paper instead.</p>
      </PageMessage>}
      {!doc && !failed && <p className="loading" role="status">Opening the document</p>}
      {doc && <PdfPages doc={doc} sizes={session.sizes!} overlay={overlay} />}

      <footer className="tray">
        <div className="tray-status">
          <span>{left.length ? `${required.length - left.length} of ${required.length} done` : 'Ready to sign'}</span>
          {marks.signature && <button type="button" className="quiet on-desk" onClick={redo}>Redo signature</button>}
        </div>
        {!current && <button type="button" className="primary" onClick={() => setFinishing(true)}>Finish and sign</button>}
        {current && arrived === current.id && <button type="button" className="primary" onClick={() => act(current)}>{FLAG[current.type]}</button>}
        {current && arrived !== current.id && (
          <button type="button" className="primary" onClick={() => goTo(current)}>{arrived ? 'Next' : 'Start'}</button>
        )}
      </footer>

      {adopting && (
        <SignaturePad
          kind={adopting.type as 'signature' | 'initials'}
          name={name}
          intent={session.intent!.adopt}
          onCancel={() => setAdopting(null)}
          onAdopt={(mark) => {
            setMarks((prior) => ({ ...prior, [adopting.type]: mark }));
            place(adopting);
            setAdopting(null);
          }}
        />
      )}

      {typing && (
        <Sheet title={typing.label || 'Fill in this field'} onClose={() => setTyping(null)}>
          <form onSubmit={saveText} className="stack">
            <label className="field">
              Your answer
              <input autoFocus maxLength={500} value={draft} required={typing.required} onChange={(e) => setDraft(e.target.value)} />
            </label>
            <div className="actions">
              <button className="primary">Save</button>
              <button type="button" className="quiet" onClick={() => setTyping(null)}>Cancel</button>
            </div>
          </form>
        </Sheet>
      )}

      {finishing && (
        <Sheet title="Finish and sign" onClose={busy ? undefined : () => setFinishing(false)}>
          <p className="legal">{session.intent!.finish}</p>
          {error && <Notice>{error}</Notice>}
          <div className="actions">
            <button type="button" className="primary" disabled={busy} onClick={submit}>{busy ? 'Signing' : 'Finish and sign'}</button>
            <button type="button" className="quiet" disabled={busy} onClick={() => setFinishing(false)}>Back to the document</button>
          </div>
          {busy && <p className="muted" role="status">Recording your signature. This can take a few seconds.</p>}
        </Sheet>
      )}
    </div>
  );
}

function ActionSheet({ kind, session, signer, onClose, onDone }: {
  kind: 'paper' | 'decline';
  session: SignerSession;
  signer: SignerApi;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const { busy, error, run } = useBusy();
  const paper = kind === 'paper';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      await signer.decline({ reason, paper });
      onDone();
    });
  };

  return (
    <Sheet title={paper ? 'Ask for paper instead' : 'Decline to sign'} onClose={onClose}>
      <p>
        {paper
          ? `This ends electronic signing for this document. ${session.sender.name} will arrange a paper copy, at no cost to you.`
          : `This ends signing for everyone, and ${session.sender.name} will see your reason.`}
      </p>
      <form onSubmit={submit} className="stack">
        <label className="field">
          {paper ? 'Note for the sender (optional)' : 'Reason'}
          <textarea rows={3} maxLength={500} required={!paper} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        {error && <Notice>{error}</Notice>}
        <div className="actions">
          <button className="danger" disabled={busy}>{busy ? 'Sending' : paper ? 'Ask for paper' : 'Decline'}</button>
          <button type="button" className="quiet" onClick={onClose}>Keep this open</button>
        </div>
      </form>
    </Sheet>
  );
}

function Completed({ session, signer, strike }: { session: SignerSession; signer: SignerApi; strike: boolean }) {
  const { busy, error, run } = useBusy();
  const download = () => run(async () => saveFile(await signer.sealed(), signedFileName(session.title ?? 'Document')));
  // Someone back on a code link after their code lapsed still has their emailed copy.
  const canDownload = Boolean(session.sha256);

  return (
    <div className="desk-center">
      <div className={strike ? 'finished finished-struck' : 'finished'}>
        <Seal reference={session.reference} strike={strike} />
        <div className="note note-sealed">
          <h1>Signed and sealed</h1>
          <p>
            Everyone has signed{session.title ? ` "${session.title}"` : ''}. A copy with its
            certificate is {canDownload ? 'also ' : ''}in your email.
          </p>
          {canDownload && <button type="button" className="primary" disabled={busy} onClick={download}>{busy ? 'Preparing' : 'Download signed copy'}</button>}
          {error && <Notice>{error}</Notice>}
          <dl className="facts">
            <dt>Reference</dt>
            <dd>{session.reference}</dd>
            {session.sha256 && <dt>SHA-256</dt>}
            {session.sha256 && <dd className="hash">{session.sha256}</dd>}
          </dl>
          <Link to="/sign/verify" className="link">Check a signed copy</Link>
          <a className="link" href="/sign">See all your documents</a>
        </div>
      </div>
    </div>
  );
}

function Sealing({ session, signer, onUpdate }: { session: SignerSession; signer: SignerApi; onUpdate: (next: SignerSession) => void }) {
  const { busy, error, run } = useBusy();
  const retry = useCallback(() => run(async () => onUpdate(await signer.finish())), [signer]);
  useEffect(() => {
    retry();
  }, [retry]);

  return (
    <PageMessage title="Sealing the document">
      <p>Everyone has signed{session.title ? ` "${session.title}"` : ''}. All signatures are saved while we finish sealing it.</p>
      {error && <Notice>{error}</Notice>}
      <button type="button" className="primary" disabled={busy} onClick={retry}>{busy ? 'Sealing' : 'Check again'}</button>
    </PageMessage>
  );
}

const CLOSED: Partial<Record<SignerSession['state'], (s: SignerSession) => [string, string]>> = {
  voided: (s) => ['This document was withdrawn', `${s.sender.name} withdrew it, so it can no longer be signed.`],
  expired: (s) => ['This signing link has expired', `Ask ${s.sender.name} to send the document again.`],
  declined: (s) => ['This document was declined', `Signing has ended. ${s.sender.name} has been told.`],
  unavailable: (s) => ['There is nothing to sign here', `If you expected a document, ask ${s.sender.name} to send it again.`],
  waiting: (s) => ["It isn't your turn yet", `We'll email you when ${s.title ? `"${s.title}"` : 'the document'} is ready for your signature.`],
  signed: (s) => ['You have signed', `We'll email your copy of ${s.title ? `"${s.title}"` : 'the document'} when everyone has signed.`],
};

export default function Signer() {
  const token = window.location.hash.slice(1);
  const storageKey = `solaria-sign:${token.split('.')[1] ?? ''}`;
  const verified = useRef<string | null>(null);
  if (verified.current === null) {
    try {
      verified.current = window.sessionStorage.getItem(storageKey);
    } catch {
      verified.current = null;
    }
  }
  const signer = useMemo(() => signerApi(token, () => verified.current), [token]);
  const [session, setSession] = useState<SignerSession | null>(null);
  const [error, setError] = useState('');
  const [doc, setDoc] = useState<PdfDocument | null>(null);
  const [failed, setFailed] = useState(false);
  const [consented, setConsented] = useState(false);
  const [sheet, setSheet] = useState<'paper' | 'decline' | null>(null);
  const [outcome, setOutcome] = useState<'paper' | 'decline' | null>(null);
  const [strike, setStrike] = useState(false);

  const load = useCallback(() => {
    signer.session().then(setSession).catch((e: ApiError) => setError(e.message));
  }, [signer]);
  useEffect(load, [load]);

  // Each state is a different page, so none should open at the last one's scroll.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [session?.state]);

  const signing = session?.state === 'sign';
  useEffect(() => {
    if (!signing) return;
    let cancelled = false;
    let opened: PdfDocument | null = null;
    signer.document().then(openPdf).then((pdf) => {
      opened = pdf;
      if (cancelled) pdf.destroy();
      else setDoc(pdf);
    }).catch(() => setFailed(true));
    return () => {
      cancelled = true;
      opened?.destroy();
    };
  }, [signer, signing]);

  if (!token) return <PageMessage title="This signing link is not valid"><p>Open the link from your email, or ask the sender for a new one.</p></PageMessage>;
  if (error) return <PageMessage title="This link can't be opened"><p>{error}</p></PageMessage>;
  if (!session) return <Loading />;

  if (outcome) {
    return (
      <PageMessage title={outcome === 'paper' ? 'Your request is with the sender' : 'You declined this document'}>
        <p>{outcome === 'paper'
          ? `${session.sender.name} will arrange a paper copy with you. Nothing more is needed here.`
          : `${session.sender.name} has been told, and signing has ended.`}</p>
      </PageMessage>
    );
  }

  if (session.state === 'code') {
    return (
      <CodeGate
        session={session}
        signer={signer}
        onVerified={(secret) => {
          verified.current = secret;
          try {
            window.sessionStorage.setItem(storageKey, secret);
          } catch {
            // Without storage a reload just asks for a new code.
          }
          load();
        }}
      />
    );
  }

  if (session.state === 'completed') return <Completed session={session} signer={signer} strike={strike} />;
  if (session.state === 'sealing') {
    return (
      <Sealing
        session={session}
        signer={signer}
        onUpdate={(next) => {
          setStrike(next.state === 'completed');
          setSession(next);
        }}
      />
    );
  }
  const closed = CLOSED[session.state];
  if (closed) {
    const [title, body] = closed(session);
    return <PageMessage title={title}><p>{body}</p><a className="link" href="/sign">See all your documents</a></PageMessage>;
  }

  const stage = session.needsConsent && !consented
    ? <Consent session={session} signer={signer} doc={doc} failed={failed} onAgree={() => setConsented(true)} onAction={setSheet} />
    : (
      <DocumentRoom
        session={session}
        signer={signer}
        doc={doc}
        failed={failed}
        onAction={setSheet}
        onDone={(next) => {
          setStrike(next.state === 'completed');
          setSession(next);
        }}
      />
    );

  return (
    <>
      {stage}
      {sheet && <ActionSheet kind={sheet} session={session} signer={signer} onClose={() => setSheet(null)} onDone={() => setOutcome(sheet)} />}
    </>
  );
}
