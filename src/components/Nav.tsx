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

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 24);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const desktop = window.matchMedia('(min-width: 1024px)');
    const onResize = () => {
      if (desktop.matches) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    desktop.addEventListener('change', onResize);
    return () => {
      window.removeEventListener('keydown', onKey);
      desktop.removeEventListener('change', onResize);
    };
  }, [open]);

  return (
    <header
      className={`site-header theme-dark ${scrolled ? 'is-scrolled' : ''} ${open ? 'is-open' : ''}`}
    >
      <div className="container-x site-header__bar flex items-center justify-between gap-6">
        <a href="#top" className="site-header__brand">
          <Mark size={36} />
          <span>Solaria Capital</span>
        </a>

        <nav aria-label="Primary" className="hidden items-center gap-6 lg:flex xl:gap-8">
          {items.map(([l, h]) => (
            <a key={h} href={h} className="nav-link">
              {l}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button href="#contact" variant="primary" size="sm" className="hidden sm:inline-flex">
            Pitch us
          </Button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="site-menu"
            className="site-header__toggle lg:hidden"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path
                d={open ? 'M6 6l12 12M18 6L6 18' : 'M4 9h16M4 15h16'}
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div id="site-menu" className="site-header__panel lg:hidden">
          <nav aria-label="Primary" className="container-x flex flex-col">
            {items.map(([l, h]) => (
              <a
                key={h}
                href={h}
                onClick={() => setOpen(false)}
                className="site-header__panel-link"
              >
                {l}
              </a>
            ))}
          </nav>
          <div className="container-x mt-6">
            <Button
              href="#contact"
              variant="primary"
              size="lg"
              className="w-full"
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
