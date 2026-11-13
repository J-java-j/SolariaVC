import { useReveal } from '../hooks/useReveal';
import { SectionIntro } from './primitives';
import PortfolioShowcase from './ui/PortfolioShowcase';
import { PORTFOLIO_COMING_SOON, portfolioCompanies } from '../lib/homeData';
import { sectionSurface } from '../lib/sectionTheme';

export default function Portfolio() {
  const [ref, inView] = useReveal(0.08);

  return (
    <section
      id="portfolio"
      data-theme="dark"
      aria-labelledby="portfolio-heading"
      className={`relative scroll-mt-20 ${sectionSurface.dark}`}
    >
      <span id="ventures" className="sr-only" aria-hidden />
      <div ref={ref} className={`container-x section-py reveal ${inView ? 'is-in' : ''}`}>
        <PortfolioShowcase
          companies={portfolioCompanies}
          intro={
            <SectionIntro
              eyebrow="Portfolio"
              headingId="portfolio-heading"
              title={
                PORTFOLIO_COMING_SOON
                  ? 'Our portfolio, in the making.'
                  : "Companies we're backing — and room for the next."
              }
              description="We're looking for the next builders to back — ambitious teams pushing frontier work forward."
            />
          }
        />

        <div className="mt-16 grid gap-5 border-t border-[var(--border-strong)] pt-10 lg:mt-24 lg:grid-cols-12 lg:gap-16 lg:pt-12">
          <h3 className="display-h text-display-sm lg:col-span-5">
            From the lab, through Innovation and Commercialization.
          </h3>
          <p className="max-w-[36rem] text-[1.125rem] leading-[1.65] text-[var(--fg-muted)] lg:col-span-6 lg:col-start-7 lg:pt-1">
            We work with UC San Diego professors on early-stage research and the patents that grow
            out of it. It puts us close to frontier technology before it becomes a company — and
            helps us find the founders worth backing next.
          </p>
        </div>
      </div>
    </section>
  );
}
