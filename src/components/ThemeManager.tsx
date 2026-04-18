import { useEffect } from 'react';

/**
 * Three-zone theme switcher:
 *   moss (cream + green)   — hero only, above Fund
 *   gold (black + gold)    — Fund + Record (the flagship zone)
 *   noir (black + green)   — everything AFTER Record
 *
 * The crossfade itself is owned by CSS transitions on background-color
 * and color (1.4s expo-out) — this hook just flips data-theme.
 */
export default function ThemeManager() {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'moss');
    const fundEl = document.getElementById('fund');
    const recordEl = document.getElementById('record');
    if (!fundEl) return;

    let current: 'moss' | 'gold' | 'noir' = 'moss';
    const update = () => {
      const vh = window.innerHeight;
      const fundTop = fundEl.getBoundingClientRect().top;
      const recordBottom = recordEl ? recordEl.getBoundingClientRect().bottom : Infinity;

      let next: 'moss' | 'gold' | 'noir' = 'moss';
      if (fundTop < vh * 0.55) {
        next = recordBottom > vh * 0.45 ? 'gold' : 'noir';
      }
      if (next !== current) {
        current = next;
        document.documentElement.setAttribute('data-theme', next);
      }
    };

    update();
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        update();
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return null;
}
