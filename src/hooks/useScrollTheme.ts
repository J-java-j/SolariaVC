import { useEffect } from 'react';

/** Darkens earlier in the scroll so contrast stays readable. */
function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Drives `--scroll-t` (0 = top/white, 1 = bottom/black) on <html>.
 * Transition spans ~1.35 viewport heights of scroll.
 */
export function useScrollTheme() {
  useEffect(() => {
    const root = document.documentElement;

    const update = () => {
      const span = Math.max(window.innerHeight * 1.35, 360);
      const raw = Math.min(1, Math.max(0, window.scrollY / span));
      root.style.setProperty('--scroll-t', String(easeOutCubic(raw)));
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      root.style.removeProperty('--scroll-t');
    };
  }, []);
}
