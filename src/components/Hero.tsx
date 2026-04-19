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
   3D scroll scene — a perspective "market floor" that the
   viewer dollies into as they scroll. CSS 3D only (no canvas,
   no library). Quant-themed: grid floor + sparse candle bars
   + a traced equity curve. Gated by prefers-reduced-motion.
   ============================================================ */

// Deterministic PRNG so candle positions stay stable across renders
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Candle = { x: number; z: number; h: number; up: boolean; w: number };
const CANDLES: Candle[] = (() => {
  const rng = mulberry32(0xc0ffee);
  const arr: Candle[] = [];
  for (let i = 0; i < 22; i++) {
    arr.push({
      x: (rng() - 0.5) * 1300,    // -650..650 px from center
      z: -120 - rng() * 1700,     // -120..-1820 px (recedes into scene)
      h: 36 + rng() * 130,        // bar height in px
      w: 4 + rng() * 3,           // bar width
      up: rng() > 0.30,           // ~70% bullish (green)
    });
  }
  return arr;
})();

// Equity curve — exponential trend with realistic chop, traced left→right.
const CURVE_PATH = (() => {
  const rng = mulberry32(7);
  const segs: string[] = [];
  for (let i = 0; i <= 80; i++) {
    const t = i / 80;
    const trend = Math.pow(1.055, t * 12);            // compounding
    const wobble =
      Math.sin(t * 9.4) * 0.55 +
      Math.sin(t * 21.1) * 0.22 +
      (rng() - 0.5) * 0.18;                            // noise
    const x = t * 100;
    const y = 48 - trend * 1.8 + wobble;
    segs.push(i === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : `L ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return segs.join(' ');
})();

function Scene3D({ p, reduced }: { p: number; reduced: boolean }) {
  // p: 0..1 scroll progress within the hero section.
  // Camera dollies forward (translateZ negative) and tilts down very
  // slightly. Curve traces in as you scroll. Reduced motion: static.
  const cameraZ = reduced ? 0 : -p * 520;
  const cameraY = reduced ? 0 : -p * 70;
  const tilt = reduced ? 8 : 8 + p * 4;
  const curveDraw = reduced ? 1 : Math.min(1, p * 1.7 + 0.05);

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
      style={{ perspective: '1300px', perspectiveOrigin: '50% 38%' }}
    >
      {/* faint ambient light pool at the horizon */}
      <div
        className="absolute left-1/2 -translate-x-1/2 rounded-full"
        style={{
          top: '38%',
          width: '70%',
          height: '40%',
          background:
            'radial-gradient(ellipse 60% 55% at 50% 50%, rgba(var(--accent-rgb), 0.18), transparent 70%)',
          filter: 'blur(20px)',
          opacity: 0.9,
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          transformStyle: 'preserve-3d',
          transform: `translate3d(0, ${cameraY}px, ${cameraZ}px) rotateX(${tilt}deg)`,
          transition: reduced ? 'none' : 'transform 120ms linear',
          willChange: 'transform',
        }}
      >
        {/* Perspective grid floor — lies flat, recedes into distance.
            Implemented as a wide div with two crossed linear-gradients,
            tilted backward 70° so its top edge falls away from camera. */}
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
            backgroundSize: '90px 90px',
            backgroundPosition: '0 0',
            maskImage:
              'linear-gradient(to bottom, transparent 0%, black 18%, black 55%, transparent 90%)',
            WebkitMaskImage:
              'linear-gradient(to bottom, transparent 0%, black 18%, black 55%, transparent 90%)',
          }}
        />

        {/* Candle bars — stand upright in scene-space (no extra rotation
            on themselves; the parent handles tilt). Each is positioned
            via translate3d so it sits at its own (x, z) on the floor. */}
        {CANDLES.map((c, i) => {
          const color = c.up ? 'rgba(var(--accent-rgb), 0.78)' : 'rgba(180, 70, 70, 0.55)';
          const glow = c.up
            ? 'rgba(var(--accent-rgb), 0.55)'
            : 'rgba(180, 70, 70, 0.35)';
          return (
            <div
              key={i}
              className="absolute left-1/2 top-1/2 rounded-[1px]"
              style={{
                width: c.w,
                height: c.h,
                marginLeft: -c.w / 2,
                marginTop: -c.h,
                transform: `translate3d(${c.x}px, 80px, ${c.z}px)`,
                background: `linear-gradient(180deg, ${color}, ${color.replace('0.78', '0.5').replace('0.55', '0.32')})`,
                boxShadow: `0 0 14px ${glow}`,
                opacity: 0.92,
              }}
            />
          );
        })}

        {/* Floating data motes — tiny dots scattered through depth.
            Pure flair; reads as dust in the light pool. */}
        {Array.from({ length: 18 }).map((_, i) => {
          const r = mulberry32(i * 919 + 1);
          const x = (r() - 0.5) * 1500;
          const y = (r() - 0.5) * 220;
          const z = -100 - r() * 1500;
          const s = 1.5 + r() * 2;
          return (
            <div
              key={`d${i}`}
              className="absolute left-1/2 top-1/2 rounded-full"
              style={{
                width: s,
                height: s,
                marginLeft: -s / 2,
                marginTop: -s / 2,
                transform: `translate3d(${x}px, ${y}px, ${z}px)`,
                background: 'rgba(var(--accent-rgb), 0.85)',
                boxShadow: '0 0 6px rgba(var(--accent-rgb), 0.7)',
                opacity: 0.55,
              }}
            />
          );
        })}

        {/* Equity curve — traced left→right as scroll progresses.
            Sits in front of the candle field. Faces camera (no tilt
            counter-rotation needed because we draw it at moderate Z
            and accept slight perspective foreshortening, which actually
            sells the depth). */}
        <svg
          className="absolute left-1/2 top-1/2 overflow-visible"
          style={{
            width: 1100,
            height: 220,
            marginLeft: -550,
            marginTop: -110,
            transform: 'translate3d(0, -10px, 220px)',
          }}
          viewBox="0 0 100 50"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="heroCurveStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(var(--accent-rgb), 0.0)" />
              <stop offset="8%" stopColor="rgba(var(--accent-rgb), 0.85)" />
              <stop offset="100%" stopColor="rgba(var(--accent-rgb), 1)" />
            </linearGradient>
          </defs>
          <path
            d={CURVE_PATH}
            fill="none"
            stroke="url(#heroCurveStroke)"
            strokeWidth="0.45"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            style={{
              strokeDasharray: 1,
              strokeDashoffset: 1 - curveDraw,
              filter: 'drop-shadow(0 0 4px rgba(var(--accent-rgb), 0.55))',
              transition: reduced ? 'none' : 'stroke-dashoffset 200ms linear',
            }}
          />
        </svg>
      </div>

      {/* foreground vignette — keeps text legible */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 45%, transparent 30%, var(--bg-a) 95%)',
          opacity: 0.55,
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
  const [p, setP] = useState(0);

  // Scroll-progress within the hero — drives the 3D scene + a tiny
  // amount of text parallax. The skill flagged scroll-jacking as
  // HIGH-severity, so the page scrolls normally and the scene just
  // reacts. rAF-throttled.
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = sectionRef.current?.getBoundingClientRect();
        if (!r) return;
        const v = Math.max(0, Math.min(1, -r.top / Math.max(1, r.height * 0.9)));
        setP(v);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [reduced]);

  // Subtle text parallax — small offsets, the depth comes from the scene now.
  const py = (k: number) => (reduced ? 0 : p * k);

  return (
    <section id="top" className="relative overflow-hidden">
      <Scene3D p={p} reduced={reduced} />

      <div
        ref={(el) => {
          revealRef.current = el;
          sectionRef.current = el;
        }}
        className="relative z-10 mx-auto max-w-[1200px] px-5 pt-32 pb-32 sm:px-10 sm:pt-44 sm:pb-44 lg:px-16 lg:pt-56 lg:pb-56"
      >
        <div
          className={`flex justify-center transition-all duration-700 ${
            inView ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
          }`}
          style={{ transform: `translateY(${-py(24)}px)`, willChange: 'transform' }}
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
            transform: `translateY(${-py(50)}px)`,
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
          style={{ transform: `translateY(${-py(80)}px)`, willChange: 'transform' }}
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
