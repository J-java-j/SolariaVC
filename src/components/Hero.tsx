import { useEffect, useRef, useState } from 'react';
import { useReveal } from '../hooks/useReveal';
import { useReducedMotion } from '../hooks/useReducedMotion';

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

/* ============================================================
   3D scroll scene — minimal, premium. Receding perspective grid
   + a single bold equity curve traced as you scroll + a few
   horizontal "tape" levels for context. CSS 3D only.

   PERF: scroll-driven transforms are written to a CSS custom
   property `--p` on the scene root via a ref-bound rAF handler.
   React never re-renders on scroll; the GPU handles compositing.
   Gated by prefers-reduced-motion.
   ============================================================ */

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Equity curve — exponential trend with realistic chop. Traced left→right.
const CURVE_PATH = (() => {
  const rng = mulberry32(7);
  const segs: string[] = [];
  for (let i = 0; i <= 80; i++) {
    const t = i / 80;
    const trend = Math.pow(1.055, t * 12);
    const wobble =
      Math.sin(t * 9.4) * 0.55 +
      Math.sin(t * 21.1) * 0.22 +
      (rng() - 0.5) * 0.18;
    const x = t * 100;
    const y = 46 - trend * 1.8 + wobble;
    segs.push(i === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : `L ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return segs.join(' ');
})();

// Horizontal "tape" lines — price-level gridlines floating at depth.
const TAPE_LEVELS = [
  { z: -120, w: 920, opacity: 0.20 },
  { z: -360, w: 1040, opacity: 0.16 },
  { z: -680, w: 1180, opacity: 0.12 },
  { z: -1080, w: 1320, opacity: 0.08 },
];

function Scene3D({ reduced, sectionRef }: { reduced: boolean; sectionRef: React.RefObject<HTMLDivElement | null> }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Drive scroll progress via a CSS custom property on the wrapper —
  // no React state, no re-render. rAF-throttled.
  useEffect(() => {
    if (reduced) return;
    const wrap = wrapRef.current;
    const section = sectionRef.current;
    if (!wrap || !section) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = section.getBoundingClientRect();
        const v = Math.max(0, Math.min(1, -r.top / Math.max(1, r.height * 0.9)));
        wrap.style.setProperty('--p', v.toFixed(4));
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [reduced, sectionRef]);

  return (
    <div
      ref={wrapRef}
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
      style={
        {
          perspective: '1400px',
          perspectiveOrigin: '50% 40%',
          ['--p' as never]: 0,
        } as React.CSSProperties
      }
    >
      {/* horizon ambient pool */}
      <div
        className="absolute left-1/2 -translate-x-1/2 rounded-full"
        style={{
          top: '36%',
          width: '70%',
          height: '46%',
          background:
            'radial-gradient(ellipse 60% 55% at 50% 50%, rgba(var(--accent-rgb), 0.16), transparent 72%)',
          filter: 'blur(24px)',
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          transformStyle: 'preserve-3d',
          transform: reduced
            ? 'rotateX(8deg)'
            : 'translate3d(0, calc(var(--p) * -64px), calc(var(--p) * -480px)) rotateX(calc(8deg + var(--p) * 4deg))',
          willChange: 'transform',
        }}
      >
        {/* Perspective grid floor */}
        <div
          className="absolute"
          style={{
            left: '-60%',
            right: '-60%',
            top: '62%',
            height: '2600px',
            transformOrigin: '50% 0%',
            transform: 'rotateX(72deg)',
            backgroundImage:
              'linear-gradient(to right, rgba(var(--accent-rgb), 0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(var(--accent-rgb), 0.18) 1px, transparent 1px)',
            backgroundSize: '92px 92px',
            maskImage:
              'linear-gradient(to bottom, transparent 0%, black 18%, black 55%, transparent 92%)',
            WebkitMaskImage:
              'linear-gradient(to bottom, transparent 0%, black 18%, black 55%, transparent 92%)',
          }}
        />

        {/* Horizontal tape levels — faint price-level gridlines at varying
            depths. Reads as a chart canvas in 3D, far cleaner than a candle
            scatter. Each is just a 1-px wide gradient line. */}
        {TAPE_LEVELS.map((t, i) => (
          <div
            key={i}
            className="absolute left-1/2 top-1/2"
            style={{
              width: t.w,
              height: 1,
              marginLeft: -t.w / 2,
              transform: `translate3d(0, ${20 + i * 4}px, ${t.z}px)`,
              background: `linear-gradient(90deg, transparent, rgba(var(--accent-rgb), ${t.opacity}) 18%, rgba(var(--accent-rgb), ${t.opacity}) 82%, transparent)`,
            }}
          />
        ))}

        {/* Equity curve — the protagonist. Bold, glowing, traced in as
            you scroll. pathLength=1 lets us drive offset via calc(). */}
        <svg
          className="absolute left-1/2 top-1/2 overflow-visible"
          style={{
            width: 1180,
            height: 280,
            marginLeft: -590,
            marginTop: -140,
            transform: 'translate3d(0, -8px, 240px)',
          }}
          viewBox="0 0 100 50"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="heroCurveStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(var(--accent-rgb), 0)" />
              <stop offset="6%" stopColor="rgba(var(--accent-rgb), 0.9)" />
              <stop offset="100%" stopColor="rgba(var(--accent-rgb), 1)" />
            </linearGradient>
            <linearGradient id="heroCurveFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(var(--accent-rgb), 0.18)" />
              <stop offset="100%" stopColor="rgba(var(--accent-rgb), 0)" />
            </linearGradient>
          </defs>
          {/* soft area fill under the curve */}
          <path
            d={`${CURVE_PATH} L 100 50 L 0 50 Z`}
            fill="url(#heroCurveFill)"
            style={{
              opacity: reduced ? 1 : 'calc(var(--p) * 1.6)' as never,
            }}
          />
          <path
            d={CURVE_PATH}
            fill="none"
            stroke="url(#heroCurveStroke)"
            strokeWidth="0.55"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            style={{
              strokeDasharray: 1,
              strokeDashoffset: reduced
                ? 0
                : ('max(0, 0.95 - var(--p) * 1.7)' as never),
              filter: 'drop-shadow(0 0 5px rgba(var(--accent-rgb), 0.55))',
            }}
          />
        </svg>
      </div>

      {/* foreground vignette — keeps text legible against the scene */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 45%, transparent 30%, var(--bg-a) 95%)',
          opacity: 0.6,
        }}
      />
    </div>
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
  const reduced = useReducedMotion();
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);

  // Text parallax — direct DOM mutation via ref, no React state, no
  // re-render. Sets a single CSS var on the inner wrapper.
  useEffect(() => {
    if (reduced) return;
    const inner = innerRef.current;
    const section = sectionRef.current;
    if (!inner || !section) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = section.getBoundingClientRect();
        const v = Math.max(0, Math.min(1, -r.top / Math.max(1, r.height * 0.9)));
        inner.style.setProperty('--p', v.toFixed(4));
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [reduced]);

  return (
    <section ref={sectionRef} id="top" className="relative overflow-hidden">
      <Scene3D reduced={reduced} sectionRef={sectionRef} />

      <div
        ref={(el) => {
          revealRef.current = el;
          innerRef.current = el;
        }}
        className="relative z-10 mx-auto max-w-[1200px] px-5 pt-32 pb-32 sm:px-10 sm:pt-44 sm:pb-44 lg:px-16 lg:pt-56 lg:pb-56"
        style={{ ['--p' as never]: 0 } as React.CSSProperties}
      >
        <div
          className={`flex justify-center transition-all duration-700 ${
            inView ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
          }`}
          style={{
            transform: reduced ? undefined : 'translateY(calc(var(--p) * -24px))',
            willChange: 'transform',
          }}
        >
          <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-fg-faint">
            Solaria Capital · Est. 2026
          </span>
        </div>

        <h1
          className={`mx-auto mt-10 sm:mt-14 max-w-[14ch] text-center font-display leading-[1.02] tracking-[-0.015em] text-[3rem] sm:text-[5.2rem] lg:text-[7.2rem] text-fg transition-all duration-1000 delay-100 ${
            inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{
            textWrap: 'balance' as never,
            transform: reduced ? undefined : 'translateY(calc(var(--p) * -50px))',
            willChange: 'transform',
          }}
        >
          Built on{' '}
          <span className="relative inline-block text-accent">
            <NaturalCircle inView={inView} />
            <span className="relative">proof</span>
          </span>
          .
        </h1>

        <p
          className={`mx-auto mt-8 sm:mt-10 max-w-[36ch] text-center text-[15.5px] sm:text-[17px] leading-relaxed text-fg-muted transition-all duration-700 delay-300 ${
            inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{
            transform: reduced ? undefined : 'translateY(calc(var(--p) * -80px))',
            willChange: 'transform',
          }}
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
