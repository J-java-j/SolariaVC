import type { ReactNode } from 'react';
import { useInView } from '../hooks/useInView';

type Props = {
  children: ReactNode;
  /** stroke color */
  color?: string;
  /** stroke width in viewBox units */
  width?: number;
  /** ms before the draw begins, after the element enters view */
  delay?: number;
  className?: string;
};

/**
 * Wraps text in a hand-drawn-feel SVG ellipse that draws itself
 * around the content on scroll-in. Inline-block so it can sit
 * inside a paragraph or headline without breaking the line.
 */
export default function Circled({
  children,
  color = '#34d399',
  width = 2.5,
  delay = 350,
  className = '',
}: Props) {
  const [ref, shown] = useInView<HTMLSpanElement>({ threshold: 0.5 });

  return (
    <span
      ref={ref}
      className={`relative inline-block leading-none ${className}`}
    >
      <span className="relative z-[1]">{children}</span>
      <svg
        className="pointer-events-none absolute -left-[6%] -top-[18%] h-[136%] w-[112%]"
        viewBox="0 0 200 80"
        preserveAspectRatio="none"
        aria-hidden
      >
        {/* slightly imperfect hand-drawn-feel ellipse */}
        <path
          d="M 102 8
             C 165 6, 196 22, 195 41
             C 194 60, 145 73, 100 72
             C 56 71, 6 62, 5 41
             C 4 22, 50 9, 102 8 Z"
          fill="none"
          stroke={color}
          strokeWidth={width}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray="1"
          strokeDashoffset={shown ? 0 : 1}
          style={{
            transition: `stroke-dashoffset 1.1s cubic-bezier(0.65, 0, 0.35, 1) ${delay}ms`,
          }}
        />
      </svg>
    </span>
  );
}
