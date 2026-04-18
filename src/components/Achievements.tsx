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
};

const items: Achievement[] = [
  {
    n: '01',
    label: 'Annualised return',
    value: BACKTEST_STATS.cagrPct,
    suffix: '%',
    decimals: 2,
    headline: 'Outperformance, compounded.',
    body: '14 years of monthly-rebalanced US equities. Strategy compounded at 20.53% per year — roughly 1.5× the S&P 500 over the same window.',
    comparison: { label: 'S&P 500', value: `${BACKTEST_STATS.spxCagrPct.toFixed(2)}%` },
  },
  {
    n: '02',
    label: 'Sharpe ratio',
    value: BACKTEST_STATS.sharpe,
    decimals: 2,
    headline: 'Sharpe above 1.4, gross.',
    body: 'Return per unit of volatility. Above 1.0 is considered institutional-grade. Above 1.4 is delivered by a small minority of public-equity strategies — without leverage, without options.',
    comparison: { label: 'Hedge-fund avg', value: '~0.6' },
  },
  {
    n: '03',
    label: 'Cumulative growth',
    value: BACKTEST_STATS.totalReturnPct,
    prefix: '+',
    suffix: '%',
    decimals: 2,
    headline: 'A dollar in 2012 is sixteen today.',
    body: 'Top-6 monthly portfolio grew $1 to roughly $16 between Apr 2012 and Apr 2026. The S&P 500 grew the same dollar to about $6.55.',
    comparison: { label: 'S&P 500', value: `+${BACKTEST_STATS.spxTotalReturnPct.toFixed(0)}%` },
  },
  {
    n: '04',
    label: 'Monthly hit rate',
    value: BACKTEST_STATS.monthlyWinRatePct,
    suffix: '%',
    decimals: 2,
    headline: 'Two of every three months, positive.',
    body: '110 of 168 months finished green. Average up-month +1.64%, average down-month −2.74%. Largest single-month gain +10.91%, largest loss −9.11%.',
    comparison: { label: 'Best month', value: `+${BACKTEST_STATS.bestMonthPct.toFixed(2)}%` },
  },
];

export default function Achievements() {
  return (
    <section
      id="achievements"
      className="relative isolate border-t border-white/[0.06] py-24 sm:py-32 overflow-hidden"
    >
      <div className="absolute inset-0 -z-10 dot-bg opacity-25" aria-hidden />

      <div className="container-x">
        <Reveal>
          <div className="max-w-2xl">
            <div className="label">Track Record</div>
            <h2 className="mt-4 font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
              The backtest, summarised in four numbers.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-white/65">
              Headline figures from the M4 V3 backtest — the same strategy the
              Medallion Fund deploys today. Hypothetical, gross of fees,
              illustrative of the model. The live fund is younger and reports
              separately.
            </p>
          </div>
        </Reveal>

        <div className="mt-16 space-y-10 sm:space-y-14">
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
        className={`grid gap-8 border-b border-white/[0.06] pb-10 sm:pb-14 lg:grid-cols-12 lg:gap-12 ${
          isLast ? 'border-b-0 pb-0' : ''
        }`}
      >
        {/* number column */}
        <div className="min-w-0 lg:col-span-7">
          <div className="flex items-baseline gap-4">
            <span className="num text-[11px] uppercase tracking-[0.22em] text-moss-300/80">
              {item.n} / {String(total).padStart(2, '0')}
            </span>
            <span className="h-px flex-1 bg-gradient-to-r from-moss-500/40 to-transparent" />
            <span className="num text-[10px] uppercase tracking-[0.18em] text-white/35">
              Backtest
            </span>
          </div>

          <div className="mt-4 label">{item.label}</div>

          {/* The big number. Mono only (drops the serif so giant digits look
              tabular like a Bloomberg ticker). Width capped via clamp() so a
              long value like "+1,520.03%" can never push past the column. */}
          <div className="mt-2 overflow-hidden">
            <div
              className="num font-semibold text-gradient-moss tracking-[-0.03em] leading-[0.95] tabular-nums"
              style={{ fontSize: 'clamp(3rem, 8.5vw, 7rem)' }}
            >
              <AnimatedNumber
                value={item.value}
                prefix={item.prefix}
                suffix={item.suffix}
                decimals={item.decimals}
                duration={1800}
              />
            </div>
          </div>

          <h3 className="mt-5 font-display text-2xl leading-snug text-white sm:text-3xl">
            {item.headline}
          </h3>
        </div>

        {/* context column */}
        <div className="min-w-0 lg:col-span-5 lg:border-l lg:border-white/[0.06] lg:pl-8">
          <p className="text-white/70 leading-relaxed sm:text-[17px]">
            {item.body}
          </p>

          {item.comparison && (
            <div className="mt-6 rounded-lg border border-white/[0.08] bg-ink-900/40 p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-moss-300/80">
                    Solaria
                  </div>
                  <div className="num mt-1.5 text-xl text-moss-300">
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
                  <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">
                    {item.comparison.label}
                  </div>
                  <div className="num mt-1.5 text-xl text-white/80">
                    {item.comparison.value}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </article>
    </Reveal>
  );
}
