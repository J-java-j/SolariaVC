import FundChart from './FundChart';
import Reveal from './Reveal';
import AnimatedNumber from './AnimatedNumber';
import { useInView } from '../hooks/useInView';
import {
  TIMEFRAMES,
  type Timeframe,
  getMaster,
  rollingReturn,
} from '../lib/fundData';
import { useMemo } from 'react';

const allocation = [
  { strategy: 'Statistical Arbitrage', weight: 32 },
  { strategy: 'Equity Momentum', weight: 24 },
  { strategy: 'Volatility Carry', weight: 18 },
  { strategy: 'Frontier Venture', weight: 26 },
];

const terms = [
  { k: 'Structure', v: 'Closed-end LLC' },
  { k: 'Vintage', v: '2026' },
  { k: 'Access', v: 'By introduction' },
  { k: 'Min. commitment', v: '$1,000' },
  { k: 'Lock-up', v: '12 months' },
  { k: 'Mgmt / Perf', v: '0 / 20' },
];

export default function MedallionFund() {
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

  return (
    <section
      id="fund"
      className="relative border-t border-white/[0.06] py-20 sm:py-28 lg:py-36"
    >
      <div className="container-x">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <Reveal className="lg:col-span-5">
            <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-amber-300/80">
              The Medallion Fund · Q2 2026
            </div>
            <h2 className="mt-4 font-display text-2xl font-medium leading-tight tracking-tight sm:text-3xl lg:text-4xl">
              Closed cohort.
              <br /> Patient capital.
            </h2>
            <p className="mt-5 text-white/65 leading-relaxed">
              Subscriptions are accepted by introduction. Limited to a small
              partnership of accredited investors per vintage.
            </p>

            <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-white/[0.06] pt-6 text-sm">
              {terms.map((t) => (
                <div key={t.k}>
                  <dt className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/45">
                    {t.k}
                  </dt>
                  <dd className="num mt-1 text-white">{t.v}</dd>
                </div>
              ))}
            </dl>

            <a
              href="#contact"
              className="mt-8 inline-flex items-center gap-2 text-sm text-amber-300 transition-colors hover:text-amber-200"
            >
              Request an introduction <span aria-hidden>→</span>
            </a>
          </Reveal>

          <Reveal delay={120} className="lg:col-span-7 space-y-8">
            <FundChart />

            <div className="rounded-md border border-white/[0.08] bg-ink-900/40 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.18em] text-white/45 sm:px-5">
                      Returns
                    </th>
                    {TIMEFRAMES.map((t) => (
                      <th
                        key={t}
                        className="num px-2 py-3 text-right text-[10px] font-medium uppercase tracking-[0.18em] text-white/45 sm:px-3"
                      >
                        {t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  <Row label="Solaria Capital" values={fundReturns} accent />
                  <Row label="S&P 500" values={spxReturns} muted />
                  <AlphaRow fund={fundReturns} bench={spxReturns} />
                </tbody>
              </table>
            </div>

            <div className="space-y-3">
              <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/45">
                Strategy allocation
              </div>
              {allocation.map((a) => (
                <AllocationBar key={a.strategy} strategy={a.strategy} weight={a.weight} />
              ))}
            </div>

            <p className="text-[11px] text-white/40 leading-relaxed">
              Backtest figures are hypothetical, gross of fees, since April 2012.
              Past performance is not indicative of future results.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
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
    <tr>
      <td
        className={`px-4 py-3 sm:px-5 ${
          accent ? 'text-white' : muted ? 'text-white/65' : 'text-white/85'
        }`}
      >
        {label}
      </td>
      {TIMEFRAMES.map((t) => {
        const v = values[t];
        const positive = v >= 0;
        return (
          <td
            key={t}
            className={`num px-2 py-3 text-right sm:px-3 ${
              accent ? (positive ? 'text-amber-300' : 'text-rose-400') : 'text-white/55'
            }`}
          >
            {positive ? '+' : ''}
            {v >= 100 ? v.toFixed(1) : v.toFixed(2)}%
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
    <tr className="bg-amber-500/[0.05]">
      <td className="px-4 py-3 text-amber-200 sm:px-5">
        Outperformance
      </td>
      {TIMEFRAMES.map((t) => {
        const a = fund[t] - bench[t];
        const positive = a >= 0;
        return (
          <td
            key={t}
            className={`num px-2 py-3 text-right sm:px-3 ${
              positive ? 'text-amber-200' : 'text-rose-400'
            }`}
          >
            {positive ? '+' : ''}
            {Math.abs(a) >= 100 ? a.toFixed(1) : a.toFixed(2)}%
          </td>
        );
      })}
    </tr>
  );
}

function AllocationBar({ strategy, weight }: { strategy: string; weight: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-white/85">{strategy}</span>
        <span className="num text-white/65">
          <AnimatedNumber value={weight} suffix="%" duration={1100} />
        </span>
      </div>
      <BarTrack weight={weight} />
    </div>
  );
}

function BarTrack({ weight }: { weight: number }) {
  const [ref, shown] = useInView<HTMLDivElement>({ threshold: 0.4 });
  return (
    <div
      ref={ref}
      className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/[0.05]"
    >
      <div
        className="h-full bg-amber-400/60 transition-[width] duration-[1100ms] ease-out"
        style={{ width: shown ? `${weight}%` : '0%' }}
      />
    </div>
  );
}
