import { useEffect } from 'react';

/**
 * Engages the gold theme when the Medallion Fund section's top crosses
 * 55% of the viewport, and releases it when the Record section's bottom
 * passes 45% of the viewport. Smooth crossfade is handled by CSS
 * transition on html/body background-color.
 */
export default function ThemeManager() {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'moss');
    const fundEl = document.getElementById('fund');
    const recordEl = document.getElementById('record');
    if (!fundEl || !recordEl) return;

    let engaged = false;
    const update = () => {
      const vh = window.innerHeight;
      const fundTop = fundEl.getBoundingClientRect().top;
      const recordBottom = recordEl.getBoundingClientRect().bottom;
      const shouldEngage = fundTop < vh * 0.55 && recordBottom > vh * 0.45;
      if (shouldEngage !== engaged) {
        engaged = shouldEngage;
        document.documentElement.setAttribute('data-theme', engaged ? 'gold' : 'moss');
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
