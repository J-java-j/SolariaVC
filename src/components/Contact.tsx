import { useState, type FormEvent } from 'react';
import { useReveal } from '../hooks/useReveal';
import { SectionIntro } from './primitives';
import Button from './ui/Button';
import { submitContact, validateContact, type ContactKind } from '../lib/contactApi';
import { sectionSurface } from '../lib/sectionTheme';

type Kind = ContactKind;
const kindOptions: [Kind, string][] = [
  ['founder', 'A founder'],
  ['investor', 'An investor'],
  ['other', 'Someone else'],
];

const fieldClass = 'field';

const labelClass = 'field-label';

export default function Contact() {
  const [ref, inView] = useReveal(0.08);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{
    kinds: Kind[];
    name: string;
    email: string;
    msg: string;
    website: string;
  }>({
    kinds: ['founder'],
    name: '',
    email: '',
    msg: '',
    website: '',
  });

  const toggleKind = (id: Kind, checked: boolean) =>
    setForm((f) => ({
      ...f,
      kinds: checked ? [...f.kinds, id] : f.kinds.filter((k) => k !== id),
    }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // The API takes one kind (it sets the email subject), so extra selections ride in the message.
    const selected = kindOptions.filter(([id]) => form.kinds.includes(id));
    const payload = {
      name: form.name,
      email: form.email,
      message: form.msg,
      kind: selected[0]?.[0] ?? 'other',
      website: form.website,
    };

    const validationError = selected.length
      ? validateContact(payload)
      : 'Please choose at least one option under “You are.”';
    if (validationError) {
      setError(validationError);
      return;
    }

    if (selected.length > 1) {
      payload.message = `You are: ${selected.map(([, label]) => label).join(', ')}\n\n${form.msg.trim()}`;
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
      className={`relative scroll-mt-20 overflow-hidden ${sectionSurface.light}`}
    >
      <div ref={ref} className={`container-x section-py relative reveal ${inView ? 'is-in' : ''}`}>
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-28">
              <SectionIntro
                eyebrow="Contact"
                title="Tell us what you're building."
                description="We read every message and reply within two business days."
              />
            </div>
          </div>

          <div className="lg:col-span-7">
            {sent ? (
              <div className="border-t border-[var(--border-strong)] pt-8 sm:pt-10" role="status">
                <p className="font-serif text-[2rem] font-semibold tracking-[-0.02em] text-[var(--heading-ink)]">Thank you.</p>
                <p className="mt-3 text-body text-[var(--fg)]">We&apos;ll be in touch soon.</p>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="contact-form relative" noValidate>
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

                <fieldset className="contact-form__wide border-0 p-0">
                  <legend className={labelClass}>You are</legend>
                  <div className="mt-2 flex flex-col sm:flex-row sm:flex-wrap sm:gap-x-9">
                    {kindOptions.map(([id, label]) => (
                      <label key={id} className="choice">
                        <input
                          type="checkbox"
                          name="kind"
                          value={id}
                          checked={form.kinds.includes(id)}
                          disabled={submitting}
                          onChange={(e) => toggleKind(id, e.target.checked)}
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

                <div className="contact-form__wide">
                  <label htmlFor="contact-message" className={labelClass}>
                    Message
                  </label>
                  <textarea
                    id="contact-message"
                    rows={4}
                    value={form.msg}
                    disabled={submitting}
                    onChange={(e) => setForm((f) => ({ ...f, msg: e.target.value }))}
                    placeholder="Tell us a little about yourself and why you're reaching out."
                    className={fieldClass}
                  />
                </div>

                {error && (
                  <p className="form-error contact-form__wide" role="alert">
                    {error}
                  </p>
                )}

                <div className="contact-form__wide">
                  <Button
                    type="submit"
                    disabled={submitting}
                    variant="primary"
                    size="lg"
                    icon={submitting ? undefined : 'arrow'}
                    className="w-full sm:w-auto"
                  >
                    {submitting ? 'Sending…' : 'Send message'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
