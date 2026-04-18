import Reveal from './Reveal';
import Circled from './Circled';

export default function Hero() {
  return (
    <section
      id="top"
      className="relative pt-28 pb-20 sm:pt-40 sm:pb-32"
    >
      <div className="container-x">
        <div className="max-w-4xl">
          <Reveal>
            <div className="text-[10px] uppercase tracking-[0.24em] text-moss-300/80 sm:text-[11px] sm:tracking-[0.28em]">
              Solaria Capital · La Jolla, California
            </div>
          </Reveal>

          <Reveal delay={120}>
            <h1
              className="mt-6 font-display font-medium leading-[1.05] tracking-[-0.02em] sm:mt-8"
              style={{ fontSize: 'clamp(2rem, 8vw, 5.5rem)' }}
            >
              Built to{' '}
              <Circled color="#34d399" delay={900}>
                outperform
              </Circled>
              .
            </h1>
          </Reveal>

          <Reveal delay={240}>
            <p className="mt-6 text-base leading-relaxed text-white/55 sm:mt-8 sm:text-xl">
              Quantitative investment management.
            </p>
          </Reveal>

          <Reveal delay={320}>
            <div className="mt-8 flex flex-wrap items-center gap-4 sm:mt-10 sm:gap-5">
              <a
                href="#contact"
                className="inline-flex items-center gap-2 rounded-md bg-moss-500 px-5 py-3 text-sm font-medium text-ink-950 transition-colors hover:bg-moss-400 sm:px-6 sm:py-3.5"
              >
                Get in touch
                <span aria-hidden>→</span>
              </a>
              <a
                href="#fund"
                className="inline-flex items-center gap-2 text-sm text-white/60 transition-colors hover:text-white"
              >
                The Fund <span aria-hidden>↓</span>
              </a>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
