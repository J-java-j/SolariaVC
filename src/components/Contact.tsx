import { useState, type FormEvent } from 'react';
import { useReveal } from '../hooks/useReveal';
import { Eyebrow, SectionTitle } from './primitives';

type Kind = 'investor' | 'founder' | 'research';
const kinds: [Kind, string][] = [
  ['investor', 'Investor'],
  ['founder', 'Founder'],
  ['research', 'Research'],
];

const kindToServerKind: Record<Kind, string> = {
  investor: 'fund',
  founder: 'ventures',
  research: 'research',
};

export default function Contact() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<{ kind: Kind; name: string; email: string; msg: string }>({
    kind: 'investor',
    name: '',
    email: '',
    msg: '',
  });
  const [revealRef, inView] = useReveal(0.1);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: kindToServerKind[form.kind],
          name: form.name.trim(),
          email: form.email.trim(),
          organization: '',
          message: form.msg.trim(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error || `Request failed (${res.status})`);
        setBusy(false);
        return;
      }
      setSent(true);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="contact" className="relative border-t border-line">
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{ background: 'radial-gradient(circle at 70% 50%, rgba(var(--accent-rgb), 0.18), transparent 60%)' }}
      />
      <div className="relative mx-auto max-w-[1400px] px-5 py-20 sm:px-10 sm:py-32 lg:px-16 lg:py-40">
        <div className="grid gap-10 sm:gap-16 lg:grid-cols-2">
          <div
            ref={revealRef}
            className={`transition-all duration-1000 ${
              inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}
          >
            <Eyebrow>Contact</Eyebrow>
            <SectionTitle className="mt-5">Open the channel.</SectionTitle>
            <p className="mt-6 max-w-xl text-[15.5px] sm:text-[17px] leading-relaxed text-fg-muted">
              Investor inquiries, founder pitches, and research collaborations all land in the same
              partner inbox. Short notes welcome — we'd rather reply to a paragraph than skim a deck.
            </p>
            <dl className="mt-10 space-y-4 max-w-md">
              {(
                [
                  ['Response', '≤ 2 business days'],
                  ['Headquarters', 'La Jolla, California'],
                  ['Entity', 'Solaria Capital, LLC'],
                  ['Status', 'Vintage 2026 · open'],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between border-b border-line pb-3">
                  <dt className="font-mono text-[9.5px] tracking-[0.22em] uppercase text-fg-faint">{k}</dt>
                  <dd className="font-mono text-[13px] text-fg tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div>
            {sent ? (
              <div className="rounded-2xl border border-line-strong bg-fg-b p-12 text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[rgba(var(--accent-rgb),0.15)] ring-1 ring-[rgba(var(--accent-rgb),0.3)]">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-strong">
                    <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="mt-5 font-display text-[2rem] text-fg">Thank you.</div>
                <div className="mt-2 text-fg-muted text-[14px]">A partner will reply within two business days.</div>
              </div>
            ) : (
              <form
                onSubmit={onSubmit}
                className="rounded-2xl border border-line bg-fg-b backdrop-blur-sm p-5 sm:p-8 space-y-5"
              >
                <div>
                  <div className="font-mono text-[9.5px] tracking-[0.22em] uppercase text-fg-faint">
                    I'm reaching out as
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {kinds.map(([id, l]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, kind: id }))}
                        className={`rounded-full px-4 py-2 text-[12.5px] transition-all ${
                          form.kind === id
                            ? 'bg-[rgba(var(--accent-rgb),0.12)] text-accent-strong ring-1 ring-[rgba(var(--accent-rgb),0.30)]'
                            : 'border border-line bg-fg-b text-fg-muted hover:border-line-strong'
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <Field
                  label="Name"
                  value={form.name}
                  onChange={(v) => setForm((f) => ({ ...f, name: v }))}
                  required
                />
                <Field
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(v) => setForm((f) => ({ ...f, email: v }))}
                  required
                />
                <div>
                  <label className="font-mono text-[9.5px] tracking-[0.22em] uppercase text-fg-faint">
                    Message
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={form.msg}
                    onChange={(e) => setForm((f) => ({ ...f, msg: e.target.value }))}
                    placeholder="A paragraph is plenty."
                    className="mt-2 w-full rounded-md border border-line bg-fg-a px-3 py-2.5 text-[14px] text-fg placeholder:text-fg-faint outline-none focus:border-line-strong resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="group inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-[13px] font-semibold hover:opacity-90 glow-accent transition-all disabled:opacity-70"
                >
                  {busy ? 'Sending…' : 'Send'} <span className="transition-transform group-hover:translate-x-0.5">→</span>
                </button>
                {error && (
                  <div role="alert" className="rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                    {error}
                  </div>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="font-mono text-[9.5px] tracking-[0.22em] uppercase text-fg-faint">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-md border border-line bg-fg-a px-3 py-2.5 text-[14px] text-fg outline-none focus:border-line-strong"
      />
    </div>
  );
}
