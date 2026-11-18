import { useReveal } from '../hooks/useReveal';
import { SectionIntro } from './primitives';
import Button from './ui/Button';
import { sectionSurface } from '../lib/sectionTheme';
import { INVESTMENT_PORTFOLIO } from '../lib/investmentPortfolioData';

type Publication = {
  title: string;
  subtitle: string;
  author: string;
  date: string;
  type: string;
  summary: string;
  pdfUrl?: string;
};

const publications: Publication[] = [
  {
    title: 'The Solaria MAG 7 Family',
    subtitle: 'M5V_3 — Core, Select, and Max strategies for Magnificent Seven exposure',
    author: 'Esteban Reyes',
    date: 'May 2026',
    type: 'Quantitative model',
    summary:
      'A backtested framework that introduces MAG 7 market dynamics and tests three diversification approaches — from risk-controlled Core to momentum-driven Max.',
    pdfUrl: INVESTMENT_PORTFOLIO.paperPdfUrl,
  },
];

const researchFocus = [
  'Valuation reports',
  'Quantitative models',
  'Backtesting frameworks',
  'Industry analyses',
];

export default function Research() {
  const [ref, inView] = useReveal(0.08);

  return (
    <section
      id="research"
      data-theme="dark"
      aria-labelledby="research-heading"
      className={`relative scroll-mt-20 ${sectionSurface.dark} section-surface--soft`}
    >
      <div ref={ref} className={`container-x section-py--compact reveal ${inView ? 'is-in' : ''}`}>
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <SectionIntro
              eyebrow="Research"
              headingId="research-heading"
              title="Research that backs the portfolio."
              description="Alongside managing live capital, members produce the analysis behind every decision — valuation work, quantitative models, backtests, and sector research that sharpen how we invest and what we teach on campus."
            />
            <p className="mt-7 text-[1.0625rem] font-medium leading-snug text-[var(--accent-ink)]">
              Published work from the desk — with more on the way
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {researchFocus.map((item) => (
                <li key={item} className="focus-chip">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-7">
            <ul className="space-y-5">
              {publications.map((paper) => (
                <li key={paper.title}>
                  <article className="paper">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-[var(--border)] pb-4 text-[14px] text-[var(--fg-muted)]">
                      <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-ink)]">
                        {paper.type}
                      </span>
                      <span aria-hidden className="text-[var(--fg-faint)]">·</span>
                      <span className="tabular-nums">
                        {paper.author} · {paper.date}
                      </span>
                    </div>

                    <h3 className="mt-6 font-serif text-[1.875rem] font-semibold leading-[1.1] tracking-[-0.02em] text-[var(--fg)] sm:text-[2.25rem]">
                      {paper.title}
                    </h3>
                    <p className="mt-3 text-[1rem] font-medium leading-snug text-[var(--accent-ink)]">
                      {paper.subtitle}
                    </p>
                    <p className="mt-4 max-w-[38rem] text-[1.0625rem] leading-relaxed text-[var(--fg-muted)]">
                      {paper.summary}
                    </p>

                    {paper.pdfUrl ? (
                      <div className="mt-7 flex flex-wrap gap-3">
                        <Button
                          href={paper.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          variant="primary"
                          size="md"
                          icon="external"
                        >
                          Read paper
                        </Button>
                        <Button href={paper.pdfUrl} download variant="secondary" size="md" icon="download">
                          Download PDF
                        </Button>
                      </div>
                    ) : null}
                  </article>
                </li>
              ))}
            </ul>

            <p className="mt-5 max-w-[40rem] text-[0.9375rem] leading-relaxed text-[var(--fg-muted)]">
              Additional valuation reports, models, and campus-facing educational tools are in
              development and will be posted here as they are completed.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
