import FundChart from './FundChart';
import Spotlight from './Spotlight';

const allocation = [
  { strategy: 'Statistical Arbitrage', weight: 32, color: '#34d399' },
  { strategy: 'Equity Momentum', weight: 24, color: '#10b981' },
  { strategy: 'Volatility Carry', weight: 18, color: '#059669' },
  { strategy: 'Frontier Venture', weight: 26, color: '#047857' },
];

const terms = [
  { k: 'Structure', v: 'Closed-end LLC' },
  { k: 'Vintage', v: '2026' },
  { k: 'Min. commitment', v: '$25,000' },
  { k: 'Lock-up', v: '24 months' },
  { k: 'Mgmt / Perf', v: '1.5 / 20' },
  { k: 'Domicile', v: 'Delaware, USA' },
];

export default function MedallionFund() {
  return (
    <section id="fund" className="relative py-28 sm:py-36 border-t border-white/[0.06]">
      <div className="absolute inset-0 -z-10 dot-bg opacity-50" aria-hidden />
      <div className="container-x">
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-5">
            <div className="label">The Medallion Fund</div>
            <h2 className="mt-4 font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
              A closed-end portfolio, run on systematic conviction.
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-white/70">
              The Medallion Fund deploys capital across four uncorrelated strategies — three quantitative,
              one frontier-venture. Closed-end means we raise once, invest with patience, and report with
              discipline. No mark-to-narrative.
            </p>

            <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
              {terms.map((t) => (
                <div
                  key={t.k}
                  className="bg-ink-900/60 px-5 py-4 transition-colors hover:bg-ink-800/80"
                >
                  <div className="label !text-white/40 !text-[10px]">{t.k}</div>
                  <div className="num mt-1.5 text-white">{t.v}</div>
                </div>
              ))}
            </div>

            <a
              href="#contact"
              className="mt-10 inline-flex items-center gap-2 rounded-md bg-moss-500 px-5 py-3 text-sm font-semibold text-ink-950 transition-all hover:bg-moss-400 hover:translate-y-[-1px] glow-moss"
            >
              Request the prospectus
              <span aria-hidden>→</span>
            </a>
          </div>

          <div className="lg:col-span-7 space-y-6">
            <Spotlight>
              <FundChart />
            </Spotlight>
            <Spotlight>
              <AllocationCard />
            </Spotlight>
          </div>
        </div>
      </div>
    </section>
  );
}

function AllocationCard() {
  return (
    <div className="rounded-2xl border border-white/10 bg-ink-900/55 p-6 sm:p-8">
      <div className="flex items-center justify-between">
        <div className="label">Strategy Allocation</div>
        <div className="num text-[10px] text-white/40">Target weights · rebalanced quarterly</div>
      </div>
      <div className="mt-5 space-y-4">
        {allocation.map((a) => (
          <div key={a.strategy} className="group">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2.5 text-white/85">
                <span className="h-2 w-2 rounded-sm" style={{ background: a.color }} />
                {a.strategy}
              </span>
              <span className="num text-white/65 transition-colors group-hover:text-white">
                {a.weight}%
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
              <div
                className="h-full rounded-full transition-all duration-500 group-hover:opacity-90"
                style={{
                  width: `${a.weight}%`,
                  background: `linear-gradient(90deg, ${a.color}aa, ${a.color})`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
