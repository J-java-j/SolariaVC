import { useState, type FormEvent } from 'react';

type Kind = 'fund' | 'ventures' | 'research' | 'other';

const kinds: { value: Kind; label: string; hint: string }[] = [
  { value: 'fund', label: 'Medallion Fund', hint: 'Investor · prospectus' },
  { value: 'ventures', label: 'Ventures', hint: 'Founder · pitch' },
  { value: 'research', label: 'Research', hint: 'Collaborate · subscribe' },
  { value: 'other', label: 'Other', hint: 'Press, partnerships, etc.' },
];

type Props = {
  defaultKind?: Kind;
  compact?: boolean;
};

export default function ContactForm({ defaultKind = 'fund', compact = false }: Props) {
  const [kind, setKind] = useState<Kind>(defaultKind);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('sending');
    setErrorMsg(null);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          organization: organization.trim(),
          message: message.trim(),
          kind,
          website, // honeypot
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus('error');
        setErrorMsg(body?.error || `Request failed (${res.status})`);
        return;
      }
      setStatus('sent');
    } catch {
      setStatus('error');
      setErrorMsg('Network error — please try again.');
    }
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setOrganization('');
    setMessage('');
    setStatus('idle');
    setErrorMsg(null);
  };

  if (status === 'sent') {
    return <SuccessPanel onSendAnother={resetForm} />;
  }

  return (
    <form onSubmit={onSubmit} className="relative" noValidate>
      {/* honeypot — kept off-screen from users, bots fill it */}
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden>
        <label>
          Website
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>

      <div className="mb-5">
        <FieldLabel>Inquiry</FieldLabel>
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
          {kinds.map((k) => {
            const active = kind === k.value;
            return (
              <button
                type="button"
                key={k.value}
                onClick={() => setKind(k.value)}
                aria-pressed={active}
                className={`group rounded-lg border px-3 py-2.5 text-left transition-all ${
                  active
                    ? 'border-moss-500/60 bg-moss-500/10 ring-1 ring-moss-500/40'
                    : 'border-white/10 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.04]'
                }`}
              >
                <div
                  className={`text-sm font-medium ${
                    active ? 'text-moss-100' : 'text-white/85'
                  }`}
                >
                  {k.label}
                </div>
                <div className="mt-0.5 text-[10.5px] text-white/45">{k.hint}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="cf-name"
          label="Name"
          required
          value={name}
          onChange={setName}
          placeholder="Jane Doe"
          autoComplete="name"
        />
        <Field
          id="cf-email"
          type="email"
          label="Email"
          required
          value={email}
          onChange={setEmail}
          placeholder="jane@firm.com"
          autoComplete="email"
        />
      </div>

      {!compact && (
        <div className="mt-4">
          <Field
            id="cf-org"
            label="Organization"
            value={organization}
            onChange={setOrganization}
            placeholder="Firm or organization"
            optional
            autoComplete="organization"
          />
        </div>
      )}

      <div className="mt-4">
        <FieldLabel htmlFor="cf-msg">Message</FieldLabel>
        <textarea
          id="cf-msg"
          required
          rows={compact ? 3 : 5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={placeholderForKind(kind)}
          className="mt-2 w-full resize-none rounded-lg border border-white/10 bg-ink-950/70 px-3.5 py-3 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-moss-500/60 focus:ring-1 focus:ring-moss-500/30"
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <button
          type="submit"
          disabled={status === 'sending'}
          className="inline-flex min-w-[170px] items-center justify-center gap-2 rounded-md bg-moss-500 px-5 py-3 text-sm font-semibold text-ink-950 transition-all hover:bg-moss-400 hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 glow-moss"
        >
          {status === 'sending' ? (
            <>
              <Spinner />
              Sending
            </>
          ) : (
            <>
              Send message
              <span aria-hidden>→</span>
            </>
          )}
        </button>
        <div className="text-[11px] text-white/45">
          We respond within two business days.
          <br className="sm:hidden" /> Private and never shared.
        </div>
      </div>

      {status === 'error' && errorMsg && (
        <div
          role="alert"
          className="mt-4 rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
        >
          {errorMsg}
        </div>
      )}
    </form>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
  optional,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  optional?: boolean;
  autoComplete?: string;
}) {
  return (
    <div>
      <FieldLabel htmlFor={id} optional={optional}>
        {label}
      </FieldLabel>
      <input
        id={id}
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="mt-2 w-full rounded-lg border border-white/10 bg-ink-950/70 px-3.5 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-moss-500/60 focus:ring-1 focus:ring-moss-500/30"
      />
    </div>
  );
}

function FieldLabel({
  children,
  htmlFor,
  optional,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  optional?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.18em] text-white/55"
    >
      <span>{children}</span>
      {optional && <span className="text-white/30 normal-case tracking-normal">optional</span>}
    </label>
  );
}

function Spinner() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      className="animate-spin"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <path d="M12 2 A 10 10 0 0 1 22 12" />
    </svg>
  );
}

function SuccessPanel({ onSendAnother }: { onSendAnother: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-moss-500/30 bg-gradient-to-br from-moss-500/10 via-moss-500/5 to-transparent p-8 text-center animate-rise">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-moss-500/15 ring-1 ring-moss-500/40">
        <CheckCircle />
      </div>
      <h3 className="mt-5 font-display text-2xl">Message received.</h3>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/70">
        Thank you for reaching out to Solaria. A partner will review your inquiry and respond
        within two business days.
      </p>
      <button
        onClick={onSendAnother}
        className="mt-6 inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-medium text-white/80 transition-colors hover:bg-white/[0.08] hover:text-white"
      >
        Send another <span aria-hidden>→</span>
      </button>
    </div>
  );
}

function CheckCircle() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#34d399"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12l4 4L19 6" />
    </svg>
  );
}

function placeholderForKind(kind: Kind): string {
  switch (kind) {
    case 'fund':
      return 'Briefly: accredited status, indicative commitment, any questions about strategy or terms.';
    case 'ventures':
      return 'What are you building, who is on the team, what are you raising, and why now?';
    case 'research':
      return 'A hypothesis to collaborate on, a dataset to explore, or a note you want early.';
    default:
      return 'Tell us a bit about yourself and what you have in mind.';
  }
}
