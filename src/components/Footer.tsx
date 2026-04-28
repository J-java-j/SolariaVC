import { Mark } from './primitives';

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative border-t border-[var(--ink-line)]">
      <div className="mx-auto max-w-[1320px] px-6 pb-10 pt-20 sm:px-10 sm:pt-24 lg:px-14">
        <div className="grid gap-12 sm:grid-cols-12 sm:gap-10">
          <div className="sm:col-span-6">
            <div className="flex items-center gap-2.5">
              <Mark size={28} />
              <span className="editorial-h text-[24px]">Solaria Capital</span>
            </div>
            <p className="mt-6 max-w-sm text-[14.5px] leading-[1.6] text-[var(--ink-soft)]">
              Grow capital. Build legacy.
            </p>
          </div>
          <div className="sm:col-span-3">
            <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[var(--ink-faint)]">
              The firm
            </div>
            <ul className="mt-5 space-y-2.5 text-[14px] text-[var(--ink-soft)]">
              <li>
                <a href="#approach" className="ulink-rev hover:text-[var(--ink)]">
                  Approach
                </a>
              </li>
              <li>
                <a href="#fund" className="ulink-rev hover:text-[var(--ink)]">
                  The Fund
                </a>
              </li>
              <li>
                <a href="#ventures" className="ulink-rev hover:text-[var(--ink)]">
                  Ventures
                </a>
              </li>
              <li>
                <a href="#people" className="ulink-rev hover:text-[var(--ink)]">
                  People
                </a>
              </li>
            </ul>
          </div>
          <div className="sm:col-span-3">
            <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[var(--ink-faint)]">
              Contact
            </div>
            <ul className="mt-5 space-y-2.5 text-[14px] text-[var(--ink-soft)]">
              <li>hello@solariavc.com</li>
              <li>La Jolla, CA</li>
              <li>
                <a href="#contact" className="ulink-rev hover:text-[var(--ink)]">
                  Pitch us →
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--ink-line)] pt-6 font-mono text-[10.5px] tabular-nums text-[var(--ink-faint)]">
          <span>© {year} Solaria Capital, LLC</span>
          <span className="flex items-center gap-2 tracking-[0.22em] uppercase">
            <span className="live-dot" />
            Vintage 2026 · Open
          </span>
        </div>

        <p className="mt-6 max-w-3xl text-[10.5px] leading-[1.7] text-[var(--ink-faint)]">
          For informational purposes only. Not an offer to sell or a solicitation to buy any
          security. Hypothetical performance figures are net of modeled fees and not indicative of
          future results. All investments carry risk of loss.
        </p>
      </div>
    </footer>
  );
}
