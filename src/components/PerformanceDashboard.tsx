import { useMemo } from 'react';
import Spotlight from './Spotlight';
import Reveal from './Reveal';
import YearlyBars from './YearlyBars';
import {
  TIMEFRAMES,
  type Timeframe,
  getMaster,
  rollingReturn,
  beta,
  rSquared,
  monthlyReturns,
  yearlyReturnsPaired,
  BACKTEST_STATS,
} from '../lib/fundData';

export default function PerformanceDashboard() {
  const master = useMemo(() => getMaster(), []);

  const fundReturns = useMemo(
    () =>
      Object.fromEntries(
        TIMEFRAMES.map((t) => [t, rollingReturn(master.fund, t)])
      ) as Record<Timeframe, number>,
    [master]
  );
  const spxReturns = useMemo(
    () =>
      Object.fromEntries(
        TIMEFRAMES.map((t) => [t, rollingReturn(master.spx, t)])
      ) as Record<Timeframe, number>,
    [master]
  );

  const bt = beta(master.fund, master.spx);
  const r2 = rSquared(master.fund, master.spx);

  const months = useMemo(() => monthlyReturns(master.fund, 12), [master]);
  const years = useMemo(() => yearlyReturnsPaired(), []);

  return (
    <section
      id="performance"
      className="relative py-28 sm:py-36 border-t border-white/[0.06] bg-gradient-to-b from-ink-950 via-ink-900/40 to-ink-950"
    >
      <div className="container-x">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <div className="label">Strategy Backtest</div>
              <h2 className="mt-4 font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
                14 years of conviction, in numbers.
              </h2>
              <p className="mt-5 text-lg text-white/70">
                Solaria's flagship quantitative model — back-tested on the universe of
                US equities from April 2012 through today, monthly rebalance, top-6
                portfolio. Results below are hypothetical and for illustration of the
                strategy, not live fund performance.
              </p>
            </div>
            <BacktestBadge />
          </div>
        </Reveal>

        {/* Headline metrics from Esteban's run — exact values */}
        <Reveal delay={80} className="mt-10">
          <div className="grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] sm:grid-cols-2 lg:grid-cols-5">
            <Headline
              label="Total return"
              value={`+${BACKTEST_STATS.totalReturnPct.toFixed(2)}%`}
              tone="moss"
              hint={BACKTEST_STATS.windowLabel}
            />
            <Headline
              label="CAGR"
              value={`${BACKTEST_STATS.cagrPct.toFixed(2)}%`}
              tone="moss"
              hint="annualised"
            />
            <Headline
              label="Sharpe"
              value={BACKTEST_STATS.sharpe.toFixed(2)}
              tone="moss"
              hint="risk-adj. return"
            />
            <Headline
              label="Volatility"
              value={`${BACKTEST_STATS.volAnnPct.toFixed(2)}%`}
              hint="annualised"
            />
            <Headline
              label="Max drawdown"
              value={`${BACKTEST_STATS.maxDrawdownPct.toFixed(2)}%`}
              tone="rose-soft"
              hint="peak to trough"
            />
          </div>
        </Reveal>

        <Reveal delay={140} className="mt-6">
          <Spotlight intensity={0.12} className="rounded-2xl">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-ink-900/55 backdrop-blur-sm">
              <ReturnsTable fundReturns={fundReturns} spxReturns={spxReturns} />
            </div>
          </Spotlight>
        </Reveal>

        <div className="mt-6 grid gap-6 lg:grid-cols-12">
          <Reveal delay={200} className="lg:col-span-5">
            <Spotlight intensity={0.12} className="rounded-2xl h-full">
              <div className="h-full rounded-2xl border border-white/10 bg-ink-900/55 p-6 sm:p-7">
                <div className="flex items-center justify-between">
                  <div className="label">Risk &amp; Quality</div>
                  <div className="num text-[10px] text-white/40">Annualised</div>
                </div>
                <dl className="mt-5 space-y-2.5">
                  <Metric label="Sharpe ratio" value={BACKTEST_STATS.sharpe.toFixed(2)} hint="≥ 1.0 is institutional" tone="moss" />
                  <Metric label="Volatility" value={`${BACKTEST_STATS.volAnnPct.toFixed(2)}%`} hint={`vs SPY ~${BACKTEST_STATS.spxVolAnnPct}%`} />
                  <Metric label="Max drawdown" value={`${BACKTEST_STATS.maxDrawdownPct.toFixed(2)}%`} hint="peak-to-trough" tone="rose-soft" />
                  <Metric label="Beta vs SPY" value={bt.toFixed(2)} hint="market sensitivity" />
                  <Metric label="R² vs SPY" value={r2.toFixed(2)} hint="variance explained by SPY" />
                  <Metric label="Monthly win rate" value={`${BACKTEST_STATS.monthlyWinRatePct.toFixed(1)}%`} hint="positive months" tone="moss" />
                  <Metric label="Avg up month" value={`+${BACKTEST_STATS.avgMonthPct.toFixed(2)}%`} hint={`median ${BACKTEST_STATS.medianMonthPct.toFixed(2)}%`} />
                </dl>
              </div>
            </Spotlight>
          </Reveal>

          <Reveal delay={280} className="lg:col-span-7 space-y-6">
            <Spotlight intensity={0.12} className="rounded-2xl">
              <div className="rounded-2xl border border-white/10 bg-ink-900/55 p-6 sm:p-7">
                <div className="flex items-center justify-between">
                  <div className="label">Monthly Returns · last 12</div>
                  <div className="num text-[10px] text-white/40">% per month</div>
                </div>
                <MonthlyHeatmap months={months} />
                <div className="mt-5 grid grid-cols-3 gap-3 text-xs">
                  <DistStat
                    label="Best month (ITD)"
                    value={`+${BACKTEST_STATS.bestMonthPct.toFixed(2)}%`}
                    sub="single month"
                    tone="moss"
                  />
                  <DistStat
                    label="Worst month (ITD)"
                    value={`${BACKTEST_STATS.worstMonthPct.toFixed(2)}%`}
                    sub="single month"
                    tone="rose"
                  />
                  <DistStat
                    label="Win rate"
                    value={`${BACKTEST_STATS.monthlyWinRatePct.toFixed(1)}%`}
                    sub={`avg +${BACKTEST_STATS.avgMonthPct.toFixed(2)}%`}
                    tone="moss"
                  />
                </div>
              </div>
            </Spotlight>

            <Spotlight intensity={0.12} className="rounded-2xl">
              <div className="rounded-2xl border border-white/10 bg-ink-900/55 p-6 sm:p-7">
                <div className="flex items-center justify-between">
                  <div className="label">Yearly Returns · Solaria vs S&P 500</div>
                  <div className="num text-[10px] text-white/40">
                    Solaria best +{BACKTEST_STATS.bestYearPct.toFixed(2)}% · worst {BACKTEST_STATS.worstYearPct.toFixed(2)}%
                  </div>
                </div>
                <YearlyBars rows={years} />
              </div>
            </Spotlight>
          </Reveal>
        </div>

        <Reveal delay={360} className="mt-8 rounded-xl border border-white/[0.07] bg-ink-900/40 p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded-full border border-white/15 text-[10px] text-white/55">
              i
            </span>
            <div className="space-y-2 text-[12px] leading-relaxed text-white/55">
              <p>
                <span className="text-white/80">Methodology.</span> {BACKTEST_STATS.strategy}.
                Universe: liquid US equities. Rebalance: monthly close. Backtest run by
                Solaria Research; alternative hold counts (1–20) and rebalance frequencies
                (daily, weekly, biweekly, 3×/month, monthly) were tested — the Top 6
                monthly configuration was selected for its combination of risk-adjusted
                return (Sharpe {BACKTEST_STATS.sharpe.toFixed(2)}) and equity-curve smoothness.
              </p>
              <p>
                <span className="text-white/80">Important.</span> Hypothetical backtested
                performance is shown gross of fees and includes no transaction-cost
                assumptions beyond standard slippage. Backtest results have inherent
                limitations and do not represent actual trading. Past performance —
                including hypothetical performance — is not indicative of future results.
                The live Medallion Fund inception is Q1 2026 and is reported separately.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function BacktestBadge() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-200">
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <circle cx="8" cy="8" r="6.5" />
        <path d="M8 4v4l2.5 1.5" strokeLinecap="round" />
      </svg>
      <span className="num uppercase tracking-[0.2em]">Backtest · Hypothetical</span>
    </div>
  );
}

