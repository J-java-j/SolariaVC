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
 * (start and end don't meet) and slightly imperfect.
 *
 * Implementation note: uses a large absolute strokeDasharray (rather
 * than pathLength=1 + dasharray=1, which normalises to "1 1" and
 * renders as a 50/50 dash/gap pattern instead of a fully solid line).
 */
export default function Circled({
  children,
  color = '#34d399',
  width = 3,
  delay = 350,
  duration = 1200,
  className = '',
}: Props) {
  const [ref, shown] = useInView<HTMLSpanElement>({ threshold: 0.25 });

  // Approximate length of the path below — generous so the dash
  // pattern definitely covers it (>) at any viewport scale.
  const PATH_LEN = 600;

  return (
    <span
      ref={ref}
      className={`relative inline-block ${className}`}
    >
      <span className="relative z-[1]">{children}</span>
      <svg
        className="pointer-events-none absolute"
        style={{
          left: '-7%',
          top: '-22%',
          width: '114%',
          height: '148%',
          overflow: 'visible',
        }}
        viewBox="0 0 200 90"
        preserveAspectRatio="none"
        aria-hidden
      >
        {/*
          Open hand-drawn-feel ellipse. Starts at top (~10 o'clock),
          travels clockwise, ends past the start with a small overshoot
          so the ends don't meet — like a marker stroke that didn't
          quite close. Asymmetric Bézier control points so the radius
          wobbles slightly.
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
          strokeDasharray={PATH_LEN}
          strokeDashoffset={shown ? 0 : PATH_LEN}
          style={{
            transition: `stroke-dashoffset ${duration}ms cubic-bezier(0.55, 0.1, 0.25, 1) ${delay}ms`,
          }}
        />
      </svg>
    </span>
  );
}
