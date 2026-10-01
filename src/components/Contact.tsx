import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useReveal } from '../hooks/useReveal';
import { SectionIntro } from './primitives';
import { ContactApiError, getContactConfig, submitContact, validateContact, verifyContact, type ContactConfig, type ContactKind } from '../lib/contactApi';
import ContactSecurity from './ContactSecurity';
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
  const [config, setConfig] = useState<ContactConfig | null>(null);
  const [configError, setConfigError] = useState(false);
  const [configAttempt, setConfigAttempt] = useState(0);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [challengeAttempt, setChallengeAttempt] = useState(0);
  const [verification, setVerification] = useState<{ id: string; email: string } | null>(null);
  const [code, setCode] = useState('');
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const inFlight = useRef(false);
  const codeInput = useRef<HTMLInputElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const successMessage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    setConfigError(false);
    setConfig(null);
    getContactConfig().then((value) => {
      if (active) setConfig(value);
    }).catch(() => {
      if (active) setConfigError(true);
    });
    return () => { active = false; };
  }, [configAttempt]);

  useEffect(() => {
    if (verification) codeInput.current?.focus();
  }, [verification]);

  useEffect(() => {
    if (sent) successMessage.current?.focus();
  }, [sent]);

  useEffect(() => {
    const update = () => setSecondsRemaining(Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000)));
    update();
    if (!cooldownUntil) return;
    const timer = window.setInterval(() => {
      update();
      if (cooldownUntil <= Date.now()) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);
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

  const handleError = (err: unknown) => {
    setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    if (err instanceof ContactApiError && err.retryAfterSeconds) {
      setCooldownUntil(Date.now() + err.retryAfterSeconds * 1000);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (inFlight.current || cooldownUntil > Date.now()) return;
    setError(null);
    if (!config || (config.siteKey && !turnstileToken)) {
      setError('Please complete the security check before continuing.');
      return;
    }
    const payload = {
      name: form.name,
      email: form.email,
      message: form.msg,
      kind: form.kind,
      website: form.website,
      turnstileToken,
    };
    const validationError = validateContact(payload);
    if (validationError) {
      setError(validationError);
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    setTurnstileToken('');
    try {
      const result = await submitContact(payload);
      setCooldownUntil(Date.now() + 60_000);
      setCode('');
      setVerification({ id: result.verificationId, email: payload.email.trim() });
    } catch (err) {
      handleError(err);
    } finally {
      setChallengeAttempt((n) => n + 1);
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const onVerify = async (e: FormEvent) => {
    e.preventDefault();
    if (inFlight.current || !verification) return;
    setError(null);
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Enter the six-digit code from your email.');
      codeInput.current?.focus();
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    try {
      await verifyContact(verification.id, code);
      setSent(true);
    } catch (err) {
      handleError(err);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const changeDetails = () => {
    if (inFlight.current) return;
    setVerification(null);
    setCode('');
    setError(null);
    setTurnstileToken('');
    setChallengeAttempt((n) => n + 1);
    window.setTimeout(() => nameInput.current?.focus(), 0);
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
              <div ref={successMessage} tabIndex={-1} role="status" className="border-t border-[var(--border)] pt-10">
                <p className="text-[24px] font-medium text-[var(--fg)]">Thank you.</p>
                <p className="mt-3 text-body text-[var(--fg)]">We&apos;ll be in touch soon.</p>
              </div>
            ) : verification ? (
              <form onSubmit={onVerify} className="relative max-w-xl space-y-7" aria-busy={submitting} noValidate>
                <div>
                  <h3 className="text-[24px] font-medium text-[var(--fg)]">Check your email</h3>
                  <p id="contact-code-help" className="mt-3 text-body text-[var(--fg)]">
                    Enter the six-digit code sent to <strong className="break-all">{verification.email}</strong>.
                    Your message will be sent to our team only after verification.
                  </p>
                </div>
                <div>
                  <label htmlFor="contact-code" className={labelClass}>Verification code</label>
                  <input
                    ref={codeInput}
                    id="contact-code"
                    name="code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    value={code}
                    disabled={submitting}
                    aria-describedby="contact-code-help"
                    onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                    className={`${fieldClass} max-w-[14rem] tracking-[0.35em]`}
                  />
                </div>
                <p className="text-[15px] text-[var(--fg)]">
                  No code? Check your spam folder. Use “Change details” to correct your address or request a new code
                  {secondsRemaining > 0 ? ` in ${secondsRemaining} seconds.` : '.'}
                </p>
                {error && <p className="text-[16px] text-[var(--fg)]" role="alert">{error}</p>}
                <div className="flex flex-wrap items-center gap-5">
                  <button type="submit" disabled={submitting || code.length !== 6} className="btn-pitch-nav rounded-md border px-6 py-3 text-[17px] font-medium disabled:cursor-not-allowed disabled:opacity-50">
                    {submitting ? 'Verifying and sending…' : 'Verify and send message'}
                  </button>
                  <button type="button" disabled={submitting} onClick={changeDetails} className="text-[16px] underline underline-offset-4 disabled:opacity-50">
                    Change details
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={onSubmit} className="relative max-w-xl space-y-7" aria-busy={submitting} noValidate>
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
                    ref={nameInput}
                    id="contact-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    maxLength={120}
                    required
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
                    name="email"
                    type="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    maxLength={200}
                    required
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
                    name="message"
                    rows={4}
                    maxLength={8000}
                    required
                    value={form.msg}
                    disabled={submitting}
                    onChange={(e) => setForm((f) => ({ ...f, msg: e.target.value }))}
                    placeholder="What you're building, in a sentence."
                    className={`${fieldClass} resize-y min-h-[6rem]`}
                  />
                </div>

                {config ? (
                  config.siteKey ? <ContactSecurity key={challengeAttempt} siteKey={config.siteKey} onToken={setTurnstileToken} /> : null
                ) : (
                  <div role="status" className="text-[15px] text-[var(--fg)]">
                    <p>{configError ? 'The contact form is temporarily unavailable. Please try again later.' : 'Loading secure contact form…'}</p>
                    {configError && <button type="button" onClick={() => setConfigAttempt((n) => n + 1)} className="mt-2 underline underline-offset-4">Try again</button>}
                  </div>
                )}
                <p className="text-[15px] text-[var(--fg)]">We’ll email you a six-digit code to confirm your address before sending your message.</p>

                {error && (
                  <p className="text-[16px] text-[var(--fg)]" role="alert">
                    {error}
                  </p>
                )}

                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={submitting || !config || Boolean(config.siteKey && !turnstileToken) || secondsRemaining > 0}
                    className="btn-pitch-nav rounded-md border px-6 py-3 text-[17px] font-medium transition-[background-color,border-color,color,opacity] duration-200 ease-out hover:!opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? 'Sending verification code…' : secondsRemaining > 0 ? `Try again in ${secondsRemaining}s` : 'Continue to email verification'}
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
