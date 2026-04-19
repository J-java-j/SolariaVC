import { useEffect, useState } from 'react';

/**
 * Returns true when the user has requested reduced motion via OS settings.
 * Every 3D / parallax effect on the site is gated through this — UX skill
 * flags forced motion as a HIGH-severity accessibility anti-pattern.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);
  return reduced;
}
