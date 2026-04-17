import Reveal from './Reveal';
import AnimatedNumber from './AnimatedNumber';
import { BACKTEST_STATS } from '../lib/fundData';

type Achievement = {
  n: string;
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals: number;
  headline: string;
  body: string;
  comparison?: { label: string; value: string };
  multiple?: { numerator: number; denominator: number; label: string };
};

const items: Achievement[] = [
  {
    n: '01',
    label: 'Annualised return',
    value: BACKTEST_STATS.cagrPct,
    suffix: '%',
    decimals: 2,
    headline: 'Compounded conviction.',
    body: '14 years of monthly-rebalanced equities, run live from April 2012 forward. The strategy compounded at more than 1.5× the broad market.',
    comparison: { label: 'S&P 500 over the same window', value: `${BACKTEST_STATS.spxCagrPct.toFixed(2)}%` },
    multiple: {
      numerator: BACKTEST_STATS.cagrPct,
      denominator: BACKTEST_STATS.spxCagrPct,
      label: 'the market',
    },
  },
  {
    n: '02',
    label: 'Sharpe ratio',
    value: BACKTEST_STATS.sharpe,
    decimals: 2,
    headline: 'Risk, paid for.',
    body: 'Sharpe quantifies return per unit of volatility. Above 1.0 is institutional. Above 1.4 is rare. Solaria delivers it without leverage and without exotic instruments.',
    comparison: { label: 'Hedge-fund benchmark', value: '~0.6' },
  },
  {
    n: '03',
    label: 'Total return',
    value: BACKTEST_STATS.totalReturnPct,
    prefix: '+',
    suffix: '%',
    decimals: 2,
    headline: 'Sixteen times your dollar.',
    body: 'Starting from $1 in April 2012, the M4 V3 backtest grew the same dollar to roughly $16 by April 2026. The S&P 500 grew it to $6.55 over the identical period.',
    comparison: { label: 'S&P 500 cumulative', value: `+${BACKTEST_STATS.spxTotalReturnPct.toFixed(0)}%` },
  },
  {
    n: '04',
    label: 'Monthly win rate',
    value: BACKTEST_STATS.monthlyWinRatePct,
    suffix: '%',
    decimals: 2,
    headline: 'Two out of three months.',
    body: 'Across 168 monthly observations, the strategy finished positive 65 percent of the time. The average winning month returned +1.64%; the average losing month, −2.74%.',
    comparison: { label: 'Best month', value: `+${BACKTEST_STATS.bestMonthPct.toFixed(2)}%` },
  },
];

export default function Achievements() {
  return (
    <section
      id="achievements"
      className="relative isolate border-t border-white/[0.06] py-24 sm:py-32 overflow-hidden"
    >
      <div className="absolute inset-0 -z-10 dot-bg opacity-30" aria-hidden />
      <div
        className="absolute -left-32 top-32 -z-10 h-[420px] w-[520px] rounded-full bg-moss-700/10 blur-3xl"
        aria-hidden
      />
      <div
        className="absolute -right-32 bottom-32 -z-10 h-[420px] w-[520px] rounded-full bg-moss-500/10 blur-3xl"
        aria-hidden
      />

      <div className="container-x">
        <Reveal>
          <div className="max-w-2xl">
            <div className="label">By the numbers</div>
            <h2 className="mt-4 font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
              The case for Solaria, in four lines.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-white/70">
              Headline figures from the {BACKTEST_STATS.strategy.split(' · ')[0]}{' '}
              backtest — the same strategy the Medallion Fund deploys today.
              Numbers are hypothetical and illustrate the model's historical
              behaviour; the live fund is younger.
            </p>
          </div>
        </Reveal>

        <div className="mt-16 space-y-12 sm:space-y-20">
          {items.map((it, i) => (
            <AchievementPanel
              key={it.n}
              item={it}
              isLast={i === items.length - 1}
              total={items.length}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function AchievementPanel({
  item,
  isLast,
  total,
}: {
  item: Achievement;
  isLast: boolean;
  total: number;
}) {
  return (
    <Reveal>
      <article
        className={`group grid gap-8 border-b border-white/[0.06] pb-12 sm:pb-16 lg:grid-cols-12 lg:gap-12 ${
          isLast ? 'border-b-0 pb-0' : ''
        }`}
      >
        {/* number column */}
        <div className="lg:col-span-7">
          <div className="flex items-baseline gap-4">
            <span className="num text-[11px] uppercase tracking-[0.22em] text-moss-300/80">
              {item.n} / {String(total).padStart(2, '0')}
            </span>
            <span className="h-px flex-1 bg-gradient-to-r from-moss-500/40 to-transparent" />
            <span className="num text-[10px] uppercase tracking-[0.18em] text-white/35">
              Backtest
            </span>
          </div>

          <div className="mt-3 label">{item.label}</div>

          <div className="mt-2 leading-none">
            <span className="num font-display font-semibold text-gradient-moss text-[5.5rem] leading-[0.95] sm:text-[7.5rem] lg:text-[9rem] xl:text-[10rem] tracking-tight">
              <AnimatedNumber
                value={item.value}
                prefix={item.prefix}
                suffix={item.suffix}
                decimals={item.decimals}
                duration={1800}
              />
            </span>
          </div>

          <h3 className="mt-6 font-display text-2xl text-white sm:text-3xl">
            {item.headline}
          </h3>
        </div>

        {/* context column */}
        <div className="lg:col-span-5 lg:pl-8 lg:border-l lg:border-white/[0.06]">
          <p className="text-white/70 leading-relaxed sm:text-lg">{item.body}</p>

          {item.comparison && (
            <div className="mt-6 rounded-xl border border-white/10 bg-ink-900/60 p-5">
              <div className="label !text-[10px] !text-white/45">vs Benchmark</div>
              <div className="mt-3 grid grid-cols-2 gap-4">
                <div>
                  <div className="num text-[10px] uppercase tracking-[0.18em] text-moss-300/80">
                    Solaria
                  </div>
                  <div className="num mt-1.5 text-2xl text-moss-300">
                    <AnimatedNumber
                      value={item.value}
                      prefix={item.prefix}
                      suffix={item.suffix}
                      decimals={item.decimals}
                      duration={1400}
                    />
                  </div>
                </div>
                <div>
                  <div className="num text-[10px] uppercase tracking-[0.18em] text-white/45">
                    {item.comparison.label}
                  </div>
                  <div className="num mt-1.5 text-2xl text-white/80">
                    {item.comparison.value}
                  </div>
                </div>
              </div>
              {item.multiple && (
                <div className="mt-5 flex items-center gap-2 border-t border-white/[0.06] pt-4 text-xs">
                  <Arrow />
                  <span className="text-white/65">
                    <span className="num text-moss-300">
                      {(item.multiple.numerator / item.multiple.denominator).toFixed(2)}×
                    </span>{' '}
                    {item.multiple.label}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </article>
    </Reveal>
  );
}

function Arrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#34d399" strokeWidth="2" aria-hidden>
      <path d="M3 13L13 3M13 3H6M13 3v7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
