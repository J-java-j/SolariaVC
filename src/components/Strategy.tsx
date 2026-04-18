import { useMemo, useState } from 'react';
import { useReveal } from '../hooks/useReveal';
import { useCountUp } from '../hooks/useCountUp';
import { Eyebrow, SectionTitle } from './primitives';

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Sleeve = {
  code: string;
  name: string;
  w: number;
  cagr: number;
  sharpe: number;
  dd: number;
  desc: string;
  color: string;
};

const strats: Sleeve[] = [
  {
    code: 'M4-STATARB',
    name: 'Statistical Arbitrage',
    w: 32,
    cagr: 14.8,
    sharpe: 1.82,
    dd: -6.2,
    desc: 'Market-neutral pairs and basket trades on residuals after factor neutralisation. Thousands of small bets, held for days to weeks.',
    color: '#34d399',
  },
  {
    code: 'M4-MOMO',
    name: 'Equity Momentum',
    w: 24,
    cagr: 18.1,
    sharpe: 1.31,
    dd: -14.8,
    desc: 'Cross-sectional momentum on US large-caps with volatility targeting. Long winners, short laggards, rebalanced monthly.',
    color: '#10b981',
  },
  {
    code: 'M4-VOLC',
    name: 'Volatility Carry',
    w: 18,
    cagr: 22.4,
    sharpe: 1.54,
    dd: -11.4,
    desc: 'Systematic short variance, sized by the Solaria VRP model, fully tail-hedged. Earn the insurance premium, cap the left tail.',
    color: '#059669',
  },
  {
    code: 'M4-VENT',
    name: 'Frontier Venture',
    w: 26,
    cagr: 28.9,
    sharpe: 1.09,
    dd: -22.1,
    desc: 'Illiquid sleeve co-invested from Solaria Ventures, scored by the SR-026 factor model. Pre-seed and seed, 18–24 month underwriting.',
    color: '#6ee7b7',
  },
];

