import { Mark } from './primitives';
import { sectionSurface } from '../lib/sectionTheme';

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer data-theme="dark" className={`layered-footer relative ${sectionSurface.dark}`}>
      <div className="container-x pb-12 pt-20 sm:pt-24">
        <div className="grid gap-12 sm:grid-cols-12 sm:gap-10">
          <div className="sm:col-span-6">
            <div className="flex items-center gap-2.5">
              <Mark size={32} />
              <span className="text-[22px] font-semibold tracking-tight">Solaria VC</span>
            </div>
            <p className="mt-6 max-w-md text-body text-[var(--ink-soft)]">
              Student venture capital for frontier builders at UC San Diego.
            </p>
          </div>
          <div className="sm:col-span-3">
            <p className="text-[14px] text-[var(--ink-soft)]">Platform</p>
            <ul className="mt-5 space-y-2.5 text-[16px] text-[var(--ink-soft)]">
              <li>
                <a href="#approach" className="ulink-rev hover:text-[var(--ink)]">
                  What we do
                </a>
              </li>
              <li>
                <a href="#experience" className="ulink-rev hover:text-[var(--ink)]">
                  The experience
                </a>
              </li>
              <li>
                <a href="#investment-portfolio" className="ulink-rev hover:text-[var(--ink)]">
                  Investment Portfolio
                </a>
              </li>
              <li>
                <a href="#research" className="ulink-rev hover:text-[var(--ink)]">
                  Research
                </a>
              </li>
              <li>
                <a href="#portfolio" className="ulink-rev hover:text-[var(--ink)]">
                  Portfolio
                </a>
              </li>
              <li>
                <a href="#community" className="ulink-rev hover:text-[var(--ink)]">
                  Community
                </a>
              </li>
              <li>
                <a href="#people" className="ulink-rev hover:text-[var(--ink)]">
                  Team
                </a>
              </li>
            </ul>
          </div>
          <div className="sm:col-span-3">
            <p className="text-[14px] text-[var(--ink-soft)]">Contact</p>
            <ul className="mt-5 space-y-2.5 text-[16px] text-[var(--ink-soft)]">
              <li>hello@solariavc.com</li>
              <li>La Jolla, CA</li>
              <li>
                <a
                  href="https://linktr.ee/solariaventure"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ulink-rev hover:text-[var(--ink)]"
                >
                  linktr.ee/solariaventure
                </a>
              </li>
              <li>
                <a href="#contact" className="ulink-rev hover:text-[var(--ink)]">
                  Pitch us →
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--ink-line)] pt-8 text-[14px] text-[var(--ink-soft)]">
          <span>© {year} Solaria Capital, LLC</span>
          <span>Vintage 2026</span>
        </div>

        <p className="mt-6 max-w-3xl text-[13px] leading-relaxed text-[var(--ink-soft)]">
          For informational purposes only. Not an offer to sell or a solicitation to buy any
          security. Hypothetical performance figures are net of modeled fees and not indicative of
          future results. All investments carry risk of loss.
        </p>
      </div>
    </footer>
  );
}
