import Reveal from './Reveal';
import Circled from './Circled';

export default function Hero() {
  return (
    <section
      id="top"
      className="relative flex min-h-[88vh] items-center pt-32 pb-20 sm:pt-36"
    >
      <div className="container-x w-full">
        <div className="max-w-4xl">
          <Reveal>
            <div className="text-[11px] uppercase tracking-[0.28em] text-moss-300/80">
              Solaria Capital · La Jolla, California
            </div>
          </Reveal>

          <Reveal delay={120}>
            <h1
              className="mt-8 font-display font-medium leading-[1.02] tracking-[-0.02em]"
              style={{ fontSize: 'clamp(3rem, 8vw, 6.5rem)' }}
            >
              Built to{' '}
              <Circled color="#34d399" delay={900}>
                outperform
              </Circled>
              .
            </h1>
          </Reveal>

          <Reveal delay={240}>
            <p className="mt-10 max-w-xl text-lg leading-relaxed text-white/55 sm:text-xl">
              Quantitative investment management.
            </p>
          </Reveal>

          <Reveal delay={320}>
            <div className="mt-12 flex flex-wrap items-center gap-5">
              <a
                href="#contact"
                className="inline-flex items-center gap-2 rounded-md bg-moss-500 px-6 py-3.5 text-sm font-medium text-ink-950 transition-colors hover:bg-moss-400"
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

      {/* tiny scroll cue at bottom */}
      <Reveal delay={600} className="absolute inset-x-0 bottom-10 flex justify-center">
        <div className="num text-[10px] uppercase tracking-[0.3em] text-white/25">
          Scroll
        </div>
      </Reveal>
    </section>
  );
}
