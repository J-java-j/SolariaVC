import { useState, type FormEvent } from 'react';
import { useReveal } from '../hooks/useReveal';
import { SectionIntro } from './primitives';
import { submitContact, validateContact, type ContactKind } from '../lib/contactApi';
import { sectionSurface } from '../lib/sectionTheme';

type Kind = ContactKind;
const kinds: [Kind, string][] = [
  ['founder', 'A founder'],
  ['investor', 'An investor'],
  ['other', 'Someone else'],
];

const fieldClass =
  'mt-2 w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3.5 py-3 text-[18px] text-[var(--fg)] placeholder:text-[var(--fg-muted)] outline-none transition-colors focus:border-[color-mix(in_oklab,var(--accent-deep)_35%,var(--border-strong))] disabled:cursor-not-allowed disabled:opacity-50';

const labelClass = 'block text-[16px] font-medium text-[var(--fg)]';

export default function Contact() {
  const [ref, inView] = useReveal(0.08);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{
    kind: Kind;
    name: string;
    email: string;
    msg: string;
    website: string;
  }>({
    kind: 'founder',
    name: '',
    email: '',
    msg: '',
    website: '',
  });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const payload = {
      name: form.name,
      email: form.email,
      message: form.msg,
      kind: form.kind,
      website: form.website,
    };

    const validationError = validateContact(payload);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      await submitContact(payload);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      id="contact"
      data-theme="light"
      className={`relative scroll-mt-24 overflow-hidden ${sectionSurface.light}`}
    >
      <div
        ref={ref}
        className={`container-x section-py relative transition-all duration-700 ease-out ${
          inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
        }`}
      >
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <SectionIntro
              eyebrow="Contact"
              title="Tell us what you're building."
              description="We read every message and reply within two business days."
            />
          </div>

          <div className="lg:col-span-7">
            {sent ? (
              <div className="border-t border-[var(--border)] pt-10">
                <p className="text-[24px] font-medium text-[var(--fg)]">Thank you.</p>
                <p className="mt-3 text-body text-[var(--fg)]">We&apos;ll be in touch soon.</p>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="relative max-w-xl space-y-7" noValidate>
                <input
                  type="text"
                  name="website"
                  value={form.website}
                  onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="absolute left-0 top-0 h-px w-px overflow-hidden opacity-0 pointer-events-none"
                />

                <fieldset className="border-0 p-0">
                  <legend className={labelClass}>You are</legend>
                  <div className="mt-3 space-y-2.5">
                    {kinds.map(([id, label]) => (
                      <label
                        key={id}
                        className="flex cursor-pointer items-center gap-3 text-[17px] text-[var(--fg)] opacity-90 has-[:checked]:opacity-100"
                      >
                        <input
                          type="radio"
                          name="kind"
                          value={id}
                          checked={form.kind === id}
                          disabled={submitting}
                          onChange={() => setForm((f) => ({ ...f, kind: id }))}
                          className="h-4 w-4 shrink-0 accent-[var(--accent-deep)]"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div>
                  <label htmlFor="contact-name" className={labelClass}>
                    Name
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    value={form.name}
                    disabled={submitting}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className={fieldClass}
                  />
                </div>

                <div>
                  <label htmlFor="contact-email" className={labelClass}>
                    Email
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    value={form.email}
                    disabled={submitting}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className={fieldClass}
                  />
                </div>

                <div>
                  <label htmlFor="contact-message" className={labelClass}>
                    Message
                  </label>
                  <textarea
                    id="contact-message"
                    rows={4}
                    value={form.msg}
                    disabled={submitting}
                    onChange={(e) => setForm((f) => ({ ...f, msg: e.target.value }))}
                    placeholder="What you're building, in a sentence."
                    className={`${fieldClass} resize-y min-h-[6rem]`}
                  />
                </div>

                {error && (
                  <p className="text-[16px] text-[var(--fg)]" role="alert">
                    {error}
                  </p>
                )}

                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-pitch-nav rounded-md border px-6 py-3 text-[17px] font-medium transition-[background-color,border-color,color,opacity] duration-200 ease-out hover:!opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? 'Sending…' : 'Send message'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
