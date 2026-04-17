import { SectionLabel } from './About';

export default function Apply() {
  return (
    <section id="apply" className="relative py-28 sm:py-36">
      <div className="container-x">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-ink-900 via-ink-900 to-ink-800 p-8 sm:p-14">
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-sun-500/30 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -left-24 -bottom-24 h-72 w-72 rounded-full bg-sun-700/20 blur-3xl"
            aria-hidden
          />
          <div className="relative grid gap-12 lg:grid-cols-2">
            <Card
              kind="founder"
              label="Founders"
              title="We want to hear what you're building."
              body="Pre-seed to seed. We move fast. First meeting within 48 hours, term sheet within two weeks if there's a fit."
              cta="Pitch us"
              href="mailto:johnsonj198207@gmail.com?subject=Solaria%20VC%20-%20Pitch&body=Tell%20us%20about%20your%20company%2C%20your%20team%2C%20and%20what%20you%27re%20raising."
            />
            <Card
              kind="member"
              label="Members"
              title="Apply to join the next cohort."
              body="Open to all majors and class years. Bring conviction, curiosity, and a take on what's coming."
              cta="Apply"
              href="mailto:johnsonj198207@gmail.com?subject=Solaria%20VC%20-%20Membership%20Application&body=Tell%20us%20about%20yourself%2C%20your%20background%2C%20and%20what%20sectors%20you%27re%20excited%20about."
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
  kind: 'founder' | 'member';
  label: string;
  title: string;
  body: string;
  cta: string;
  href: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-ink-950/60 p-7 sm:p-9 backdrop-blur-sm">
      <SectionLabel>{label}</SectionLabel>
      <h3 className="mt-4 font-display text-3xl leading-tight">{title}</h3>
      <p className="mt-4 text-white/70 leading-relaxed">{body}</p>
      <a
        href={href}
        className={`mt-7 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
          kind === 'founder'
            ? 'bg-sun-500 text-ink-950 hover:bg-sun-400 glow-sun'
            : 'border border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08] hover:border-white/25'
        }`}
      >
        {cta}
        <span aria-hidden>→</span>
      </a>
    </div>
  );
}
