import { useEffect, useState } from 'react';
import { Mark } from './primitives';

const items: [string, string][] = [
  ['Fund', '#fund'],
  ['Ventures', '#ventures'],
  ['Research', '#research'],
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled ? 'backdrop-blur-xl border-b border-line' : ''
      }`}
      style={
        scrolled
          ? { backgroundColor: 'color-mix(in oklab, var(--bg-a) 85%, transparent)' }
          : {}
      }
    >
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-5 py-4 sm:px-10 lg:px-16">
        <a href="#top" className="flex items-center gap-3">
          <Mark size={26} />
          <div className="leading-none">
            <div className="font-display text-[17px] tracking-tight text-fg">Solaria</div>
            <div className="font-mono text-[8.5px] tracking-[0.22em] uppercase text-accent-strong mt-0.5">
              Capital · LLC
            </div>
          </div>
        </a>

        <nav className="hidden md:flex items-center gap-10 text-[13px] text-fg-muted">
          {items.map(([l, h]) => (
            <a key={h} href={h} className="relative hover:text-fg transition-colors group">
              {l}
              <span className="absolute -bottom-1 left-0 right-0 h-px scale-x-0 bg-[var(--accent-400)] transition-transform group-hover:scale-x-100 origin-left" />
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <a
            href="#contact"
            className="hidden sm:inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-[12.5px] font-semibold hover:opacity-90 transition-opacity"
          >
            Contact →
          </a>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            className="md:hidden rounded-md border border-line p-2 text-fg"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d={open ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h16'} strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-line bg-fg-a backdrop-blur-xl px-5 py-4 space-y-3 sm:px-10">
          {items.map(([l, h]) => (
            <a
              key={h}
              href={h}
              onClick={() => setOpen(false)}
              className="block text-[15px] text-fg py-1.5"
            >
              {l}
            </a>
          ))}
          <a
            href="#contact"
            onClick={() => setOpen(false)}
            className="block text-[15px] text-accent-strong py-1.5"
          >
            Contact →
          </a>
        </div>
      )}
    </header>
  );
}
