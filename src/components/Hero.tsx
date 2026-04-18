import { useEffect, useState } from 'react';
import { useReveal } from '../hooks/useReveal';

/**
 * Hand-drawn-feel SVG ellipse around a short word. Path is generous
 * (extends beyond text bounds) and animates stroke-dashoffset on
 * scroll-in to draw itself like a marker stroke.
 */
function NaturalCircle({ inView }: { inView: boolean }) {
  const d =
    'M 42 82 C 30 48, 80 22, 150 22 C 240 22, 288 50, 288 84 C 288 118, 228 140, 148 138 C 60 136, 18 108, 28 78 C 34 58, 58 46, 84 40';
  return (
    <svg
      className="pointer-events-none absolute left-[-14%] right-[-14%] top-[-22%] bottom-[-22%] h-[144%] w-[128%] overflow-visible"
      viewBox="0 0 320 160"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: 780,
          strokeDashoffset: inView ? 0 : 780,
          transition: 'stroke-dashoffset 1.6s cubic-bezier(0.22, 1, 0.36, 1) 800ms',
          opacity: 0.85,
        }}
      />
    </svg>
  );
}

type Quote = { s: string; v: number; d: number };
const baseQuotes: Quote[] = [
  { s: 'SPX', v: 5820.97, d: 0.42 },
  { s: 'NDX', v: 20480.48, d: 0.77 },
  { s: 'VIX', v: 14.2, d: -2.13 },
  { s: 'BTC', v: 98375, d: -1.25 },
  { s: 'ETH', v: 3420.8, d: 1.04 },
  { s: 'TLT', v: 90.14, d: -0.33 },
  { s: 'DXY', v: 103.82, d: 0.18 },
  { s: 'GLD', v: 258.4, d: 0.72 },
];

function LiveTicker() {
  const [quotes, setQuotes] = useState<Quote[]>(baseQuotes);
  useEffect(() => {
    const id = window.setInterval(() => {
      setQuotes((qs) =>
        qs.map((q) => ({
          ...q,
          v: q.v * (1 + (Math.random() - 0.5) * 0.0015),
          d: q.d + (Math.random() - 0.5) * 0.04,
        }))
      );
    }, 1400);
    return () => window.clearInterval(id);
  }, []);
  const fmt = (v: number) =>
    v >= 1000 ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : v.toFixed(2);
  return (
    <div className="relative z-10 overflow-hidden border-y border-line">
      <div className="flex gap-10 whitespace-nowrap py-2.5 text-[11px] font-mono tabular-nums animate-marquee w-max">
        {[...quotes, ...quotes].map((q, i) => (
          <span key={i} className="inline-flex items-center gap-2 text-fg-muted">
            <span className="tracking-[0.18em] text-fg-faint">{q.s}</span>
            <span className="text-fg">{fmt(q.v)}</span>
            <span className={q.d >= 0 ? 'text-accent-strong' : 'text-fg-muted'}>
              {q.d >= 0 ? '▲' : '▼'} {Math.abs(q.d).toFixed(2)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Hero() {
  const [revealRef, inView] = useReveal();

  return (
    <section id="top" className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 ambient-accent" />

      <div
        ref={revealRef}
        className="relative z-10 mx-auto max-w-[1200px] px-5 pt-32 pb-32 sm:px-10 sm:pt-44 sm:pb-44 lg:px-16 lg:pt-56 lg:pb-56"
      >
        <div
          className={`flex justify-center transition-all duration-700 ${
            inView ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
          }`}
        >
          <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-fg-faint">
            Solaria Capital · Est. 2026
          </span>
        </div>

        <h1
          className={`mx-auto mt-10 sm:mt-14 max-w-[14ch] text-center font-display leading-[1.02] tracking-[-0.015em] text-[3rem] sm:text-[5.2rem] lg:text-[7.2rem] text-fg transition-all duration-1000 delay-100 ${
            inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ textWrap: 'balance' as never }}
        >
          Built on{' '}
          <span className="relative inline-block text-accent">
            <NaturalCircle inView={inView} />
            <span className="relative italic">proof</span>
          </span>
          .
        </h1>

        <p
          className={`mx-auto mt-8 sm:mt-10 max-w-[36ch] text-center text-[15.5px] sm:text-[17px] leading-relaxed text-fg-muted transition-all duration-700 delay-300 ${
            inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          A closed-end quant fund, a seed venture arm, and open research — from one desk.
        </p>

        <div
          className={`mt-14 sm:mt-16 flex justify-center transition-all duration-700 delay-500 ${
            inView ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <a
            href="#fund"
            className="group inline-flex items-center gap-3 text-[14px] text-fg hover:text-accent transition-colors"
          >
            <span className="font-mono tracking-[0.2em] uppercase text-[11px]">Enter the Fund</span>
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border transition-all"
              style={{ borderColor: 'var(--line-strong)' }}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </a>
        </div>

        <div
          className={`mx-auto mt-24 sm:mt-32 flex w-fit flex-col items-center gap-2 transition-opacity duration-1000 delay-1000 ${
            inView ? 'opacity-60' : 'opacity-0'
          }`}
        >
          <span className="font-mono text-[9.5px] tracking-[0.3em] uppercase text-fg-faint">Scroll</span>
          <span className="block h-8 w-px bg-gradient-to-b from-[var(--fg-faint)] to-transparent" />
        </div>
      </div>

      <LiveTicker />
    </section>
  );
}
