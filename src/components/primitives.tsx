import type { ReactNode } from 'react';

export function Eyebrow({
  children,
  num,
  className = '',
}: {
  children: ReactNode;
  num?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="eyebrow-rule" />
      {num && (
        <span className="font-mono text-[10.5px] tabular-nums text-[var(--ink-faint)]">{num}</span>
      )}
      <span className="font-mono text-[10px] tracking-[0.28em] uppercase text-[var(--moss)]">
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
      className={`editorial-h text-[2.4rem] sm:text-[3.6rem] lg:text-[4.4rem] ${className}`}
    >
      {children}
    </h2>
  );
}

/**
 * Solaria sun mark — concentric ring + accent chord.
 */
export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="22" stroke="currentColor" strokeWidth="1.4" opacity="0.7" />
      <circle cx="32" cy="32" r="5" fill="currentColor" opacity="0.85" />
      <path
        d="M14 40 Q 32 8, 50 40"
        stroke="var(--moss)"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/**
 * Char-by-char headline reveal with stagger.
 */
export function StaggerWord({
  text,
  delay = 0,
  className = '',
}: {
  text: string;
  delay?: number;
  className?: string;
}) {
  return (
    <span className={`word-stagger ${className}`}>
      {text.split('').map((c, i) => (
        <span
          key={i}
          className="ch"
          style={{ animationDelay: `${delay + i * 28}ms` }}
        >
          {c === ' ' ? ' ' : c}
        </span>
      ))}
    </span>
  );
}
