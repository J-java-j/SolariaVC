import { useEffect, useState } from 'react';

const links = [
  { href: '#about', label: 'About' },
  { href: '#thesis', label: 'Thesis' },
  { href: '#portfolio', label: 'Portfolio' },
  { href: '#team', label: 'Team' },
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'backdrop-blur-md bg-ink-950/70 border-b border-white/5'
          : 'bg-transparent'
      }`}
    >
      <div className="container-x flex h-16 items-center justify-between">
        <a href="#top" className="flex items-center gap-2.5 group">
          <SunMark className="h-7 w-7 transition-transform duration-500 group-hover:rotate-90" />
          <span className="font-display text-lg tracking-tight">
            Solaria<span className="text-sun-400"> VC</span>
          </span>
        </a>
        <nav className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-white/70 hover:text-white transition-colors"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="hidden md:flex">
          <a
            href="#apply"
            className="inline-flex items-center gap-1.5 rounded-full bg-sun-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-sun-400 transition-colors"
          >
            Apply
            <span aria-hidden>→</span>
          </a>
        </div>
        <button
          className="md:hidden text-white/80 p-2"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t border-white/5 bg-ink-950/95 backdrop-blur-md">
          <div className="container-x py-4 flex flex-col gap-3">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="text-base text-white/80 py-1"
              >
                {l.label}
              </a>
            ))}
            <a
              href="#apply"
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-sun-500 px-4 py-2 text-sm font-medium text-ink-950"
            >
              Apply →
            </a>
          </div>
        </div>
      )}
    </header>
  );
}

function SunMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <radialGradient id="navg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffd485" />
          <stop offset="60%" stopColor="#f57f0c" />
          <stop offset="100%" stopColor="#762f10" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="14" fill="url(#navg)" />
      <g stroke="#ffb947" strokeWidth="2.5" strokeLinecap="round">
        <line x1="32" y1="6" x2="32" y2="12" />
        <line x1="32" y1="52" x2="32" y2="58" />
        <line x1="6" y1="32" x2="12" y2="32" />
        <line x1="52" y1="32" x2="58" y2="32" />
        <line x1="13" y1="13" x2="17" y2="17" />
        <line x1="47" y1="47" x2="51" y2="51" />
        <line x1="51" y1="13" x2="47" y2="17" />
        <line x1="17" y1="47" x2="13" y2="51" />
      </g>
    </svg>
  );
}
