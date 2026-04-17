import { useInView } from '../hooks/useInView';
import { useCountUp } from '../hooks/useCountUp';

type Props = {
  value: number;
  decimals?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  /** divide by 1000 and append 'K', or 1_000_000 and 'M', for compact display */
  format?: 'plain' | 'k' | 'm';
};

export default function AnimatedNumber({
  value,
  decimals = 0,
  duration = 1400,
  prefix = '',
  suffix = '',
  className = '',
  format = 'plain',
}: Props) {
  const [ref, shown] = useInView<HTMLSpanElement>({
    threshold: 0.4,
    rootMargin: '0px 0px -20px 0px',
  });

  // pick a representative numeric "to" based on format so the count-up animates
  // toward the same display the user will read at rest.
  let displayTo = value;
  if (format === 'k') displayTo = value / 1000;
  else if (format === 'm') displayTo = value / 1_000_000;

  const live = useCountUp({
    to: displayTo,
    decimals,
    duration,
    start: shown,
  });

  const formatted = live.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const compactSuffix = format === 'k' ? 'K' : format === 'm' ? 'M' : '';

  return (
    <span ref={ref} className={className}>
      {prefix}
      {formatted}
      {compactSuffix}
      {suffix}
    </span>
  );
}