function Headline({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'moss' | 'rose-soft';
}) {
  const color =
    tone === 'moss' ? 'text-moss-300' : tone === 'rose-soft' ? 'text-rose-300' : 'text-white';
  return (
    <div className="bg-ink-900/60 p-5 transition-colors hover:bg-ink-800/80">
      <div className="label !text-[10px] !tracking-[0.18em] !text-white/40">{label}</div>
      <div className={`num mt-2 text-2xl ${color}`}>{value}</div>
      {hint && <div className="mt-1 text-[10.5px] text-white/35">{hint}</div>}
    </div>
  );
}

function ReturnsTable({
  fundReturns,
  spxReturns,
}: {
  fundReturns: Record<Timeframe, number>;
  spxReturns: Record<Timeframe, number>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] bg-white/[0.02]">
            <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">
              Rolling returns
            </th>
            {TIMEFRAMES.map((t) => (
              <th
                key={t}
                className="num px-4 py-3 text-right text-[11px] font-medium uppercase tracking-[0.18em] text-white/45"
              >
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          <Row label="Solaria · M4 V3" values={fundReturns} accent />
          <Row label="S&P 500 (SPY)" values={spxReturns} muted />
          <AlphaRow fund={fundReturns} bench={spxReturns} />
        </tbody>
      </table>
    </div>
  );
}

function Row({
  label,
  values,
  accent,
  muted,
}: {
  label: string;
  values: Record<Timeframe, number>;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <tr className="hover:bg-white/[0.02]">
      <td className={`px-5 py-3.5 ${accent ? 'text-white' : muted ? 'text-white/65' : 'text-white/85'}`}>
        <span className={accent ? 'font-display' : ''}>{label}</span>
      </td>
      {TIMEFRAMES.map((t) => {
        const v = values[t];
        const positive = v >= 0;
        return (
          <td
            key={t}
            className={`num px-4 py-3.5 text-right ${
              accent ? (positive ? 'text-moss-300' : 'text-rose-400') : 'text-white/55'
            }`}
          >
            {positive ? '+' : ''}
            {fmtPct(v)}
          </td>
        );
      })}
    </tr>
  );
}

function AlphaRow({
  fund,
  bench,
}: {
  fund: Record<Timeframe, number>;
  bench: Record<Timeframe, number>;
}) {
  return (
    <tr className="bg-moss-500/[0.04] hover:bg-moss-500/[0.08]">
      <td className="px-5 py-3.5 text-moss-200">
        <span className="font-display">Outperformance</span>
        <span className="ml-2 text-[10px] text-white/35">
          Solaria − S&P 500 · positive = beating the market
        </span>
      </td>
      {TIMEFRAMES.map((t) => {
        const a = fund[t] - bench[t];
        const positive = a >= 0;
        return (
          <td
            key={t}
            className={`num px-4 py-3.5 text-right font-semibold ${
              positive ? 'text-moss-200' : 'text-rose-400'
            }`}
          >
            {positive ? '+' : ''}
            {fmtPct(a)}
          </td>
        );
      })}
    </tr>
  );
}

function fmtPct(v: number): string {
  if (Math.abs(v) >= 100) return `${v.toFixed(1)}%`;
  return `${v.toFixed(2)}%`;
}

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'moss' | 'rose-soft';
}) {
  const valueColor =
    tone === 'moss' ? 'text-moss-300' : tone === 'rose-soft' ? 'text-rose-300' : 'text-white';
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/[0.04] pb-2.5 last:border-b-0">
      <div>
        <div className="text-sm text-white/85">{label}</div>
        {hint && <div className="text-[10.5px] text-white/35">{hint}</div>}
      </div>
      <div className={`num text-lg ${valueColor}`}>{value}</div>
    </div>
  );
}

