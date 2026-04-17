import { useRef, type ReactNode } from 'react';

/**
 * Wraps children in a container that paints a soft cursor-following
 * gradient on top. Apply to cards / panels for a tactile hover effect.
 */
export default function Spotlight({
  children,
  className = '',
  intensity = 0.18,
}: {
  children: ReactNode;
  className?: string;
  intensity?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      className={`group/spot relative ${className}`}
      style={
        {
          '--spot-color': `rgba(52, 211, 153, ${intensity})`,
        } as React.CSSProperties
      }
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100"
        style={{
          background:
            'radial-gradient(220px circle at var(--mx,50%) var(--my,50%), var(--spot-color), transparent 70%)',
        }}
      />
      {children}
    </div>
  );
}
