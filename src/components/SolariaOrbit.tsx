/**
 * Signature motif — orbital rings echoing the Solaria mark.
 * Static when prefers-reduced-motion; otherwise a very slow drift.
 */
export default function SolariaOrbit({ className = '' }: { className?: string }) {
  return (
    <div className={`hero-orbit ${className}`.trim()} aria-hidden>
      <svg viewBox="0 0 240 240" fill="none" className="h-full w-full text-[var(--accent-deep)]">
        <g opacity="0.32" className="hero-orbit__spin-slow">
          <ellipse cx="120" cy="120" rx="98" ry="58" stroke="currentColor" strokeWidth="1" />
        </g>
        <g opacity="0.48" className="hero-orbit__spin-reverse">
          <ellipse cx="120" cy="120" rx="72" ry="42" stroke="currentColor" strokeWidth="1" />
        </g>
        <circle cx="120" cy="120" r="4" fill="currentColor" opacity="0.65" />
        <circle cx="218" cy="120" r="2.5" fill="currentColor" opacity="0.5" className="hero-orbit__spin-slow" />
        <circle cx="42" cy="88" r="2" fill="currentColor" opacity="0.45" className="hero-orbit__spin-reverse" />
        <circle cx="168" cy="168" r="1.75" fill="currentColor" opacity="0.4" className="hero-orbit__spin-slow" />
      </svg>
    </div>
  );
}
