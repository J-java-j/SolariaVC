import { Mark } from './primitives';
import { sectionSurface } from '../lib/sectionTheme';

const platformLinks: [string, string][] = [
  ['What we do', '#approach'],
  ['The experience', '#experience'],
  ['Investment Portfolio', '#investment-portfolio'],
  ['Research', '#research'],
  ['Portfolio', '#portfolio'],
  ['Community', '#community'],
  ['Team', '#people'],
];

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer data-theme="dark" className={`site-footer relative ${sectionSurface.dark}`}>
      <div className="container-x pb-10 pt-16 sm:pt-20">
        <div className="grid gap-12 md:grid-cols-12 md:gap-10">
          <div className="md:col-span-12 lg:col-span-5">
            <div className="flex items-center gap-3">
              <Mark size={32} />
              <span className="text-[1.25rem] font-semibold tracking-[-0.015em]">Solaria Capital</span>
            </div>
            <p className="mt-5 max-w-sm text-[1.0625rem] leading-relaxed text-[var(--fg)]">
              Student venture capital for frontier builders at UC San Diego.
            </p>
            <p className="mt-3 max-w-sm text-[0.9375rem] leading-relaxed text-[var(--fg-muted)]">
              Supported by the{' '}
              <a
                href="https://rady.ucsd.edu/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-link !inline"
              >
                Rady School of Management
              </a>.
            </p>
          </div>

          <div className="md:col-span-7 lg:col-span-4">
            <p className="footer-heading">Platform</p>
            <ul className="mt-3 grid grid-flow-col grid-cols-2 grid-rows-4 gap-x-6 text-[0.9375rem]">
              {platformLinks.map(([label, href]) => (
                <li key={href}>
                  <a href={href} className="footer-link">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-5 lg:col-span-3">
            <p className="footer-heading">Contact</p>
            <ul className="mt-3 text-[0.9375rem] text-[var(--fg-muted)]">
              <li className="flex min-h-[2.75rem] items-center text-[var(--fg)] lg:min-h-[2.25rem]">contact@solariavc.com</li>
              <li className="flex min-h-[2.75rem] items-center lg:min-h-[2.25rem]">La Jolla, CA</li>
              <li>
                <a
                  href="https://linktr.ee/solariaventure"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-link"
                >
                  linktr.ee/solariaventure
                </a>
              </li>
              <li>
                <a href="#contact" className="footer-link font-medium !text-[var(--accent-ink)] hover:!text-[var(--fg)]">
                  Pitch us →
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 border-t border-[var(--border)] pt-6">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-[0.875rem] text-[var(--fg-muted)]">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
              <span>© {year} Solaria Capital, LLC</span>
              <span className="tabular-nums">Vintage 2026</span>
            </div>
            <a
              href="/staff"
              className="inline-flex min-h-[2.75rem] items-center gap-2 rounded-full border border-[var(--border-strong)] px-4 text-[0.875rem] text-[var(--fg-muted)] transition-colors hover:border-[var(--accent-soft)] hover:text-[var(--fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-ink)]"
            >
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
                <rect x="3.5" y="7" width="9" height="6.5" rx="1.2" />
                <path d="M5.5 7V5.2a2.5 2.5 0 015 0V7" />
              </svg>
              Team login
            </a>
          </div>

          <p className="mt-5 max-w-3xl text-[0.8125rem] leading-relaxed text-[var(--fg-muted)]">
            For informational purposes only. Not an offer to sell or a solicitation to buy any
            security. Hypothetical performance figures are net of modeled fees and not indicative of
            future results. All investments carry risk of loss.
          </p>
        </div>
      </div>
    </footer>
  );
}
