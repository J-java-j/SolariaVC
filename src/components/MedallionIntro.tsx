import Reveal from './Reveal';

const GOLD_TEXT = '#fcd34d';
const GOLD_DIM = 'rgba(252, 211, 77, 0.45)';

/**
 * The Medallion Fund introduction scene — designed as a luxury crest
 * rather than a copy of the hero's circled-word treatment. Decorative
 * rules with a centred star above and below; the word MEDALLION
 * stamped in solid bold gold; a wide-tracked "FUND" beneath. Reads
 * like a watch dial or a wine label, deliberately distinct from the
 * rest of the site.
 */
export default function MedallionIntro() {
  return (
    <section
      id="fund-intro"
      className="relative flex min-h-[78svh] items-center justify-center overflow-hidden border-t border-white/[0.05] px-5 py-20 sm:px-6 sm:py-24"
    >
      {/* gold radial glow + faint inner light */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 55% 45% at 50% 50%, rgba(252, 211, 77, 0.10), transparent 70%)',
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(252, 211, 77, 0.25), transparent)',
        }}
        aria-hidden
      />

      <div className="relative w-full max-w-3xl text-center">
        {/* top decorative rule with star */}
        <Reveal>
          <Ornament />
        </Reveal>

        {/* eyebrow */}
        <Reveal delay={120}>
          <div className="mt-8 text-[10px] uppercase tracking-[0.42em] text-amber-300/65 sm:text-[11px]">
            Introducing
          </div>
        </Reveal>

        {/* MEDALLION — solid gold, bold, large */}
        <Reveal delay={240}>
          <h2
            className="mt-5 font-display font-semibold leading-[0.95] tracking-[-0.035em] text-amber-300"
            style={{
              fontSize: 'clamp(3rem, 13vw, 8.5rem)',
              color: GOLD_TEXT,
              textShadow:
                '0 0 60px rgba(252, 211, 77, 0.35), 0 1px 0 rgba(0, 0, 0, 0.4)',
              paddingTop: '0.12em',
              paddingBottom: '0.06em',
            }}
          >
            MEDALLION
          </h2>
        </Reveal>

        {/* FUND — wide letter-spacing, smaller, like a wine label subtitle */}
        <Reveal delay={360}>
          <div
            className="mt-3 font-display font-medium text-amber-200/85 sm:mt-5"
            style={{
              fontSize: 'clamp(1.25rem, 3.5vw, 2.25rem)',
              letterSpacing: '0.45em',
              paddingLeft: '0.45em', // visually balance the wide tracking
            }}
          >
            FUND
          </div>
        </Reveal>

        {/* bottom decorative rule with star */}
        <Reveal delay={480}>
          <div className="mt-10">
            <Ornament />
          </div>
        </Reveal>

        {/* tagline */}
        <Reveal delay={600}>
          <p className="mt-8 text-sm leading-relaxed text-white/55 sm:mt-10 sm:text-base">
            Closed-end. Quantitative. Patient.
          </p>
        </Reveal>

        {/* CTA */}
        <Reveal delay={700}>
          <a
            href="#fund"
            className="mt-8 inline-flex items-center gap-2 text-[13px] text-amber-300/85 transition-colors hover:text-amber-200"
          >
            View the terms <span aria-hidden>↓</span>
          </a>
        </Reveal>
      </div>
    </section>
  );
}

function Ornament() {
  return (
    <div
      className="flex items-center justify-center gap-3 sm:gap-4"
      aria-hidden
    >
      <span
        className="h-px w-14 sm:w-24"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(252, 211, 77, 0.55))',
        }}
      />
      <Star />
      <span
        className="h-px w-14 sm:w-24"
        style={{
          background:
            'linear-gradient(90deg, rgba(252, 211, 77, 0.55), transparent)',
        }}
      />
    </div>
  );
}

function Star() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      aria-hidden
      style={{ color: GOLD_DIM }}
    >
      <path
        d="M8 0 L9.4 6.6 L16 8 L9.4 9.4 L8 16 L6.6 9.4 L0 8 L6.6 6.6 Z"
        fill="currentColor"
      />
    </svg>
  );
}
