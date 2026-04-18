import Reveal from './Reveal';

const GOLD = '#fcd34d';

/**
 * The Fund's prestige introduction. Three lines, dead-centre.
 * Explicit Tailwind responsive sizes so it sizes predictably at
 * every breakpoint instead of guessing with clamp().
 */
export default function MedallionIntro() {
  return (
    <section
      id="fund-intro"
      className="relative border-t border-white/[0.05] px-5 py-24 sm:py-32 lg:py-40"
    >
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 50% 40% at 50% 50%, rgba(252, 211, 77, 0.10), transparent 70%)',
        }}
        aria-hidden
      />

      <div className="container-x">
        <div className="text-center">
          <Reveal>
            <div className="text-[10px] font-medium uppercase tracking-[0.4em] text-amber-300/65 sm:text-[11px]">
              Introducing
            </div>
          </Reveal>

          <Reveal delay={160}>
            <h2
              className="mt-5 font-display text-4xl font-semibold leading-[1.05] tracking-[-0.02em] sm:mt-7 sm:text-6xl md:text-7xl lg:text-8xl"
              style={{ color: GOLD, paddingTop: '0.12em', paddingBottom: '0.08em' }}
            >
              Medallion
            </h2>
          </Reveal>

          <Reveal delay={320}>
            <p className="mt-5 text-sm text-white/55 sm:mt-7 sm:text-base">
              Closed-end. Quantitative.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
