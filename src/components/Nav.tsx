import { useEffect, useState } from 'react';
import { Mark } from './primitives';

const items: [string, string][] = [
  ['Approach', '#approach'],
  ['Fund', '#fund'],
  ['Ventures', '#ventures'],
  ['People', '#people'],
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled ? 'backdrop-blur-md' : ''
      }`}
      style={
        scrolled
          ? {
              backgroundColor: 'color-mix(in oklab, var(--bg) 88%, transparent)',
              borderBottom: '1px solid var(--ink-line)',
            }
          : {}
      }
    >
      <div className="mx-auto flex max-w-[1320px] items-center justify-between px-6 py-5 sm:px-10 lg:px-14">
        <a href="#top" className="flex items-center gap-2.5">
          <Mark size={22} />
          <div className="leading-none">
            <div className="editorial-h text-[18px]">Solaria</div>
            <div
              className="font-mono text-[8.5px] tracking-[0.22em] uppercase mt-0.5"
              style={{ color: 'var(--moss)' }}
            >
              Capital
            </div>
          </div>
        </a>

        <nav className="hidden items-center gap-9 text-[13px] text-[var(--ink-soft)] md:flex">
          {items.map(([l, h]) => (
            <a key={h} href={h} className="transition-colors hover:text-[var(--ink)]">
              {l}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href="#contact"
            className="hidden text-[13px] text-[var(--ink)] ulink sm:inline-block"
          >
            Get in touch
          </a>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
            className="-mr-2 p-2 md:hidden"
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
        <div className="border-t border-[var(--ink-line)] bg-[var(--bg)] px-6 py-5 md:hidden space-y-3">
          {items.map(([l, h]) => (
            <a
              key={h}
              href={h}
              onClick={() => setOpen(false)}
              className="block text-[16px] text-[var(--ink)]"
            >
              {l}
            </a>
          ))}
          <a
            href="#contact"
            onClick={() => setOpen(false)}
            className="block text-[16px] text-[var(--moss)]"
          >
            Get in touch →
          </a>
        </div>
      )}
    </header>
  );
}
