import { useEffect, useState } from 'react';

/**
 * Eases up to `target` once `trigger` is true. Returns a fixed-decimal
 * string so width is stable for tabular-nums layouts.
 */
export function useCountUp(
  target: number,
  trigger: boolean,
  duration = 1800,
  decimals = 2
): string {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!trigger) return;
    let raf = 0;
    let start = 0;
    const tick = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / duration);
      const ease = 1 - Math.pow(1 - p, 3);
      setV(target * ease);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, trigger, duration]);
  return v.toFixed(decimals);
}
