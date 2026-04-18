import type { ReactNode } from 'react';
import { useInView } from '../hooks/useInView';

type Props = {
  children: ReactNode;
  delay?: number;
  className?: string;
  /** how far to translate up before reveal (px) */
  offset?: number;
};

/**
 * Scroll-triggered fade-in + lift. Uses opacity + translateY only —
 * neither affects layout, so wrapping a grid item in <Reveal> can't
 * push other content around or cover text.
 */
export default function Reveal({
  children,
  delay = 0,
  className = '',
  offset = 20,
}: Props) {
  const [ref, shown] = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`transition-all duration-[700ms] ease-out will-change-[opacity,transform] ${className}`}
      style={{
        transitionDelay: `${delay}ms`,
        opacity: shown ? 1 : 0,
        transform: shown ? 'translateY(0)' : `translateY(${offset}px)`,
      }}
    >
      {children}
    </div>
  );
}
