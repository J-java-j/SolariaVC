import Reveal from './Reveal';
import Circled from './Circled';

const GOLD = '#fcd34d';

export default function MedallionIntro() {
  return (
    <section
      id="fund-intro"
      className="relative flex min-h-[78vh] items-center justify-center border-t border-white/[0.05] px-6"
    >
      {/* subtle gold radial backdrop */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 60% 45% at 50% 55%, rgba(252, 211, 77, 0.07), transparent 70%)',
        }}
        aria-hidden
      />

      <div className="text-center">
        <Reveal>
          <div className="inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.32em] text-amber-300/70">
            <span className="h-px w-8 bg-amber-400/40" />
            Introducing
            <span className="h-px w-8 bg-amber-400/40" />
          </div>
        </Reveal>

        <Reveal delay={120}>
          <h2
            className="mt-10 font-display font-medium tracking-[-0.03em] text-gradient-gold py-3"
            style={{ fontSize: 'clamp(3rem, 11vw, 8rem)', lineHeight: 1.05 }}
          >
            The{' '}
            <Circled color={GOLD} delay={900} duration={1300}>
              Medallion
            </Circled>{' '}
            Fund
          </h2>
        </Reveal>

        <Reveal delay={240}>
          <p className="mt-10 text-lg text-white/60 sm:text-xl">
            Closed-end. Quantitative. Patient.
          </p>
        </Reveal>

        <Reveal delay={320}>
          <a
            href="#fund"
            className="mt-10 inline-flex items-center gap-2 text-sm text-amber-300/85 transition-colors hover:text-amber-200"
          >
            View the terms <span aria-hidden>↓</span>
          </a>
        </Reveal>
      </div>
    </section>
  );
}
