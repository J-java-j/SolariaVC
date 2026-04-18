import { useEffect, useState } from 'react';

const links = [
  { href: '#track', label: 'Track Record' },
  { href: '#fund', label: 'Fund' },
  { href: '#ventures', label: 'Ventures' },
  { href: '#research', label: 'Research' },
  { href: '#firm', label: 'Firm' },
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
          ? 'backdrop-blur-md bg-ink-950/80 border-b border-white/[0.06]'
          : 'bg-transparent'
      }`}
    >
      <div className="container-x flex h-16 items-center justify-between">
        <a href="#top" className="flex items-center gap-3 group">
          <img
            src="/logo.png"
            alt="Solaria Capital"
            className="h-8 w-8 object-contain transition-transform duration-500 group-hover:scale-105"
          />
          <span className="font-display text-lg tracking-tight">
            Solaria Capital
          </span>
          <span className="hidden sm:inline-block h-3 w-px bg-white/15" />
          <span className="hidden sm:inline-block label !tracking-[0.18em] !text-white/45">
            Capital · Research
          </span>
        </a>
        <nav className="hidden lg:flex items-center gap-8">
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
        <div className="hidden lg:flex items-center gap-3">
          <a
            href="#contact"
            className="text-sm text-white/70 hover:text-white transition-colors"
          >
            Contact
          </a>
          <a
            href="#contact"
            className="inline-flex items-center gap-1.5 rounded-md bg-moss-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-moss-400 transition-colors"
          >
            Investor inquiry
          </a>
        </div>
        <button
          className="lg:hidden text-white/80 p-2"
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
        <div className="lg:hidden border-t border-white/[0.06] bg-ink-950/95 backdrop-blur-md">
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
              href="#contact"
              onClick={() => setOpen(false)}
              className="text-base text-white/80 py-1"
            >
              Contact
            </a>
            <a
              href="#contact"
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-md bg-moss-500 px-4 py-2 text-sm font-medium text-ink-950"
            >
              Investor inquiry
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
