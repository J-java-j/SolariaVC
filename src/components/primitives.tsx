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
    <div className={`flex items-center gap-2 ${className}`}>
      {num && (
        <span className="font-mono text-[14px] tabular-nums text-[var(--fg-muted)]">{num}</span>
      )}
      <span className="text-[16px] font-medium uppercase tracking-[0.05em] text-[var(--fg-muted)]">
        {children}
      </span>
    </div>
  );
}

export function SectionIntro({
  eyebrow,
  title,
  description,
  headingId,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  headingId?: string;
}) {
  return (
    <div className="section-intro">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 id={headingId} className="display-h section-intro__title text-display-md">
        {title}
      </h2>
      {description && <p className="section-intro__lede">{description}</p>}
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
    <h2 className={`display-h text-display-md ${className}`}>
      {children}
    </h2>
  );
}

/**
 * Solaria logo mark.
 */
export function Mark({ size = 22 }: { size?: number }) {
  return (
    <img
      src="/logo.png"
      alt=""
      width={size}
      height={size}
      className="shrink-0 object-contain"
      style={{
        height: size,
        width: 'auto',
        maxWidth: size * 1.35,
        transition: 'height 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
      aria-hidden
    />
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
          {c === ' ' ? '\u00a0' : c}
        </span>
      ))}
    </span>
  );
}
