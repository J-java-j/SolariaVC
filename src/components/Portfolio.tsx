import { useReveal } from '../hooks/useReveal';
import { SectionIntro } from './primitives';
import PortfolioShowcase from './ui/PortfolioShowcase';
import { portfolioCompanies } from '../lib/homeData';
import { sectionSurface } from '../lib/sectionTheme';

export default function Portfolio() {
  const [ref, inView] = useReveal(0.08);

  return (
    <section
      id="portfolio"
      data-theme="dark"
      aria-labelledby="portfolio-heading"
      className={`relative scroll-mt-24 ${sectionSurface.dark}`}
    >
      <span id="ventures" className="sr-only" aria-hidden />
      <div
        ref={ref}
        className={`container-x section-py transition-all duration-700 ease-out ${
          inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
        }`}
      >
        <PortfolioShowcase
          companies={portfolioCompanies}
          intro={
            <SectionIntro
              eyebrow="Portfolio"
              headingId="portfolio-heading"
              title="Companies we're backing — and room for the next."
            />
          }
        />
      </div>
      <div className="container-x">
        <div className="rule" />
      </div>
    </section>
  );
}
