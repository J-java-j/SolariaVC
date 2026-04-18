import Reveal from './Reveal';
import AnimatedNumber from './AnimatedNumber';
import { BACKTEST_STATS } from '../lib/fundData';

type Cell = {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  label: string;
  context: string;
  comparison?: { label: string; value: string; positive?: boolean };
  tone?: 'moss' | 'rose-soft' | 'plain';
};

const cells: Cell[] = [
  {
    value: BACKTEST_STATS.cagrPct,
    suffix: '%',
    decimals: 2,
    label: 'Annualised return',
    context: '14-year backtest · monthly rebalance',
    comparison: { label: 'S&P 500', value: `${BACKTEST_STATS.spxCagrPct.toFixed(2)}%`, positive: true },
    tone: 'moss',
  },
  {
    value: BACKTEST_STATS.sharpe,
    decimals: 2,
    label: 'Sharpe ratio',
    context: 'Return per unit of volatility',
    comparison: { label: 'Hedge-fund avg', value: '~0.6', positive: true },
    tone: 'moss',
  },
  {
    value: BACKTEST_STATS.totalReturnPct,
    prefix: '+',
    suffix: '%',
    decimals: 0,
    label: 'Total return',
    context: 'Apr 2012 → Apr 2026',
    comparison: { label: 'S&P 500', value: `+${BACKTEST_STATS.spxTotalReturnPct.toFixed(0)}%`, positive: true },
    tone: 'moss',
  },
  {
    value: BACKTEST_STATS.monthlyWinRatePct,
    suffix: '%',
    decimals: 2,
    label: 'Monthly win rate',
    context: '110 of 168 months positive',
    comparison: { label: 'Coin flip', value: '50%', positive: true },
    tone: 'moss',
  },
  {
    value: BACKTEST_STATS.maxDrawdownPct,
    suffix: '%',
    decimals: 2,
    label: 'Max drawdown',
    context: 'Peak-to-trough loss',
    comparison: { label: 'S&P 500 ITD', value: '−33.8%', positive: true },
    tone: 'rose-soft',
  },
  {
    value: BACKTEST_STATS.volAnnPct,
    suffix: '%',
    decimals: 2,
    label: 'Annualised volatility',
    context: 'Standard deviation of returns',
    comparison: { label: 'S&P 500', value: `${BACKTEST_STATS.spxVolAnnPct}%`, positive: true },
    tone: 'plain',
  },
];

export default function TrackRecord() {
  return (
    <section
      id="track"
      className="relative border-t border-white/[0.06] py-24 sm:py-32"
    >
      <div className="container-x">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-2xl">
              <div className="text-[11px] uppercase tracking-[0.24em] text-moss-300/80">
                Track Record
              </div>
              <h2 className="mt-4 font-display text-3xl font-medium leading-tight tracking-tight sm:text-4xl">
                The strategy, in six numbers.
              </h2>
              <p className="mt-5 text-white/65 leading-relaxed sm:text-lg">
                M4 V3 backtest, monthly rebalanced top-6 portfolio of US equities,
                from April 2012 through April 2026. Hypothetical, gross of fees,
                benchmarked against the S&P 500 across the same window.
              </p>
            </div>
            <div className="num inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[10.5px] uppercase tracking-[0.2em] text-amber-200">
              Backtest · Hypothetical
            </div>
          </div>
        </Reveal>

        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] sm:grid-cols-2 lg:grid-cols-3">
          {cells.map((c, i) => (
            <Reveal key={c.label} delay={60 + (i % 3) * 40}>
              <Cell {...c} />
            </Reveal>
          ))}
        </div>

        <Reveal delay={400} className="mt-6">
          <p className="text-[11px] text-white/40 leading-relaxed">
            Past performance — including hypothetical performance — is not
            indicative of future results. The live Medallion Fund inception is
            Q1 2026 and is reported separately.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function Cell({ value, prefix, suffix, decimals, label, context, comparison, tone }: Cell) {
  const numColor =
    tone === 'rose-soft'
      ? 'text-rose-300'
      : tone === 'plain'
      ? 'text-white'
      : 'text-gradient-moss';

  return (
    <div className="flex h-full flex-col bg-ink-900/60 p-6 sm:p-8 transition-colors hover:bg-ink-800/80">
      <div className="text-[10.5px] uppercase tracking-[0.2em] text-white/45">
        {label}
      </div>

      <div
        className={`num mt-4 font-semibold leading-none tracking-tight ${numColor}`}
        style={{ fontSize: 'clamp(2.5rem, 5.5vw, 3.75rem)' }}
      >
        <AnimatedNumber
          value={value}
          prefix={prefix}
          suffix={suffix}
          decimals={decimals}
          duration={1400}
        />
      </div>

      <div className="mt-3 text-sm text-white/60 leading-snug">{context}</div>

      {comparison && (
        <div className="mt-auto pt-4 flex items-baseline justify-between gap-3 border-t border-white/[0.05]">
          <span className="text-[11px] text-white/45">{comparison.label}</span>
          <span className="num text-sm text-white/75">{comparison.value}</span>
        </div>
      )}
    </div>
  );
}
