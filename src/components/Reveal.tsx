import type { ReactNode } from 'react';
import { useInView } from '../hooks/useInView';

type Props = {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'header' | 'footer' | 'aside';
  /** how far to translate before reveal (px) */
  offset?: number;
};

/**
 * Reveals its children when scrolled into view via IntersectionObserver.
 * Cheap, composable, respects prefers-reduced-motion (handled by global CSS rule).
 */
export default function Reveal({
  children,
  delay = 0,
  className = '',
  as: Tag = 'div',
  offset = 24,
}: Props) {
  const [ref, shown] = useInView<HTMLDivElement>();
  const Comp = Tag as React.ElementType;
  return (
    <Comp
      ref={ref}
      className={`transition-all duration-[750ms] ease-out will-change-[opacity,transform] ${className}`}
      style={{
        transitionDelay: `${delay}ms`,
        opacity: shown ? 1 : 0,
        transform: shown ? 'translateY(0)' : `translateY(${offset}px)`,
      }}
    >
      {children}
    </Comp>
  );
}
