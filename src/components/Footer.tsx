import { Mark } from './primitives';

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-[1400px] px-5 pt-14 pb-8 sm:px-10 sm:pt-16 lg:px-16">
        <div className="grid gap-10 grid-cols-2 lg:grid-cols-4">
          <div className="col-span-2 lg:col-span-2">
            <div className="flex items-center gap-3">
              <Mark size={28} />
              <div>
                <div className="font-display text-[17px] text-fg">Solaria</div>
                <div className="font-mono text-[8.5px] tracking-[0.22em] uppercase text-accent-strong mt-0.5">
                  Capital · LLC
                </div>
              </div>
            </div>
            <p className="mt-5 max-w-sm text-[13.5px] leading-relaxed text-fg-muted">
              Quantitative conviction for the next era of capital. One desk, three surfaces.
            </p>
          </div>

          <div>
            <div className="font-mono text-[9.5px] tracking-[0.22em] uppercase text-fg-faint">Surfaces</div>
            <ul className="mt-4 space-y-2 text-[13.5px] text-fg-muted">
              <li><a href="#fund" className="hover:text-accent transition-colors">Medallion Fund</a></li>
              <li><a href="#ventures" className="hover:text-accent transition-colors">Solaria Ventures</a></li>
              <li><a href="#research" className="hover:text-accent transition-colors">Solaria Research</a></li>
            </ul>
          </div>

          <div>
            <div className="font-mono text-[9.5px] tracking-[0.22em] uppercase text-fg-faint">Firm</div>
            <ul className="mt-4 space-y-2 text-[13.5px] text-fg-muted">
              <li><a href="#firm" className="hover:text-accent transition-colors">About</a></li>
              <li><a href="#record" className="hover:text-accent transition-colors">Record</a></li>
              <li><a href="#contact" className="hover:text-accent transition-colors">Contact</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-14 pt-6 border-t border-line flex flex-wrap items-center justify-between gap-4 text-[11.5px] text-fg-faint">
          <div className="font-mono tabular-nums">
            © {year} Solaria Capital, LLC · La Jolla, California
          </div>
          <div className="flex items-center gap-2 font-mono">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 rounded-full bg-[var(--accent-400)] animate-ping opacity-70" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-[var(--accent-400)]" />
            </span>
            <span className="tracking-[0.2em] uppercase text-accent-strong">System · Live</span>
          </div>
        </div>

        <div className="mt-6 text-[10.5px] text-fg-faint leading-relaxed max-w-4xl">
          This material is for informational purposes only and does not constitute an offer to sell or a
          solicitation to buy any security. The Medallion Fund is offered only to accredited investors via
          a private placement memorandum. Backtest figures are hypothetical. Past performance is not
          indicative of future results.
        </div>
      </div>
    </footer>
  );
}
