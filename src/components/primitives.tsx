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
    <div className={`eyebrow ${className}`.trim()}>
      <svg viewBox="0 0 14 14" className="eyebrow__mark" aria-hidden>
        <ellipse cx="7" cy="7" rx="6.25" ry="3.75" fill="none" stroke="currentColor" strokeWidth="1.1" />
        <circle cx="7" cy="7" r="1.75" fill="currentColor" />
      </svg>
      {num && <span className="font-mono tabular-nums">{num}</span>}
      <span>{children}</span>
    </div>
  );
}

export function SectionIntro({
  eyebrow,
  title,
  description,
  headingId,
  layout = 'stack',
}: {
  eyebrow: string;
  title: string;
  description?: string;
  headingId?: string;
  layout?: 'stack' | 'split';
}) {
  return (
    <div className={`section-intro${layout === 'split' ? ' section-intro--split' : ''}`}>
      <div className="section-intro__head">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 id={headingId} className="display-h section-intro__title text-display-md">
          {title.replace(/ —/g, '\u00a0—')}
        </h2>
      </div>
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
