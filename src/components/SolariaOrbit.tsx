import { useId } from 'react';

/**
 * Signature motif — orbital rings echoing the Solaria mark.
 * Static when prefers-reduced-motion; otherwise a very slow drift.
 */
export default function SolariaOrbit({ className = '' }: { className?: string }) {
  const glowId = `${useId()}-glow`;

  return (
    <div className={`hero-orbit ${className}`.trim()} aria-hidden>
      <svg viewBox="0 0 240 240" fill="none" className="h-full w-full overflow-visible text-[var(--accent-soft)]">
        <defs>
          <radialGradient id={glowId}>
            <stop offset="0%" stopColor="#8db3a7" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#8db3a7" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx="120" cy="120" r="116" stroke="currentColor" strokeWidth="1" strokeDasharray="1 5" opacity="0.28" vectorEffect="non-scaling-stroke" />
        <g transform="rotate(-18 120 120)">
          <ellipse cx="120" cy="120" rx="108" ry="30" stroke="currentColor" strokeWidth="1" opacity="0.22" vectorEffect="non-scaling-stroke" />
        </g>
        <g opacity="0.5" className="hero-orbit__spin-slow">
          <ellipse cx="120" cy="120" rx="98" ry="58" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <circle cx="218" cy="120" r="2.6" fill="currentColor" />
        </g>
        <g opacity="0.7" className="hero-orbit__spin-reverse">
          <ellipse cx="120" cy="120" rx="72" ry="42" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <circle cx="48" cy="120" r="2" fill="currentColor" />
        </g>
        <circle cx="42" cy="88" r="1.6" fill="currentColor" opacity="0.5" className="hero-orbit__spin-reverse" />
        <circle cx="168" cy="168" r="1.5" fill="currentColor" opacity="0.45" className="hero-orbit__spin-slow" />

        <circle cx="120" cy="120" r="20" fill={`url(#${glowId})`} className="hero-orbit__core-glow" />
        <circle cx="120" cy="120" r="4.5" fill="#8db3a7" />
      </svg>
    </div>
  );
}