export default function Strategy() {
  const [active, setActive] = useState(0);
  const s = strats[active];
  const [revealRef, inView] = useReveal(0.15);

  const curve = useMemo(() => {
    const n = 80;
    const rand = mulberry32(active + 99);
    const out: number[] = [];
    let v = 1;
    const drift = s.cagr / 100 / 12;
    const vol = -s.dd / 100 / 3;
    for (let i = 0; i < n; i++) {
      v = Math.max(
        0.7,
        v * (1 + drift + (rand() - 0.5) * vol * 0.5 + Math.sin(i * 0.3) * vol * 0.2)
      );
      out.push(v);
    }
    return out;
  }, [active, s]);

  const cagr = useCountUp(s.cagr, inView, 1400, 2);
  const sharpe = useCountUp(s.sharpe, inView, 1400, 2);

  return (
    <section id="strategy" className="relative border-t border-line">
      <div className="mx-auto max-w-[1400px] px-5 py-20 sm:px-10 sm:py-32 lg:px-16 lg:py-40">
        <div
          ref={revealRef}
          className={`max-w-3xl transition-all duration-1000 ${
            inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <Eyebrow>Strategy · M4 model stack</Eyebrow>
          <SectionTitle className="mt-6">
            Four sleeves.
            <br />
            <span className="text-accent">ρ = 0.055.</span>
          </SectionTitle>
        </div>

        <div className="mt-10 sm:mt-14 grid gap-6 sm:gap-8 lg:grid-cols-12">
          {/* Left: sleeve rail */}
          <div className="lg:col-span-5 space-y-2.5">
            {strats.map((st, i) => {
              const activeBool = i === active;
              return (
                <button
                  key={st.code}
                  onClick={() => setActive(i)}
                  onMouseEnter={() => setActive(i)}
                  className={`group w-full text-left rounded-xl border p-5 transition-all duration-300 ${
                    activeBool
                      ? 'border-line-strong bg-fg-b ring-1 ring-[rgba(var(--accent-rgb),0.2)]'
                      : 'border-line bg-fg-b hover:border-line-strong'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[10px] tracking-[0.18em] text-fg-faint">{st.code}</span>
                      <h3 className={`font-display text-[1.2rem] tracking-tight transition-colors ${activeBool ? 'text-accent-strong' : 'text-fg'}`}>
                        {st.name}
                      </h3>
                    </div>
                    <span className="font-mono text-[11px] tabular-nums text-accent-strong">{st.w}%</span>
                  </div>
                  <div className="mt-3 h-1 w-full rounded-full bg-[var(--line)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${st.w * 2.8}%`,
                        background: activeBool
                          ? `linear-gradient(90deg, ${st.color}, var(--accent-200))`
                          : 'rgba(125, 100, 70, 0.18)',
                      }}
                    />
                  </div>
                  <div
                    className={`grid grid-cols-3 gap-4 mt-4 font-mono text-[10.5px] transition-opacity ${
                      activeBool ? 'opacity-100' : 'opacity-60'
                    }`}
                  >
                    <div>
                      <span className="text-fg-faint">CAGR </span>
                      <span className="text-accent-strong tabular-nums">{st.cagr}%</span>
                    </div>
                    <div>
                      <span className="text-fg-faint">Sharpe </span>
                      <span className="text-fg tabular-nums">{st.sharpe}</span>
                    </div>
                    <div>
                      <span className="text-fg-faint">MaxDD </span>
                      <span className="text-rose-400 tabular-nums">{st.dd}%</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right: detail panel */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl border border-line bg-fg-b backdrop-blur-sm overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-6 py-3.5">
                <div className="flex items-center gap-2.5 font-mono text-[10.5px] tracking-[0.18em] uppercase text-fg-faint">
                  <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: s.color }} />
                  {s.code} · SLEEVE DETAIL
                </div>
                <div className="font-mono text-[10.5px] tabular-nums text-fg-faint">allocation {s.w}%</div>
              </div>

              <div className="p-6 sm:p-8">
                <h3 className="font-display text-[1.7rem] sm:text-[2rem] tracking-tight text-fg">{s.name}</h3>

                <div className="mt-6 grid grid-cols-4 gap-4 sm:gap-6 border-y border-line py-5">
                  {(
                    [
                      ['CAGR', cagr + '%', true],
                      ['Sharpe', sharpe, true],
                      ['Max DD', s.dd + '%', false],
                      ['Weight', s.w + '%', false],
                    ] as const
                  ).map(([k, v, a]) => (
                    <div key={k}>
                      <div className="font-mono text-[9.5px] tracking-[0.22em] uppercase text-fg-faint">{k}</div>
                      <div className={`mt-1.5 font-display text-[1.3rem] sm:text-[1.5rem] tabular-nums font-semibold ${a ? 'text-accent' : 'text-fg'}`}>
                        {v}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-7">
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-[9.5px] tracking-[0.22em] uppercase text-fg-faint">
                      Equity curve (rescaled)
                    </div>
                    <div className="font-mono text-[10px] tabular-nums text-fg-faint">n=80</div>
                  </div>
                  <svg viewBox="0 0 600 140" className="mt-3 w-full">
                    <defs>
                      <linearGradient id="s-area" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor={s.color} stopOpacity="0.35" />
                        <stop offset="100%" stopColor={s.color} stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {(() => {
                      const maxv = Math.max(...curve),
                        minv = Math.min(...curve);
                      const xs = (i: number) => (i / (curve.length - 1)) * 600;
                      const ys = (v: number) => 120 - ((v - minv) / (maxv - minv)) * 105 - 10;
                      const path = curve
                        .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xs(i).toFixed(1)} ${ys(v).toFixed(1)}`)
                        .join(' ');
                      const area = `${path} L 600 130 L 0 130 Z`;
                      return (
                        <g key={active}>
                          <path d={area} fill="url(#s-area)" style={{ animation: 'fadeIn .6s ease-out' }} />
                          <path
                            d={path}
                            fill="none"
                            stroke={s.color}
                            strokeWidth="2"
                            strokeLinecap="round"
                            style={{ animation: 'fadeIn .6s ease-out' }}
                          />
                          <circle cx={xs(curve.length - 1)} cy={ys(curve[curve.length - 1])} r="4" fill={s.color} />
                        </g>
                      );
                    })()}
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }`}</style>
    </section>
  );
}
