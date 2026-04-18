import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Reveal-on-scroll hook. Returns [ref, inView]. Elements already in
 * the viewport on mount are revealed immediately so above-the-fold
 * content paints visible without a stuck transition.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(_threshold = 0.15) {
  const ref = useRef<T | null>(null);
  const [vis, setVis] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) {
      setVis(true);
      return;
    }
    if (typeof IntersectionObserver === 'undefined') {
      setVis(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVis(true);
          io.disconnect();
        }
      },
      { threshold: 0, rootMargin: '0px 0px -5% 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return [ref, vis] as const;
}
