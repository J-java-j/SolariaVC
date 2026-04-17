import Spotlight from './Spotlight';

export default function Contact() {
  return (
    <section id="contact" className="relative py-28 sm:py-36 border-t border-white/[0.06]">
      <div className="container-x">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-ink-900 via-ink-900 to-ink-800 p-8 sm:p-14">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-moss-500/25 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute -left-24 -bottom-24 h-72 w-72 rounded-full bg-moss-700/20 blur-3xl" aria-hidden />

          <div className="relative grid gap-10 lg:grid-cols-2">
            <Card
              kind="primary"
              label="Investor inquiries"
              title="Request the Medallion Fund prospectus."
              body="For accredited investors and institutional allocators. We respond to all inquiries within two business days."
              cta="Request prospectus"
              href="mailto:johnsonj198207@gmail.com?subject=Solaria%20%C2%B7%20Medallion%20Fund%20%E2%80%94%20Prospectus%20request&body=Name%3A%0AFirm%2FAffiliation%3A%0AAccredited%20status%3A%0AIndicative%20commitment%3A%0ANotes%3A%0A"
            />
            <Card
              kind="secondary"
              label="Founders & Research"
              title="Pitch us — or collaborate on a model."
              body="Pre-seed and seed founders, send a deck. Researchers and quants, send a hypothesis. We read everything."
              cta="Get in touch"
              href="mailto:johnsonj198207@gmail.com?subject=Solaria%20%C2%B7%20Inquiry&body=Tell%20us%20about%20your%20company%20or%20model%2C%20and%20what%20you%27re%20looking%20for%20from%20Solaria."
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function Card({
  kind,
  label,
  title,
  body,
  cta,
  href,
}: {
  kind: 'primary' | 'secondary';
  label: string;
  title: string;
  body: string;
  cta: string;
  href: string;
}) {
  return (
    <Spotlight intensity={0.18} className="rounded-2xl">
    <div className="rounded-2xl border border-white/10 bg-ink-950/60 p-7 sm:p-9 backdrop-blur-sm transition-transform hover:translate-y-[-2px]">
      <div className="label">{label}</div>
      <h3 className="mt-4 font-display text-3xl leading-tight">{title}</h3>
      <p className="mt-4 text-white/70 leading-relaxed">{body}</p>
      <a
        href={href}
        className={`mt-7 inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold transition-all ${
          kind === 'primary'
            ? 'bg-moss-500 text-ink-950 hover:bg-moss-400 hover:translate-y-[-1px] glow-moss'
            : 'border border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08] hover:border-white/25 hover:translate-y-[-1px]'
        }`}
      >
        {cta}
        <span aria-hidden>→</span>
      </a>
    </div>
    </Spotlight>
  );
}
