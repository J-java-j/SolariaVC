import Reveal from './Reveal';
import Circled from './Circled';

export default function Hero() {
  return (
    <section
      id="top"
      className="relative flex min-h-[88svh] items-center pt-28 pb-16 sm:pt-36 sm:pb-20"
    >
      <div className="container-x w-full">
        <div className="max-w-4xl">
          <Reveal>
            <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.22em] sm:tracking-[0.28em] text-moss-300/80">
              Solaria Capital · La Jolla, California
            </div>
          </Reveal>

          <Reveal delay={120}>
            <h1
              className="mt-6 sm:mt-8 font-display font-medium leading-[1.05] tracking-[-0.02em]"
              style={{ fontSize: 'clamp(2.5rem, 9vw, 6.5rem)' }}
            >
              Built to{' '}
              <Circled color="#34d399" delay={900}>
                outperform
              </Circled>
              .
            </h1>
          </Reveal>

          <Reveal delay={240}>
            <p className="mt-8 sm:mt-10 max-w-xl text-base leading-relaxed text-white/55 sm:text-xl">
              Quantitative investment management.
            </p>
          </Reveal>

          <Reveal delay={320}>
            <div className="mt-10 sm:mt-12 flex flex-wrap items-center gap-4 sm:gap-5">
              <a
                href="#contact"
                className="inline-flex items-center gap-2 rounded-md bg-moss-500 px-5 py-3 sm:px-6 sm:py-3.5 text-sm font-medium text-ink-950 transition-colors hover:bg-moss-400"
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

      {/* tiny scroll cue — only shown on tall screens to avoid crowding */}
      <Reveal delay={600} className="absolute inset-x-0 bottom-8 hidden justify-center sm:flex">
        <div className="num text-[10px] uppercase tracking-[0.3em] text-white/25">
          Scroll
        </div>
      </Reveal>
    </section>
  );
}
