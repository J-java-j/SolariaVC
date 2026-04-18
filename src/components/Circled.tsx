import { useId, type ReactNode } from 'react';
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
 * (start and end don't meet) and a per-instance turbulence filter
 * adds tiny pixel-level wobble so the line doesn't read as a perfect
 * mathematical ellipse.
 */
export default function Circled({
  children,
  color = '#34d399',
  width = 3,
  delay = 350,
  duration = 1300,
  className = '',
}: Props) {
  const [ref, shown] = useInView<HTMLSpanElement>({ threshold: 0.2 });
  const filterId = useId().replace(/:/g, '');

  // Long absolute dasharray so the offset animation walks the dash
  // pattern off the path once and the line draws cleanly.
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
        <defs>
          <filter id={`r${filterId}`} x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.018"
              numOctaves="2"
              seed={3}
              result="noise"
            />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.8" />
          </filter>
        </defs>
        <path
          filter={`url(#r${filterId})`}
          d="
            M 86 11
            C 148 4, 198 18, 197 42
            C 195 65, 138 81, 92 78
            C 48 75, 4 66, 6 40
            C 9 19, 56 7, 124 13
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
