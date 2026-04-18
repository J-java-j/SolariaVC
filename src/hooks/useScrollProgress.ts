import { type RefObject, useEffect, useState } from 'react';

/**
 * Returns a 0..1 scroll progress value as `ref` traverses the viewport.
 * Used to scroll-drive the chart drawing in the Record section.
 */
export function useScrollProgress<T extends HTMLElement>(ref: RefObject<T | null>): number {
  const [p, setP] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const start = vh * 0.9;
      const end = -r.height + vh * 0.1;
      const t = (start - r.top) / (start - end);
      setP(Math.max(0, Math.min(1, t)));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [ref]);
  return p;
}
