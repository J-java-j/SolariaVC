import { useEffect, useState } from 'react';
import { StaggerWord } from './primitives';

const tickerItems: [string, string, string][] = [
  ['MEDALLION', '+20.53%', 'CAGR'],
  ['SHARPE', '1.46', '14Y'],
  ['DRAWDOWN', '−18.4%', 'MAX'],
  ['VINTAGE 2026', 'OPEN', '6/year'],
  ['$1 → $16', '14Y', 'BACKTEST'],
  ['SLEEVES', '4', 'UNCORRELATED'],
  ['STRATEGY', 'STAT-ARB', 'EQUITY MOM'],
  ['STRATEGY', 'VOL CARRY', 'CO-INVEST'],
];

function TickerRow() {
  return (
    <span className="inline-flex items-center">
      {tickerItems.map((it, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-3 px-8 py-5 font-mono text-[11px] tracking-[0.18em] uppercase"
        >
          <span className="text-[var(--ink-faint)]">{it[0]}</span>
          <span className="tabular-nums text-[var(--moss)]">{it[1]}</span>
          <span className="text-[var(--ink-faint)]">{it[2]}</span>
          <span className="mx-3 text-[var(--ink-line)]">/</span>
        </span>
      ))}
    </span>
  );
}

function Ticker() {
  return (
    <div className="overflow-hidden border-y border-line bg-[var(--bg-soft)]/30">
      <div className="inline-flex whitespace-nowrap animate-marquee">
        <TickerRow />
        <TickerRow />
      </div>
    </div>
  );
}

export default function Hero() {
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const on = (e: MouseEvent) =>
      setMouse({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight });
    window.addEventListener('mousemove', on);
    return () => window.removeEventListener('mousemove', on);
  }, []);

  return (
    <section id="top" className="relative overflow-hidden">
      {/* Ambient moss glow drifting with cursor */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 animate-breath"
        style={{
          background: `radial-gradient(420px 320px at ${mouse.x * 100}% ${30 + mouse.y * 20}%, color-mix(in oklab, var(--moss) 14%, transparent), transparent 70%)`,
          filter: 'blur(40px)',
        }}
      />

      <div className="relative mx-auto max-w-[1320px] px-6 pt-44 pb-32 sm:px-10 sm:pt-56 sm:pb-44 lg:px-14 lg:pt-64 lg:pb-56">
        {/* Top thin line */}
        <div className="flex items-baseline justify-between gap-4 font-mono text-[10.5px] tracking-[0.22em] uppercase text-[var(--ink-faint)]">
          <span className="flex items-center gap-2.5">
            <span className="live-dot" />
            La Jolla · Vintage 2026
          </span>
          <span className="hidden sm:inline">Est. 2026</span>
        </div>

        {/* The phrase */}
        <h1
          className="editorial-h mt-24 sm:mt-32 text-[3.6rem] sm:text-[6.2rem] lg:text-[8.4rem]"
          style={{ textWrap: 'balance', lineHeight: 0.98 } as React.CSSProperties}
        >
          <div>
            <StaggerWord text="Grow capital." delay={200} />
          </div>
          <div className="mt-2 sm:mt-4">
            <StaggerWord text="Build " delay={1100} />
            <span className="legacy-wrap">
              <StaggerWord text="legacy" delay={1450} className="relative" />
              <svg viewBox="0 0 300 160" preserveAspectRatio="none" aria-hidden>
                <path
                  className="scribble-1"
                  d="M 268 78 C 282 50, 250 22, 180 14 C 100 8, 40 24, 26 60 C 14 96, 56 134, 140 142 C 222 150, 282 124, 282 92 C 282 70, 264 60, 240 64"
                />
              </svg>
            </span>
            <StaggerWord text="." delay={1900} />
          </div>
        </h1>

        {/* CTA + tagline */}
        <div className="mt-20 sm:mt-28 flex flex-wrap items-end justify-between gap-10">
          <a href="#contact" className="cta-arrow group text-[15px] text-[var(--ink)]">
            <span className="line" />
            <span className="ulink-rev">Pitch us</span>
            <span className="text-[var(--moss)] transition-transform group-hover:translate-x-1">
              →
            </span>
          </a>
          <div className="max-w-[20ch] text-right font-mono text-[10.5px] tracking-[0.22em] uppercase text-[var(--ink-faint)]">
            A quantitative fund
            <br />
            and a venture practice.
          </div>
        </div>
      </div>

      <Ticker />

      <div className="mx-auto max-w-[1320px] px-6 sm:px-10 lg:px-14">
        <div className="rule" />
      </div>
    </section>
  );
}
