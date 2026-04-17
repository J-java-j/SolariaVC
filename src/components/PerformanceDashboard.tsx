import { useMemo } from 'react';
import Spotlight from './Spotlight';
import Reveal from './Reveal';
import {
  TIMEFRAMES,
  type Timeframe,
  getMaster,
  rollingReturn,
  sharpe,
  sortino,
  annualizedVol,
  maxDrawdown,
  beta,
  rSquared,
  hitRate,
  monthlyReturns,
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

  const sr = sharpe(master.fund);
  const sn = sortino(master.fund);
  const vol = annualizedVol(master.fund);
  const mdd = maxDrawdown(master.fund);
  const bt = beta(master.fund, master.spx);
  const r2 = rSquared(master.fund, master.spx);
  const hr = hitRate(master.fund);

  const months = useMemo(() => monthlyReturns(master.fund, 12), [master]);
  const best = months.reduce((a, b) => (b.value > a.value ? b : a), months[0]);
  const worst = months.reduce((a, b) => (b.value < a.value ? b : a), months[0]);

  return (
    <section
      id="performance"
      className="relative py-28 sm:py-36 border-t border-white/[0.06] bg-gradient-to-b from-ink-950 via-ink-900/40 to-ink-950"
    >
      <div className="container-x">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <div className="label">Performance · Indicative</div>
              <h2 className="mt-4 font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
                The full picture.
              </h2>
              <p className="mt-5 text-lg text-white/70">
                A real-time snapshot of how the Medallion Fund is performing — returns,
                risk-adjusted statistics, drawdown, and the monthly distribution. Same data
                that powers the chart below.
              </p>
            </div>
            <LiveBadge />
          </div>
        </Reveal>

        <Reveal delay={120} className="mt-12">
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
                  <div className="num text-[10px] text-white/40">Annualized</div>
                </div>
                <dl className="mt-5 space-y-2.5">
                  <Metric label="Sharpe ratio" value={sr.toFixed(2)} hint="≥ 2.0 is institutional" tone="moss" />
                  <Metric label="Sortino ratio" value={sn.toFixed(2)} hint="downside-only Sharpe" tone="moss" />
                  <Metric label="Volatility" value={`${vol.toFixed(1)}%`} hint="vs SPX ~16%" />
                  <Metric label="Max drawdown" value={`${mdd.toFixed(2)}%`} hint="peak-to-trough" tone="rose-soft" />
                  <Metric label="Beta vs SPX" value={bt.toFixed(2)} hint="market sensitivity" />
                  <Metric label="R²" value={r2.toFixed(2)} hint="variance explained by SPX" />
                  <Metric label="Hit rate" value={`${hr.toFixed(0)}%`} hint="positive trading days" />
                </dl>
              </div>
            </Spotlight>
          </Reveal>

          <Reveal delay={280} className="lg:col-span-7">
            <Spotlight intensity={0.12} className="rounded-2xl h-full">
              <div className="h-full rounded-2xl border border-white/10 bg-ink-900/55 p-6 sm:p-7">
                <div className="flex items-center justify-between">
                  <div className="label">Monthly Returns · last 12</div>
                  <div className="num text-[10px] text-white/40">% per month</div>
                </div>
                <MonthlyHeatmap months={months} />
                <div className="mt-5 grid grid-cols-3 gap-3 text-xs">
                  <DistStat label="Best month" value={`${best?.value.toFixed(2)}%`} sub={best?.label || '—'} tone="moss" />
                  <DistStat
                    label="Worst month"
                    value={`${worst?.value.toFixed(2)}%`}
                    sub={worst?.label || '—'}
                    tone={worst && worst.value < 0 ? 'rose' : 'muted'}
                  />
                  <DistStat
                    label="Win rate"
                    value={`${((months.filter((m) => m.value > 0).length / months.length) * 100).toFixed(0)}%`}
                    sub={`${months.filter((m) => m.value > 0).length} of ${months.length}`}
                  />
                </div>
              </div>
            </Spotlight>
          </Reveal>
        </div>

        <Reveal delay={360} className="mt-6 text-[11px] text-white/40">
          Indicative figures derived from the fund's modeled NAV path. Not a prospectus,
          not investment advice. Real performance reporting begins with the Q2 2026
          investor letter.
        </Reveal>
      </div>
    </section>
  );
}

function LiveBadge() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-white/70">
      <span className="relative flex h-2 w-2">
        <span className="absolute inset-0 animate-ping rounded-full bg-moss-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-moss-400" />
      </span>
      <span className="num uppercase tracking-[0.2em]">Live · updated continuously</span>
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
          <Row label="Medallion Fund" values={fundReturns} accent />
          <Row label="S&P 500" values={spxReturns} muted />
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
      <td
        className={`px-5 py-3.5 ${
          accent ? 'text-white' : muted ? 'text-white/65' : 'text-white/85'
        }`}
      >
        <span className={accent ? 'font-display' : ''}>{label}</span>
      </td>
      {TIMEFRAMES.map((t) => {
        const v = values[t];
        const positive = v >= 0;
        return (
          <td
            key={t}
            className={`num px-4 py-3.5 text-right ${
              accent
                ? positive
                  ? 'text-moss-300'
                  : 'text-rose-400'
                : 'text-white/55'
            }`}
          >
            {positive ? '+' : ''}
            {v.toFixed(2)}%
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
            {a.toFixed(2)}%
          </td>
        );
      })}
    </tr>
  );
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
  // color scale: rose for negative, moss for positive, intensity by magnitude
  const maxAbs = Math.max(...months.map((m) => Math.abs(m.value)), 1);

  return (
    <div className="mt-5">
      <div className="grid grid-cols-12 gap-1.5">
        {months.map((m) => {
          const ratio = Math.min(1, Math.abs(m.value) / maxAbs);
          const positive = m.value >= 0;
          // background opacity = ratio * 0.65 + 0.05
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