function MonthlyHeatmap({ months }: { months: { label: string; year: number; value: number }[] }) {
  const maxAbs = Math.max(...months.map((m) => Math.abs(m.value)), 1);
  return (
    <div className="mt-5">
      <div className="grid grid-cols-12 gap-1.5">
        {months.map((m) => {
          const ratio = Math.min(1, Math.abs(m.value) / maxAbs);
          const positive = m.value >= 0;
          const opacity = ratio * 0.6 + 0.08;
          const bg = positive
            ? `rgba(52, 211, 153, ${opacity})`
            : `rgba(244, 63, 94, ${opacity})`;
          const ring = positive
            ? 'ring-moss-500/30 hover:ring-moss-500/60'
            : 'ring-rose-500/30 hover:ring-rose-500/60';
          return (
            <div
              key={`${m.year}-${m.label}`}
              className={`group relative aspect-square rounded-md ring-1 ${ring} transition-transform hover:scale-[1.07] cursor-default`}
              style={{ backgroundColor: bg }}
              title={`${m.label} ${m.year}: ${m.value >= 0 ? '+' : ''}${m.value.toFixed(2)}%`}
            >
              <div
                className={`num absolute inset-0 grid place-items-center text-[11px] ${
                  positive ? 'text-moss-100' : 'text-rose-100'
                }`}
              >
                {m.value >= 0 ? '+' : ''}
                {m.value.toFixed(1)}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 grid grid-cols-12 gap-1.5">
        {months.map((m, i) => (
          <div
            key={`${m.year}-${m.label}-lbl-${i}`}
            className="num text-center text-[10px] text-white/45"
          >
            {m.label[0]}
          </div>
        ))}
      </div>
    </div>
  );
}

function DistStat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: 'moss' | 'rose' | 'muted';
}) {
  const color =
    tone === 'moss' ? 'text-moss-300' : tone === 'rose' ? 'text-rose-400' : 'text-white';
  return (
    <div className="rounded-lg border border-white/10 bg-ink-950/40 p-3">
      <div className="label !text-[10px] !tracking-[0.18em] !text-white/40">{label}</div>
      <div className={`num mt-1 text-base ${color}`}>{value}</div>
      <div className="num mt-0.5 text-[10px] text-white/35">{sub}</div>
    </div>
  );
}
