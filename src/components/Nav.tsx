import { useEffect, useState } from 'react';
import { Mark } from './primitives';
import Button from './ui/Button';

const items: [string, string][] = [
  ['What we do', '#approach'],
  ['Investment', '#investment-portfolio'],
  ['Research', '#research'],
  ['Portfolio', '#portfolio'],
  ['Community', '#community'],
  ['Team', '#people'],
];

/** Matches useNavTheme — nav stays large until hero has mostly scrolled away. */
const HERO_EXIT_RATIO = 0.18;

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [atHero, setAtHero] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const update = () => {
      const hero = document.getElementById('top');
      if (hero) {
        const revealLine = window.innerHeight * (1 - HERO_EXIT_RATIO);
        setAtHero(hero.getBoundingClientRect().bottom > revealLine);
      } else {
        setAtHero(window.scrollY < 120);
      }
      setScrolled(window.scrollY > 24);
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => window.removeEventListener('scroll', update);
  }, []);

  return (
    <header
      className={`layered-header theme-dark fixed inset-x-0 top-0 z-50 ${atHero ? 'nav-at-hero' : ''} ${scrolled ? 'is-scrolled' : ''}`}
    >
      <div className="container-x nav-bar flex items-center justify-between">
        <a href="#top" className="flex items-center gap-3.5">
          <Mark size={atHero ? 44 : 36} />
          <span className="nav-brand font-semibold leading-none tracking-tight text-[var(--fg)]">
            Solaria VC
          </span>
        </a>

        <nav className="nav-links hidden items-center md:flex">
          {items.map(([l, h]) => (
            <a
              key={h}
              href={h}
              className="nav-link transition-colors duration-250 ease-out"
            >
              {l}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Button
            href="#contact"
            variant="secondary"
            size="md"
            className="btn-pitch-nav hidden sm:inline-flex hover:!opacity-100"
          >
            Pitch us
          </Button>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            className="-mr-2 p-2 text-[var(--ink)] md:hidden"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path
                d={open ? 'M6 6l12 12M18 6L6 18' : 'M4 8h16M4 16h16'}
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-[var(--ink-line)] bg-[color-mix(in_oklab,var(--bg-elevated)_55%,var(--bg))] px-6 py-7 md:hidden">
          <nav className="flex flex-col gap-5">
            {items.map(([l, h]) => (
              <a
                key={h}
                href={h}
                onClick={() => setOpen(false)}
                className="nav-link text-[18px] text-[var(--ink)] transition-colors duration-250 ease-out"
              >
                {l}
              </a>
            ))}
          </nav>
          <div className="mt-6">
            <Button
              href="#contact"
              variant="secondary"
              size="lg"
              className="btn-pitch-nav w-full hover:!opacity-100"
              onClick={() => setOpen(false)}
            >
              Pitch us
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
