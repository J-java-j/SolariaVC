import Reveal from './Reveal';

const GOLD = '#fcd34d';

/**
 * Solaria's flagship product. Three lines, dead-centre, with a soft
 * gold radial glow behind. Padding-based section (no viewport-height
 * tricks) so it can't crop awkwardly on any device.
 */
export default function MedallionIntro() {
  return (
    <section
      id="fund-intro"
      className="relative border-t border-white/[0.05] px-5 py-28 sm:py-36 lg:py-44"
    >
      {/* very soft gold radial glow, centred */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 50% 40% at 50% 50%, rgba(252, 211, 77, 0.09), transparent 70%)',
        }}
        aria-hidden
      />

      <div className="container-x">
        <div className="text-center">
          <Reveal>
            <div className="text-[10px] uppercase tracking-[0.4em] text-amber-300/65 sm:text-[11px]">
              Introducing
            </div>
          </Reveal>

          <Reveal delay={160}>
            <h2
              className="mt-6 font-display font-semibold leading-[1.05] tracking-[-0.025em] sm:mt-8"
              style={{
                fontSize: 'clamp(2rem, 11vw, 6.5rem)',
                color: GOLD,
                paddingTop: '0.15em',
                paddingBottom: '0.05em',
              }}
            >
              Medallion
            </h2>
          </Reveal>

          <Reveal delay={320}>
            <p className="mt-6 text-sm text-white/55 sm:mt-8 sm:text-base">
              Closed-end. Quantitative.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
