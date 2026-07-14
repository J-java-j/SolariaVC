import { useReveal } from '../hooks/useReveal';
import { SectionIntro } from './primitives';
import { sectionSurface } from '../lib/sectionTheme';
import {
  INVESTMENT_PORTFOLIO as portfolio,
  INVESTMENT_PORTFOLIO_HOLDINGS as holdings,
} from '../lib/investmentPortfolioData';

export default function InvestmentPortfolio() {
  const [ref, inView] = useReveal(0.08);

  return (
    <section
      id="investment-portfolio"
      data-theme="dark"
      aria-labelledby="investment-portfolio-heading"
      className={`relative scroll-mt-24 ${sectionSurface.dark}`}
    >
      <div
        ref={ref}
        className={`container-x section-py transition-all duration-700 ease-out ${
          inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
        }`}
      >
        <SectionIntro
          eyebrow="Investment Portfolio"
          headingId="investment-portfolio-heading"
          title="Public equities, student-managed."
          description="The student investment desk's public-market book — positions managed by members and posted here as they're set. Until live trading history is available, performance is shown via a backtest of the Solaria MAG7 Family model from our research."
        />

        <div className="investment-portfolio__panels">
          <div className="investment-portfolio__panel">
            <h3 className="investment-portfolio__panel-title">Current portfolio</h3>
            <ul className="investment-portfolio__holdings">
              {holdings.map((holding) => (
                <li key={holding.ticker} className="investment-portfolio__holding">
                  <span className="investment-portfolio__ticker">{holding.ticker}</span>
                  <span className="investment-portfolio__name">{holding.name}</span>
                </li>
              ))}
            </ul>
            <p className="investment-portfolio__holdings-note">{portfolio.holdingsNote}</p>
          </div>

          <div className="investment-portfolio__panel">
            <h3 className="investment-portfolio__panel-title">Historical performance</h3>
            <div className="investment-portfolio__chart-panel">
              <img
                src={portfolio.chartSrc}
                alt={portfolio.chartAlt}
                className="investment-portfolio__chart-image"
                loading="lazy"
                decoding="async"
              />
            </div>

            <div className="investment-portfolio__stats">
              <div className="investment-portfolio__stat">
                <span className="investment-portfolio__stat-value">
                  {portfolio.cagrPct.toFixed(2)}%
                </span>
                <span className="investment-portfolio__stat-label">Backtest CAGR</span>
              </div>
              <div className="investment-portfolio__stat">
                <span className="investment-portfolio__stat-value">{portfolio.sharpe.toFixed(2)}</span>
                <span className="investment-portfolio__stat-label">Sharpe</span>
              </div>
              <div className="investment-portfolio__stat">
                <span className="investment-portfolio__stat-value">{portfolio.windowLabel}</span>
                <span className="investment-portfolio__stat-label">Window</span>
              </div>
            </div>

            <p className="investment-portfolio__model">{portfolio.modelLabel}</p>
            <p className="investment-portfolio__disclaimer">
              Hypothetical backtest, net of modeled fees. Not live fund performance.
            </p>
            <a
              href={portfolio.paperUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="investment-portfolio__paper-link ulink-rev"
            >
              Read the research paper →
            </a>
          </div>
        </div>
      </div>

      <div className="container-x">
        <div className="rule rule-section-divider" />
      </div>
    </section>
  );
}
