import Spotlight from './Spotlight';
import EmailButton, { SOLARIA_EMAIL } from './EmailButton';

export default function Contact() {
  return (
    <section id="contact" className="relative py-28 sm:py-36 border-t border-white/[0.06]">
      <div className="container-x">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-ink-900 via-ink-900 to-ink-800 p-8 sm:p-14">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-moss-500/25 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute -left-24 -bottom-24 h-72 w-72 rounded-full bg-moss-700/20 blur-3xl" aria-hidden />

          <div className="relative grid gap-10 lg:grid-cols-2">
            <Card
              variant="primary"
              label="Investor inquiries"
              title="Request the Medallion Fund prospectus."
              body="For accredited investors and institutional allocators. We respond to all inquiries within two business days."
              cta="Request prospectus"
              subject="Solaria · Medallion Fund — Prospectus request"
              emailBody={
                'Name:\nFirm/Affiliation:\nAccredited status:\nIndicative commitment:\nNotes:\n'
              }
            />
            <Card
              variant="secondary"
              label="Founders & Research"
              title="Pitch us — or collaborate on a model."
              body="Pre-seed and seed founders, send a deck. Researchers and quants, send a hypothesis. We read everything."
              cta="Get in touch"
              subject="Solaria · Inquiry"
              emailBody="Tell us about your company or model, and what you're looking for from Solaria."
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function Card({
  variant,
  label,
  title,
  body,
  cta,
  subject,
  emailBody,
}: {
  variant: 'primary' | 'secondary';
  label: string;
  title: string;
  body: string;
  cta: string;
  subject: string;
  emailBody: string;
}) {
  return (
    <Spotlight intensity={0.18} className="rounded-2xl">
      <div className="rounded-2xl border border-white/10 bg-ink-950/60 p-7 sm:p-9 backdrop-blur-sm transition-transform hover:translate-y-[-2px]">
        <div className="label">{label}</div>
        <h3 className="mt-4 font-display text-3xl leading-tight">{title}</h3>
        <p className="mt-4 text-white/70 leading-relaxed">{body}</p>
        <EmailButton
          className="mt-7"
          email={SOLARIA_EMAIL}
          subject={subject}
          body={emailBody}
          variant={variant}
        >
          {cta}
        </EmailButton>
      </div>
    </Spotlight>
  );
}
