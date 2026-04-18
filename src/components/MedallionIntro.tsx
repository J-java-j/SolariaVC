import Reveal from './Reveal';

const GOLD = '#fcd34d';

/**
 * Solaria's flagship product gets the prestige treatment — but kept
 * intentionally small in word-count. One eyebrow, one word, one
 * tagline. No ornaments, no extra subtitles, no CTA (the deeper
 * Fund section right below is the CTA).
 */
export default function MedallionIntro() {
  return (
    <section
      id="fund-intro"
      className="relative flex min-h-[60svh] items-center justify-center border-t border-white/[0.05] px-5 py-20 sm:min-h-[68vh] sm:py-24"
    >
      {/* very soft gold radial glow only — no through-line */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 50% 40% at 50% 50%, rgba(252, 211, 77, 0.08), transparent 70%)',
        }}
        aria-hidden
      />

      <div className="relative w-full text-center">
        <Reveal>
          <div className="text-[10px] uppercase tracking-[0.42em] text-amber-300/65 sm:text-[11px]">
            Introducing
          </div>
        </Reveal>

        <Reveal delay={160}>
          <h2
            className="mt-6 font-display font-semibold leading-[1.05] tracking-[-0.03em] sm:mt-8"
            style={{
              fontSize: 'clamp(2.25rem, 12vw, 7.5rem)',
              color: GOLD,
              textShadow:
                '0 0 60px rgba(252, 211, 77, 0.30), 0 1px 0 rgba(0, 0, 0, 0.4)',
              paddingTop: '0.18em',
              paddingBottom: '0.08em',
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
    </section>
  );
}
