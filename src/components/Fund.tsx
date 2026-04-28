import { useRef } from 'react';
import { Eyebrow } from './primitives';
import { useScrollProgress } from '../hooks/useScrollProgress';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const PTS: [number, number][] = [
  [0, 220], [40, 210], [80, 204], [120, 192], [160, 188],
  [200, 174], [240, 168], [280, 152], [320, 146], [360, 124],
  [400, 112], [440, 96], [480, 78], [520, 58], [560, 36], [600, 18],
];

const PATH_D = PTS.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt[0]} ${pt[1]}`).join(' ');

function ScrollChart({ progress }: { progress: number }) {
  const W = 600;
  const H = 240;
  const drawT = clamp01((progress - 0.15) / 0.55);
  const idx = Math.min(PTS.length - 1, Math.floor(drawT * (PTS.length - 1)));
  const t = drawT * (PTS.length - 1) - idx;
  const a = PTS[idx];
  const b = PTS[Math.min(PTS.length - 1, idx + 1)];
  const dx = a[0] + (b[0] - a[0]) * t;
  const dy = a[1] + (b[1] - a[1]) * t;
  const areaPath = `${PATH_D} L ${W} ${H} L 0 ${H} Z`;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" preserveAspectRatio="none">
        {[60, 130, 200].map((y) => (
          <line key={y} x1="0" x2={W} y1={y} y2={y} stroke="var(--ink-line)" strokeDasharray="2 4" />
        ))}
        <defs>
          <linearGradient id="fundAreaGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--moss)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--moss)" stopOpacity="0" />
          </linearGradient>
          <clipPath id="fundAreaClip">
            <rect x="0" y="0" width={W * drawT} height={H} />
          </clipPath>
        </defs>
        <path d={areaPath} fill="url(#fundAreaGrad)" clipPath="url(#fundAreaClip)" />
        <path
          d={PATH_D}
          fill="none"
          stroke="var(--moss)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          style={{
            strokeDasharray: 1,
            strokeDashoffset: 1 - drawT,
            transition: 'stroke-dashoffset 120ms linear',
          }}
        />
        <circle cx={dx} cy={dy} r="11" fill="var(--moss)" opacity="0.18" />
        <circle
          cx={dx}
          cy={dy}
          r="5"
          fill="var(--moss)"
          style={{ opacity: drawT > 0.02 ? 1 : 0 }}
        />
      </svg>

      <div className="mt-4 flex justify-between font-mono text-[10.5px] tabular-nums text-[var(--ink-faint)]">
        <span>$1 · 2012</span>
        <span style={{ color: 'var(--moss)' }}>$16 · 2026</span>
      </div>
    </div>
  );
}

function Counter({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-[var(--bg)] py-7 px-2 text-center">
      <div
        className="editorial-h text-[1.8rem] sm:text-[2.2rem] tabular-nums"
        style={{ color: 'var(--moss)' }}
      >
        {value}
      </div>
      <div className="mt-2 font-mono text-[9.5px] tracking-[0.22em] uppercase text-[var(--ink-faint)]">
        {label}
      </div>
    </div>
  );
}

export default function Fund() {
  const ref = useRef<HTMLDivElement | null>(null);
  const p = useScrollProgress(ref);

  const cagr = (20.53 * clamp01((p - 0.2) / 0.4)).toFixed(2);
  const sharpe = (1.46 * clamp01((p - 0.25) / 0.4)).toFixed(2);
  const dd = (18.4 * clamp01((p - 0.3) / 0.4)).toFixed(1);

  return (
    <section id="fund" className="relative">
      <div
        ref={ref}
        className="mx-auto max-w-[1320px] px-6 py-32 sm:px-10 sm:py-44 lg:px-14 lg:py-56"
      >
        <div className="grid gap-16 lg:grid-cols-12 lg:gap-20">
          <div className="lg:col-span-5">
            <Eyebrow num="§ 02">The Fund</Eyebrow>
            <h2 className="editorial-h mt-10 text-[2.4rem] sm:text-[3.6rem] lg:text-[4.4rem] leading-[1.02]">
              <div>$1</div>
              <div style={{ color: 'var(--ink-faint)' }}>becomes</div>
              <div style={{ color: 'var(--moss)' }}>$16.</div>
            </h2>
            <p className="mt-10 max-w-[26ch] font-mono text-[10.5px] tracking-[0.22em] uppercase text-[var(--ink-faint)]">
              14 years · 4 sleeves · 1 fund
            </p>
          </div>

          <div className="lg:col-span-7">
            <ScrollChart progress={p} />

            <div className="mt-14 grid grid-cols-3 gap-px bg-[var(--ink-line)]">
              <Counter value={cagr + '%'} label="Backtest CAGR" />
              <Counter value={sharpe} label="Sharpe ratio" />
              <Counter value={'−' + dd + '%'} label="Max drawdown" />
            </div>

            <p className="mt-10 max-w-md font-mono text-[10.5px] leading-relaxed text-[var(--ink-faint)]">
              Apr 2012 → Apr 2026. Hypothetical, net of modeled fees. Past performance not indicative
              of future results.
            </p>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-[1320px] px-6 sm:px-10 lg:px-14">
        <div className="rule" />
      </div>
    </section>
  );
}
