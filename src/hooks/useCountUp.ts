import { useEffect, useRef, useState } from 'react';

type Options = {
  to: number;
  from?: number;
  duration?: number;
  decimals?: number;
  start?: boolean;
};

export function useCountUp({
  to,
  from = 0,
  duration = 1200,
  decimals = 0,
  start = false,
}: Options): number {
  const [value, setValue] = useState(from);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!start || startedRef.current) return;
    startedRef.current = true;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setValue(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [start, to, from, duration]);

  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
