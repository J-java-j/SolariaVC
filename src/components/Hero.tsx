import Reveal from './Reveal';
import Circled from './Circled';

export default function Hero() {
  return (
    <section
      id="top"
      className="relative pt-24 pb-16 sm:pt-36 sm:pb-24 lg:pt-44 lg:pb-32"
    >
      <div className="container-x">
        <div className="max-w-4xl">
          <Reveal>
            <div className="text-[10px] font-medium uppercase tracking-[0.24em] text-moss-300/80 sm:text-[11px] sm:tracking-[0.32em]">
              Solaria Capital · La Jolla
            </div>
          </Reveal>

          <Reveal delay={120}>
            <h1 className="mt-5 font-display text-3xl font-medium leading-[1.08] tracking-[-0.02em] sm:mt-7 sm:text-5xl md:text-6xl lg:text-7xl">
              Built to{' '}
              <Circled color="#34d399" delay={900}>
                outperform
              </Circled>
              .
            </h1>
          </Reveal>

          <Reveal delay={240}>
            <p className="mt-5 text-sm leading-relaxed text-white/55 sm:mt-7 sm:text-lg lg:text-xl">
              Quantitative investment management.
            </p>
          </Reveal>

          <Reveal delay={320}>
            <div className="mt-7 flex flex-wrap items-center gap-4 sm:mt-10 sm:gap-5">
              <a
                href="#contact"
                className="inline-flex items-center gap-2 rounded-md bg-moss-500 px-5 py-3 text-[13px] font-medium text-ink-950 transition-colors hover:bg-moss-400 sm:px-6 sm:py-3.5 sm:text-sm"
              >
                Get in touch
                <span aria-hidden>→</span>
              </a>
              <a
                href="#fund"
                className="inline-flex items-center gap-2 text-[13px] text-white/60 transition-colors hover:text-white sm:text-sm"
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
