import { useState, type FormEvent } from 'react';
import { useReveal } from '../hooks/useReveal';
import { Eyebrow } from './primitives';

type Kind = 'founder' | 'investor' | 'other';
const kinds: [Kind, string][] = [
  ['founder', 'A founder'],
  ['investor', 'An investor'],
  ['other', 'Someone else'],
];

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="font-mono text-[10px] tracking-[0.22em] uppercase text-[var(--ink-faint)]">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-3 w-full bg-transparent border-b border-[var(--ink-rule)] px-0 py-3 text-[18px] text-[var(--ink)] outline-none focus:border-[var(--moss)] transition-colors"
      />
    </div>
  );
}

export default function Contact() {
  const [ref, inView] = useReveal();
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState<{ kind: Kind; email: string; msg: string }>({
    kind: 'founder',
    email: '',
    msg: '',
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <section id="contact" className="relative">
      <div
        ref={ref}
        className={`mx-auto max-w-[1320px] px-6 py-32 sm:px-10 sm:py-44 lg:px-14 lg:py-56 transition-all duration-1000 ${
          inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <div className="grid gap-16 lg:grid-cols-12 lg:gap-20">
          <div className="lg:col-span-5">
            <Eyebrow num="§ 05">Contact</Eyebrow>
            <h2 className="editorial-h mt-10 text-[2.6rem] sm:text-[3.8rem] lg:text-[4.6rem] leading-[1.02]">
              Tell us
              <br />
              <span style={{ color: 'var(--moss)' }}>
                what you're
                <br />
                building.
              </span>
            </h2>
            <p className="mt-10 max-w-[36ch] text-[15.5px] leading-[1.6] text-[var(--ink-soft)]">
              We read every message. We reply within two business days.
            </p>
          </div>

          <div className="lg:col-span-7 lg:pl-10">
            {sent ? (
              <div className="py-20">
                <div className="editorial-h text-[2.6rem] leading-[1.1]">Thank you.</div>
                <p className="mt-4 text-[15.5px] text-[var(--ink-soft)]">
                  We'll be in touch soon.
                </p>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-12">
                <div>
                  <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[var(--ink-faint)]">
                    I am
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {kinds.map(([id, label]) => {
                      const active = form.kind === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, kind: id }))}
                          className={`rounded-full border px-4 py-2 text-[13.5px] transition-all ${
                            active
                              ? 'border-[var(--moss)] text-[var(--bg)]'
                              : 'border-[var(--ink-line)] text-[var(--ink-soft)] hover:border-[var(--ink-rule)] hover:text-[var(--ink)]'
                          }`}
                          style={active ? { background: 'var(--moss)' } : undefined}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Field
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(v) => setForm((f) => ({ ...f, email: v }))}
                />

                <div>
                  <label className="font-mono text-[10px] tracking-[0.22em] uppercase text-[var(--ink-faint)]">
                    In one line
                  </label>
                  <textarea
                    rows={3}
                    value={form.msg}
                    onChange={(e) => setForm((f) => ({ ...f, msg: e.target.value }))}
                    placeholder="What you're building, in a sentence."
                    className="mt-3 w-full resize-none border-b border-[var(--ink-rule)] bg-transparent px-0 py-3 text-[18px] text-[var(--ink)] placeholder-[var(--ink-faint)] outline-none transition-colors focus:border-[var(--moss)]"
                  />
                </div>

                <button type="submit" className="cta-arrow group text-[15px]">
                  <span className="line" />
                  <span className="ulink-rev text-[var(--moss)]">Send</span>
                  <span className="text-[var(--moss)] transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
