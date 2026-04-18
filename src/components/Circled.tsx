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
  /** total draw duration in ms */
  duration?: number;
  className?: string;
};

/**
 * Wraps text in a hand-drawn-feel SVG ellipse that draws itself
 * around the content on scroll-in. The path is intentionally open
 * (start and end don't meet) and slightly imperfect — looks like
 * someone circled the word with a marker.
 */
export default function Circled({
  children,
  color = '#34d399',
  width = 3,
  delay = 350,
  duration = 1200,
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
        className="pointer-events-none absolute -left-[7%] -top-[22%] h-[148%] w-[114%]"
        viewBox="0 0 200 90"
        preserveAspectRatio="none"
        aria-hidden
      >
        {/*
          Hand-drawn-feel ellipse:
          - Starts at the top (~10 o'clock)
          - Travels around clockwise
          - Ends past the start point with a small overshoot, leaving a
            visible gap (like a marker circle that didn't quite close)
          - Slightly inconsistent radius / control points so it doesn't
            read as a perfect mathematical ellipse
        */}
        <path
          d="
            M 88 10
            C 150 4, 198 20, 196 44
            C 195 66, 138 81, 92 78
            C 48 75, 5 66, 6 41
            C 9 20, 56 8, 122 14
          "
          fill="none"
          stroke={color}
          strokeWidth={width}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray="1"
          strokeDashoffset={shown ? 0 : 1}
          style={{
            transition: `stroke-dashoffset ${duration}ms cubic-bezier(0.55, 0.1, 0.25, 1) ${delay}ms`,
          }}
        />
      </svg>
    </span>
  );
}
