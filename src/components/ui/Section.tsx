import type { ReactNode } from 'react';
import { Eyebrow } from '../primitives';

type Props = {
  id?: string;
  eyebrow?: string;
  eyebrowNum?: string;
  title?: ReactNode;
  description?: string;
  children: ReactNode;
  className?: string;
  innerClassName?: string;
};

export default function Section({
  id,
  eyebrow,
  eyebrowNum,
  title,
  description,
  children,
  className = '',
  innerClassName = '',
}: Props) {
  return (
    <section id={id} className={`relative ${className}`.trim()}>
      <div className={`container-x section-py ${innerClassName}`.trim()}>
        {eyebrow && <Eyebrow num={eyebrowNum}>{eyebrow}</Eyebrow>}
        {title && (
          <h2 className="editorial-h mt-12 text-display-md leading-[1.04]">{title}</h2>
        )}
        {description && (
          <p className="mt-8 max-w-2xl text-body text-[var(--ink-soft)]">{description}</p>
        )}
        {children}
      </div>
      <div className="container-x">
        <div className="rule" />
      </div>
    </section>
  );
}
