import { useMemo, useRef } from 'react';
import { useReveal } from '../hooks/useReveal';
import { useScrollProgress } from '../hooks/useScrollProgress';
import { Eyebrow, SectionTitle } from './primitives';

/* Stable PRNG — same series across renders */
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function genSeries(seed: number, drift: number, vol: number): number[] {
  const rand = mulberry32(seed);
  const n = 168;
  const out: number[] = [];
  let v = 1;
  for (let i = 0; i < n; i++) {
    const cycle = Math.sin(i * 0.21) * 0.016 + Math.sin(i * 0.055) * 0.011;
    const shock = i === 32 || i === 68 || i === 110 ? -0.06 * vol : 0;
    v = Math.max(0.5, v * (1 + drift + cycle * vol * 0.25 + shock + (rand() - 0.5) * 0.011 * vol));
    out.push(v);
  }
  return out;
}

export default function Record() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const chartRef = useRef<HTMLDivElement | null>(null);
  const progress = useScrollProgress(chartRef);
  const [revealRef, inView] = useReveal(0.2);

  const { sol, spx } = useMemo(
    () => ({
      sol: genSeries(11, 0.0142, 1.0),
      spx: genSeries(42, 0.009, 0.85),
    }),
    []
  );

  const W = 1200,
    H = 480,
    padL = 64,
    padR = 40,
    padT = 36,
    padB = 48;
  const all = [...sol, ...spx];
  const maxV = Math.max(...all),
    minV = 0.85;
  const innerW = W - padL - padR,
    innerH = H - padT - padB;
  const x = (i: number) => padL + (i / (sol.length - 1)) * innerW;
  const y = (v: number) => padT + (1 - (v - minV) / (maxV - minV)) * innerH;

  const draw = Math.max(0.02, Math.min(1, (progress - 0.05) * 1.6));
  const drawIdx = Math.floor((sol.length - 1) * draw);

  const mkPath = (pts: number[], lim: number) =>
    pts
      .slice(0, lim + 1)
      .map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
      .join(' ');
  const mkArea = (pts: number[], lim: number) => {
    if (lim < 1) return '';
    return `${mkPath(pts, lim)} L ${x(lim).toFixed(1)} ${(padT + innerH).toFixed(1)} L ${padL} ${(
      padT + innerH
    ).toFixed(1)} Z`;
  };

  const years = ['2012', '2014', '2016', '2018', '2020', '2022', '2024', '2026'];
  const gridLines = [1, 3, 6, 10, 15];

  const cur = sol[drawIdx] || 1;
  const curSpx = spx[drawIdx] || 1;
  const monthIdx = drawIdx;
  const monthLabel = (() => {
    const d = new Date(2012, 3 + monthIdx, 1);
    return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  })();

  const events = [
    { i: 32, label: 'Volatility event · 2014' },
    { i: 68, label: 'Rate shock · 2017' },
    { i: 110, label: 'Pandemic drawdown · 2020' },
  ];

  return (
    <section id="record" ref={sectionRef} className="relative border-t border-line">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(230, 168, 42, 0.10) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />

      <div className="relative mx-auto max-w-[1400px] px-5 py-20 sm:px-10 sm:py-32 lg:px-16 lg:py-40">
        <div
          ref={revealRef}
          className={`max-w-3xl transition-all duration-1000 ${
            inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <Eyebrow>The record · M4 V3 backtest</Eyebrow>
          <SectionTitle className="mt-6">
            Fourteen years.
            <br />
            <span className="text-accent italic">One dollar became sixteen.</span>
          </SectionTitle>
          <div className="mt-6 font-mono text-[11px] tracking-[0.18em] uppercase text-fg-muted">
            Apr 2012 → Apr 2026 · S&P 500 grew $1 to $6.55
          </div>
        </div>

        <div
          ref={chartRef}
          className="mt-12 sm:mt-16 rounded-2xl border border-line bg-fg-b backdrop-blur-sm overflow-hidden ring-1 ring-inset ring-line"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-10">
            <div className="flex items-center gap-6">
              <div>
                <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-fg-faint">
                  Growth of $1
                </div>
                <div className="mt-0.5 font-mono text-[11px] tabular-nums text-fg-muted">
                  {monthLabel} · obs {drawIdx + 1}/168
                </div>
              </div>
              <div className="hidden sm:block h-8 w-px bg-white/[0.08]" />
              <div className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-[var(--accent-400)]" />
                <span className="text-[12px] text-fg">Solaria M4</span>
                <span className="font-mono text-[13px] tabular-nums text-accent-strong">
                  ${cur.toFixed(2)}
                </span>
              </div>
              <div className="hidden sm:flex items-center gap-2.5">
                <span className="h-0.5 w-4 rounded bg-[var(--fg-muted)]" />
                <span className="text-[12px] text-fg">S&P 500</span>
                <span className="font-mono text-[13px] tabular-nums text-fg-muted">
                  ${curSpx.toFixed(2)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 font-mono text-[10px] tabular-nums text-fg-faint">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-400)] animate-pulse" />
                Drawing {Math.round(draw * 100)}%
              </span>
            </div>
          </div>

          <div className="px-3 py-4 sm:px-6 text-accent-strong">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
              <defs>
                <linearGradient id="rec-area" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.5" />
                  <stop offset="70%" stopColor="currentColor" stopOpacity="0.04" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
                <filter id="rec-glow">
                  <feGaussianBlur stdDeviation="6" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              {gridLines.map((t) => (
                <g key={t}>
                  <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.08)" strokeDasharray="2 6" />
                  <text x={padL - 10} y={y(t) + 4} textAnchor="end" fontSize="11" fontFamily="JetBrains Mono" fill="rgba(255,255,255,0.4)">
                    ${t}
                  </text>
                </g>
              ))}
              {years.map((yr, i) => {
                const xi = padL + (i / (years.length - 1)) * innerW;
                return (
                  <text key={yr} x={xi} y={H - 14} textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono" fill="rgba(255,255,255,0.45)">
                    {yr}
                  </text>
                );
              })}
              {events.map((e) =>
                drawIdx >= e.i ? (
                  <g key={e.i}>
                    <line x1={x(e.i)} x2={x(e.i)} y1={padT} y2={padT + innerH} stroke="rgba(255,255,255,0.16)" strokeDasharray="2 3" />
                    <text x={x(e.i) + 6} y={padT + 14} fontSize="9.5" fontFamily="JetBrains Mono" fill="rgba(255,255,255,0.55)">
                      {e.label}
                    </text>
                  </g>
                ) : null
              )}
              {drawIdx > 0 && <path d={mkArea(sol, drawIdx)} fill="url(#rec-area)" />}
              {drawIdx > 0 && (
                <path
                  d={mkPath(spx, drawIdx)}
                  fill="none"
                  stroke="rgba(255,255,255,0.55)"
                  strokeWidth="1.4"
                  strokeDasharray="5 4"
                  strokeLinecap="round"
                />
              )}
              {drawIdx > 0 && (
                <path
                  d={mkPath(sol, drawIdx)}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  filter="url(#rec-glow)"
                />
              )}
              {drawIdx > 0 && (
                <g>
                  <circle cx={x(drawIdx)} cy={y(cur)} r="14" fill="currentColor" opacity="0.2" />
                  <circle cx={x(drawIdx)} cy={y(cur)} r="5" fill="currentColor" />
                  <circle cx={x(drawIdx)} cy={y(cur)} r="2.5" fill="var(--bg-a)" />
                </g>
              )}
            </svg>
          </div>

          <div className="grid grid-cols-2 gap-px border-t border-line bg-fg-b sm:grid-cols-4">
            {(
              [
                ['CAGR', '20.53%', 'vs SPX 13.45%', true],
                ['Sharpe', '1.46', 'vs HF bm ~0.60', true],
                ['Max drawdown', '−18.4%', 'vs SPX −33.8%', false],
                ['Monthly win rate', '65.48%', '110 of 168', false],
              ] as const
            ).map(([k, v, s, a]) => (
              <div key={k} className="bg-fg-b px-5 py-5 sm:px-10 sm:py-6">
                <div className="font-mono text-[9.5px] tracking-[0.22em] uppercase text-fg-faint">{k}</div>
                <div
                  className={`mt-2 font-display text-[1.7rem] tabular-nums font-semibold sm:text-[2.2rem] ${
                    a ? 'text-accent' : 'text-fg'
                  }`}
                >
                  {v}
                </div>
                <div className="mt-1.5 font-mono text-[10.5px] tabular-nums text-fg-faint">{s}</div>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-6 font-mono text-[10.5px] text-fg-faint max-w-3xl">
          Backtest figures are hypothetical, net of modeled transaction costs and fees. Past performance is
          not indicative of future results. Live fund inception Q1 2026.
        </p>
      </div>
    </section>
  );
}
