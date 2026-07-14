import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PORTFOLIO_COMING_SOON, type PortfolioCompany } from '../../lib/homeData';

type PortfolioShowcaseProps = {
  companies: PortfolioCompany[];
  intro: ReactNode;
};

export default function PortfolioShowcase({ companies, intro }: PortfolioShowcaseProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const titlesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const steps = stepRefs.current.filter(Boolean) as HTMLDivElement[];
    if (!root || !steps.length) return;

    let raf = 0;

    const syncTrackOffset = () => {
      const titles = titlesRef.current;
      if (!titles) return;
      const stepSize =
        parseFloat(getComputedStyle(root).getPropertyValue('--portfolio-step')) || 200;
      const lead = titles.offsetTop + titles.offsetHeight / 2 - stepSize / 2;
      root.style.setProperty('--portfolio-track-offset', `${Math.max(0, lead)}px`);
    };

    const update = () => {
      const titles = titlesRef.current;
      const trigger = titles
        ? titles.getBoundingClientRect().top + titles.offsetHeight / 2
        : window.innerHeight * 0.42;

      const first = steps[0].getBoundingClientRect();
      const last = steps[steps.length - 1].getBoundingClientRect();
      const firstMid = first.top + first.height / 2;
      const lastMid = last.top + last.height / 2;

      if (firstMid >= trigger) {
        setActiveIndex(0);
        return;
      }

      if (lastMid <= trigger) {
        setActiveIndex(steps.length - 1);
        return;
      }

      let bestIdx = 0;
      let bestDist = Infinity;

      steps.forEach((step, i) => {
        const rect = step.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        const dist = Math.abs(mid - trigger);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      });

      setActiveIndex(bestIdx);
    };

    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    const onLayout = () => {
      syncTrackOffset();
      update();
    };

    syncTrackOffset();
    update();

    const resizeObserver = new ResizeObserver(onLayout);
    resizeObserver.observe(root);

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onLayout, { passive: true });

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onLayout);
      cancelAnimationFrame(raf);
    };
  }, [companies.length]);

  return (
    <div
      className={`portfolio-showcase${PORTFOLIO_COMING_SOON ? ' portfolio-showcase--coming-soon' : ''}`}
      ref={rootRef}
    >
      <div className="portfolio-showcase__pin" aria-live="polite">
        <div className="portfolio-showcase__intro">{intro}</div>
        <div className="portfolio-showcase__grid">
          <div className="portfolio-showcase__media">
            <div className="portfolio-showcase__image-frame">
              {companies.map((company, i) => (
                <img
                  key={`${company.name}-${i}`}
                  src={company.imageUrl}
                  alt=""
                  className={`portfolio-showcase__image ${i === activeIndex ? 'is-active' : ''}`}
                />
              ))}
            </div>
          </div>

          <div className="portfolio-showcase__titles" ref={titlesRef} aria-hidden>
            {companies.map((company, i) => (
              <p
                key={`${company.name}-${i}-title`}
                className={`portfolio-showcase__name ${i === activeIndex ? 'is-active' : ''}`}
              >
                {company.name}
              </p>
            ))}
          </div>

          <div className="portfolio-showcase__detail">
            {companies.map((company, i) => (
              <div
                key={`${company.name}-${i}-detail`}
                className={`portfolio-showcase__detail-panel ${i === activeIndex ? 'is-active' : ''}`}
              >
                <p className="portfolio-showcase__tagline">{company.tagline}</p>
                <p className="portfolio-showcase__meta">
                  <span>{company.status}</span>
                  <span aria-hidden> · </span>
                  <span>{company.tags.join(' · ')}</span>
                  <span aria-hidden> · </span>
                  <span>{company.stage}</span>
                </p>
              </div>
            ))}
          </div>
        </div>

        {PORTFOLIO_COMING_SOON ? (
          <div className="portfolio-showcase__coming-soon" aria-hidden>
            <span className="portfolio-showcase__coming-soon-bar portfolio-showcase__coming-soon-bar--a" />
            <span className="portfolio-showcase__coming-soon-bar portfolio-showcase__coming-soon-bar--b" />
            <span className="portfolio-showcase__coming-soon-label">Coming Soon!</span>
          </div>
        ) : null}
      </div>

      <div className="portfolio-showcase__track" aria-hidden>
        {companies.map((company, i) => (
          <div
            key={`${company.name}-${i}-step`}
            ref={(el) => {
              stepRefs.current[i] = el;
            }}
            className="portfolio-showcase__step"
          />
        ))}
        <div className="portfolio-showcase__step portfolio-showcase__step--release" />
      </div>

      <div className="portfolio-showcase__mobile-intro">{intro}</div>

      {PORTFOLIO_COMING_SOON ? (
        <div className="portfolio-showcase__coming-soon portfolio-showcase__coming-soon--mobile" aria-hidden>
          <span className="portfolio-showcase__coming-soon-bar portfolio-showcase__coming-soon-bar--a" />
          <span className="portfolio-showcase__coming-soon-bar portfolio-showcase__coming-soon-bar--b" />
          <span className="portfolio-showcase__coming-soon-label">Coming Soon!</span>
        </div>
      ) : null}

      <div className="portfolio-showcase__mobile">
        {companies.map((company, i) => (
          <article key={`${company.name}-${i}-mobile`} className="portfolio-showcase__mobile-card">
            <div className="portfolio-showcase__image-frame portfolio-showcase__image-frame--mobile">
              <img src={company.imageUrl} alt="" className="portfolio-showcase__image is-active" />
            </div>
            <h3 className="portfolio-showcase__mobile-title">{company.name}</h3>
            <p className="portfolio-showcase__tagline">{company.tagline}</p>
            <p className="portfolio-showcase__meta">
              {company.status} · {company.tags.join(' · ')} · {company.stage}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
