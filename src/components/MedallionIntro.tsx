import Reveal from './Reveal';

const GOLD = '#fcd34d';
const GOLD_DIM = 'rgba(252, 211, 77, 0.4)';

/**
 * Flagship intro — elite/prestige treatment. Smaller mobile sizes
 * for refinement (smaller text reads more elite than oversized),
 * a rule + "BY INVITATION" badge for exclusivity signalling.
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
            'radial-gradient(ellipse 50% 35% at 50% 50%, rgba(252, 211, 77, 0.085), transparent 70%)',
        }}
        aria-hidden
      />

      <div className="container-x">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <div className="text-[10px] font-medium uppercase tracking-[0.4em] text-amber-300/65 sm:tracking-[0.45em]">
              Introducing
            </div>
          </Reveal>

          <Reveal delay={160}>
            <h2
              className="mt-5 font-display text-3xl font-semibold leading-[1.05] tracking-[-0.015em] sm:mt-7 sm:text-5xl md:text-6xl lg:text-7xl"
              style={{ color: GOLD, paddingTop: '0.1em', paddingBottom: '0.1em' }}
            >
              Medallion
            </h2>
          </Reveal>

          <Reveal delay={300}>
            <div className="mt-7 flex items-center justify-center gap-3 sm:mt-10 sm:gap-4">
              <span
                className="h-px w-10 sm:w-16"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, rgba(252, 211, 77, 0.5))',
                }}
              />
              <span
                className="num text-[9px] font-medium uppercase tracking-[0.32em] text-amber-200/85 sm:text-[10px]"
              >
                By Invitation
              </span>
              <span
                className="h-px w-10 sm:w-16"
                style={{
                  background:
                    'linear-gradient(90deg, rgba(252, 211, 77, 0.5), transparent)',
                }}
              />
            </div>
          </Reveal>

          <Reveal delay={420}>
            <p className="mt-7 text-sm leading-relaxed text-white/55 sm:mt-9 sm:text-base">
              Closed-end. Patient capital.
              <br className="sm:hidden" />
              <span className="hidden sm:inline"> </span>
              Vintage 2026 · selective subscription.
            </p>
          </Reveal>

          <Reveal delay={520}>
            <a
              href="#fund"
              className="mt-7 inline-flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.18em] text-amber-300/85 transition-colors hover:text-amber-200 sm:mt-9"
              style={{ color: GOLD_DIM }}
            >
              <span style={{ color: GOLD }}>Request an introduction</span>
              <span aria-hidden style={{ color: GOLD }}>→</span>
            </a>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
