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
  { k: 'AUM', v: '$50K · growing' },
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
      className="relative border-t border-white/[0.06] py-24 sm:py-32"
    >
      <div className="container-x">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <Reveal className="lg:col-span-5">
            <div className="text-[11px] uppercase tracking-[0.24em] text-moss-300/80">
              The Medallion Fund
            </div>
            <h2 className="mt-4 font-display text-3xl font-medium leading-tight tracking-tight sm:text-4xl">
              Closed-end portfolio,
              <br /> systematic strategies.
            </h2>
            <p className="mt-6 text-white/70 leading-relaxed">
              The Fund deploys capital across four uncorrelated strategies — three
              quantitative and one frontier-venture sleeve. Closed-end means we raise
              once per vintage, invest patiently, and report quarterly.
            </p>

            <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-white/[0.06] pt-6 text-sm">
              {terms.map((t) => (
                <div key={t.k}>
                  <dt className="text-[10.5px] uppercase tracking-[0.2em] text-white/45">
                    {t.k}
                  </dt>
                  <dd className="num mt-1 text-white">{t.v}</dd>
                </div>
              ))}
            </dl>

            <a
              href="#contact"
              className="mt-8 inline-flex items-center gap-2 text-sm text-moss-300 hover:text-moss-200"
            >
              Request the prospectus <span aria-hidden>→</span>
            </a>
          </Reveal>

          <Reveal delay={120} className="lg:col-span-7 space-y-8">
            <FundChart />

            <div className="rounded-md border border-white/[0.08] bg-ink-900/40 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="px-5 py-3 text-left text-[10.5px] font-medium uppercase tracking-[0.18em] text-white/45">
                      Returns
                    </th>
                    {TIMEFRAMES.map((t) => (
                      <th
                        key={t}
                        className="num px-3 py-3 text-right text-[10.5px] font-medium uppercase tracking-[0.18em] text-white/45"
                      >
                        {t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  <Row label="Solaria Capital · M4 V3" values={fundReturns} accent />
                  <Row label="S&P 500 (SPY)" values={spxReturns} muted />
                  <AlphaRow fund={fundReturns} bench={spxReturns} />
                </tbody>
              </table>
            </div>

            <div className="space-y-3">
              <div className="text-[10.5px] uppercase tracking-[0.2em] text-white/45">
                Strategy allocation
              </div>
              {allocation.map((a) => (
                <AllocationBar key={a.strategy} strategy={a.strategy} weight={a.weight} />
              ))}
            </div>

            <p className="text-[11px] text-white/40 leading-relaxed">
              Backtest figures are hypothetical, gross of fees, since April 2012.
              Past performance is not indicative of future results. Live fund
              inception Q1 2026.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
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
        className="h-full bg-moss-400/70 transition-[width] duration-[1100ms] ease-out"
        style={{ width: shown ? `${weight}%` : '0%' }}
      />
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
    <tr>
      <td
        className={`px-5 py-3 ${
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
            className={`num px-3 py-3 text-right ${
              accent ? (positive ? 'text-moss-300' : 'text-rose-400') : 'text-white/55'
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
    <tr className="bg-moss-500/[0.04]">
      <td className="px-5 py-3 text-moss-200">
        Outperformance{' '}
        <span className="text-[10px] text-white/35">
          (Solaria Capital − S&P, positive = beating the market)
        </span>
      </td>
      {TIMEFRAMES.map((t) => {
        const a = fund[t] - bench[t];
        const positive = a >= 0;
        return (
          <td
            key={t}
            className={`num px-3 py-3 text-right ${
              positive ? 'text-moss-200' : 'text-rose-400'
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
