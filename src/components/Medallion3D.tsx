import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

/**
 * 3D medallion coin — the signature visual for the Fund section.
 * - Slow continuous Y-rotation (60s for a full revolution; subliminal)
 * - Mouse-parallax tilt on the rotation axis on desktop hover
 * - Two faces: gold relief (front) + Solaria sun mark (back)
 * - Honors prefers-reduced-motion (renders the front face statically)
 *
 * Pure CSS 3D — no canvas, no library. ~2KB on the page.
 */
export default function Medallion3D({ size = 280 }: { size?: number }) {
  const reduced = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [autoY, setAutoY] = useState(0);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  // Slow auto-rotation. Pause on reduced-motion.
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const elapsed = (t - start) / 1000;
      // 60-second full revolution → 6°/s
      setAutoY((elapsed * 6) % 360);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  const onMove = (e: React.MouseEvent) => {
    if (reduced) return;
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    setTilt({
      x: (0.5 - py) * 18, // up/down → rotateX
      y: (px - 0.5) * 24, // left/right adds to rotateY
    });
  };
  const onLeave = () => setTilt({ x: 0, y: 0 });

  const rotateY = autoY + tilt.y;
  const rotateX = tilt.x;

  return (
    <div
      ref={wrapRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="pointer-events-auto select-none"
      style={{
        width: size,
        height: size,
        perspective: '1400px',
      }}
      aria-hidden
    >
      <div
        className="relative h-full w-full transition-transform duration-300 ease-out"
        style={{
          transformStyle: 'preserve-3d',
          transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
          willChange: 'transform',
        }}
      >
        <CoinFace front size={size} />
        <CoinFace front={false} size={size} />
        <CoinEdge size={size} />
      </div>
    </div>
  );
}

function CoinFace({ front, size }: { front: boolean; size: number }) {
  const r = size * 0.46;
  return (
    <div
      className="absolute inset-0 rounded-full overflow-hidden"
      style={{
        transform: front ? 'translateZ(8px)' : 'translateZ(-8px) rotateY(180deg)',
        backfaceVisibility: 'hidden',
        background:
          'radial-gradient(circle at 30% 25%, #fef3c2 0%, #fcd54a 22%, #d49316 55%, #6b4310 90%)',
        boxShadow:
          'inset 0 0 60px rgba(120, 70, 0, 0.45), inset 0 0 12px rgba(255, 240, 180, 0.6), 0 25px 70px -20px rgba(230, 168, 42, 0.55)',
      }}
    >
      {/* Concentric rims */}
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 h-full w-full"
        style={{ color: 'rgba(64, 32, 0, 0.55)' }}
      >
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth="2" opacity="0.45" />
        <circle cx={size / 2} cy={size / 2} r={r - 8} fill="none" stroke="currentColor" strokeWidth="0.9" opacity="0.35" />
        <circle cx={size / 2} cy={size / 2} r={r - 18} fill="none" stroke="currentColor" strokeWidth="0.6" strokeDasharray="2 4" opacity="0.5" />
      </svg>

      {/* Center mark */}
      {front ? (
        <div
          className="absolute inset-0 grid place-items-center font-display"
          style={{
            color: '#3a1f00',
            fontSize: size * 0.18,
            letterSpacing: '-0.04em',
            textShadow: '0 1px 0 rgba(255, 240, 180, 0.5)',
          }}
        >
          M
        </div>
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <SunMark size={size * 0.42} />
        </div>
      )}

      {/* Specular highlight */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 35% at 35% 25%, rgba(255, 250, 220, 0.55), transparent 70%)',
          mixBlendMode: 'screen',
        }}
      />
    </div>
  );
}

function CoinEdge({ size }: { size: number }) {
  // Thin rim that gives the coin its 3D thickness.
  return (
    <div
      className="absolute inset-0 rounded-full"
      style={{
        background:
          'linear-gradient(90deg, #6b4310 0%, #d49316 25%, #fcd54a 50%, #d49316 75%, #6b4310 100%)',
        transform: 'translateZ(0px) scaleZ(1)',
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.35)',
        opacity: 0.4,
        filter: 'blur(0.5px)',
        // depth illusion: a sub-circle inset behind the faces
        clipPath: `circle(${size / 2 - 1}px at center)`,
      }}
    />
  );
}

function SunMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="22" stroke="#3a1f00" strokeWidth="2.5" opacity="0.85" />
      <circle cx="32" cy="32" r="9" fill="#3a1f00" opacity="0.55" />
      <path d="M14 40 Q 32 8, 50 40" stroke="#3a1f00" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <circle cx="32" cy="14" r="2.2" fill="#3a1f00" />
    </svg>
  );
}
