import { useEffect } from 'react';

type SiteTheme = 'light' | 'dark';

/** Fraction of viewport height before the next section background becomes visible. */
const HERO_EXIT_RATIO = 0.18;

/**
 * Syncs `data-site-theme` on <html> with the section behind the nav.
 * Holds the dark hero theme until the hero has mostly scrolled away.
 */
export function useNavTheme() {
  useEffect(() => {
    const root = document.documentElement;

    const update = () => {
      const hero = document.getElementById('top');
      if (hero) {
        const heroBottom = hero.getBoundingClientRect().bottom;
        const revealLine = window.innerHeight * (1 - HERO_EXIT_RATIO);
        if (heroBottom > revealLine) {
          root.dataset.siteTheme = 'dark';
          return;
        }
      }

      const sections = Array.from(
        document.querySelectorAll<HTMLElement>('[data-theme]'),
      );
      if (!sections.length) return;

      const probeY = window.innerHeight * 0.38;
      let active = sections[0];

      for (const section of sections) {
        const { top, bottom } = section.getBoundingClientRect();
        if (top <= probeY && bottom > probeY) {
          active = section;
          break;
        }
        if (top <= probeY) active = section;
      }

      const theme = active.dataset.theme as SiteTheme | undefined;
      if (theme) root.dataset.siteTheme = theme;
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      root.dataset.siteTheme = 'dark';
    };
  }, []);
}
