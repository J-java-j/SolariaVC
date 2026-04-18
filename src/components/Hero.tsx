import Reveal from './Reveal';
import AnimatedNumber from './AnimatedNumber';

export default function Hero() {
  return (
    <section
      id="top"
      className="relative pt-36 pb-24 sm:pt-44 sm:pb-32"
    >
      <div className="container-x">
        <div className="max-w-3xl">
          <Reveal>
            <div className="text-[11px] uppercase tracking-[0.24em] text-moss-300/80">
              Solaria Capital, LLC · La Jolla, California
            </div>
          </Reveal>

          <Reveal delay={80}>
            <h1 className="mt-6 font-display text-4xl font-medium leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Quantitative investment management.
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-white/70">
              Solaria Capital operates three things: <span className="text-white">the
              Medallion Fund</span> — a closed-end quantitative portfolio;{' '}
              <span className="text-white">Solaria Ventures</span> — a pre-seed
              and seed venture arm; and <span className="text-white">Solaria
              Research</span> — the models that inform both. The strategy
              backtest from April 2012 through April 2026 returned{' '}
              <span className="num text-white">20.53%</span> annualised at a
              Sharpe of <span className="num text-white">1.46</span>.
            </p>
          </Reveal>

          <Reveal delay={240}>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <a
                href="#contact"
                className="inline-flex items-center gap-2 rounded-md bg-moss-500 px-5 py-3 text-sm font-medium text-ink-950 transition-colors hover:bg-moss-400"
              >
                Get in touch
                <span aria-hidden>→</span>
              </a>
              <a
                href="#fund"
                className="inline-flex items-center gap-2 text-sm text-white/70 transition-colors hover:text-white"
              >
                Read about the Fund <span aria-hidden>→</span>
              </a>
            </div>
          </Reveal>

          <Reveal delay={320}>
            <div className="mt-16 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-white/[0.06] pt-8 text-sm">
              <Stat label="AUM" value={50} format="k" prefix="$" />
              <Sep />
              <Stat label="Backtest CAGR" value={20.53} suffix="%" decimals={2} />
              <Sep />
              <Stat label="Backtest Sharpe" value={1.46} decimals={2} />
              <Sep />
              <Stat label="Companies tracked" value={8} pad={2} />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  prefix,
  suffix,
  decimals,
  pad,
  format,
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  pad?: number;
  format?: 'plain' | 'k' | 'm';
}) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[0.2em] text-white/45">
        {label}
      </div>
      <div className="num mt-1 text-lg text-white">
        {pad ? (
          <AnimatedNumber
            value={value}
            prefix={'0'.repeat(Math.max(0, pad - String(value).length))}
          />
        ) : (
          <AnimatedNumber
            value={value * (format === 'k' ? 1000 : 1)}
            prefix={prefix}
            suffix={suffix}
            decimals={decimals}
            format={format}
          />
        )}
      </div>
    </div>
  );
}

function Sep() {
  return <span aria-hidden className="hidden sm:inline-block h-8 w-px bg-white/10" />;
}
