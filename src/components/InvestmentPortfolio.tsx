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
      className={`relative scroll-mt-20 ${sectionSurface.dark}`}
    >
      <div ref={ref} className={`container-x section-py reveal ${inView ? 'is-in' : ''}`}>
        <SectionIntro
          layout="split"
          eyebrow="Investment Portfolio"
          headingId="investment-portfolio-heading"
          title="Public equities, student-managed."
          description="The student investment desk's public-market book — positions managed by members and posted here as they're set. Until live trading history is available, performance is shown via a backtest of the Solaria MAG7 Family model from our research."
        />

        <div className="desk">
          <div className="desk__panel">
            <h3 className="desk__label">Current portfolio</h3>
            <ul className="desk__holdings">
              {holdings.map((holding) => (
                <li key={holding.ticker} className="desk__holding">
                  <span className="desk__ticker">{holding.ticker}</span>
                  <span className="desk__name">{holding.name}</span>
                </li>
              ))}
            </ul>
            <p className="desk__note">{portfolio.holdingsNote}</p>
          </div>

          <div className="desk__panel">
            <h3 className="desk__label">Historical performance</h3>
            <div className="desk__chart">
              <img
                src={portfolio.chartSrc}
                alt={portfolio.chartAlt}
                width={1024}
                height={651}
                className="desk__chart-image"
                loading="lazy"
                decoding="async"
              />
            </div>

            <div className="desk__stats">
              <div className="desk__stat">
                <span className="desk__stat-value">{portfolio.cagrPct.toFixed(2)}%</span>
                <span className="desk__stat-label">Backtest CAGR</span>
              </div>
              <div className="desk__stat">
                <span className="desk__stat-value">{portfolio.sharpe.toFixed(2)}</span>
                <span className="desk__stat-label">Sharpe</span>
              </div>
              <div className="desk__stat">
                <span className="desk__stat-value">{portfolio.windowLabel}</span>
                <span className="desk__stat-label">Window</span>
              </div>
            </div>

            <p className="desk__model">{portfolio.modelLabel}</p>
            <p className="desk__disclaimer">
              Hypothetical backtest, net of modeled fees. Not live fund performance.
            </p>
            <a
              href={portfolio.paperUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-link desk__paper-link"
            >
              Read the research paper →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
