import type { ReactNode } from 'react';

export function Eyebrow({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="h-px w-8 bg-[var(--accent-400)] opacity-60" />
      <span className="font-mono text-[10.5px] tracking-[0.28em] uppercase text-accent">
        {children}
      </span>
    </div>
  );
}

export function SectionTitle({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={`font-display font-medium tracking-[-0.015em] leading-[1.02] text-[2.1rem] sm:text-[3.2rem] lg:text-[4.2rem] ${className}`}
    >
      {children}
    </h2>
  );
}

/**
 * Solaria sun mark — concentric ring + accent chord. Uses currentColor
 * for the ring (so it picks up ink on cream / cream on black) and the
 * theme accent var for the rising chord.
 */
export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" style={{ color: 'currentColor' }}>
      <circle cx="32" cy="32" r="22" stroke="currentColor" strokeWidth="2.5" opacity="0.9" />
      <circle cx="32" cy="32" r="9" fill="currentColor" opacity="0.18" />
      <path
        d="M14 40 Q 32 8, 50 40"
        stroke="var(--accent-400)"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="32" cy="14" r="2.2" fill="var(--accent-400)" />
    </svg>
  );
}
