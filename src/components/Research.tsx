import { useReveal } from '../hooks/useReveal';
import { SectionIntro } from './primitives';
import Button from './ui/Button';
import { sectionSurface } from '../lib/sectionTheme';

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
    pdfUrl: '/research/solaria-family-model-m5v3.pdf',
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
      className={`relative scroll-mt-24 ${sectionSurface.dark}`}
    >
      <div
        ref={ref}
        className={`container-x section-py transition-all duration-700 ease-out ${
          inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
        }`}
      >
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <SectionIntro
              eyebrow="Research"
              headingId="research-heading"
              title="Research that backs the portfolio."
              description="Alongside managing live capital, members produce the analysis behind every decision — valuation work, quantitative models, backtests, and sector research that sharpen how we invest and what we teach on campus."
            />
            <p className="mt-5 text-[1.125rem] font-medium leading-snug text-[var(--accent-soft)]">
              Published work from the desk — with more on the way
            </p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {researchFocus.map((item) => (
                <li
                  key={item}
                  className="rounded-full border border-[var(--border-strong)] px-3 py-1 text-[13px] text-[var(--fg-muted)]"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-7 lg:pt-1">
            <ul className="space-y-5">
              {publications.map((paper) => (
                <li key={paper.title}>
                  <article className="border border-[var(--border-strong)] bg-[var(--bg-soft)] p-7 sm:p-8">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[var(--fg-faint)]">
                      <span className="font-medium uppercase tracking-[0.05em] text-[var(--fg-muted)]">
                        {paper.type}
                      </span>
                      <span aria-hidden>·</span>
                      <span>
                        {paper.author} · {paper.date}
                      </span>
                    </div>

                    <h3 className="mt-4 text-[1.375rem] font-medium leading-snug text-[var(--fg)]">
                      {paper.title}
                    </h3>
                    <p className="mt-2 text-[15px] font-medium text-[var(--accent-soft)]">
                      {paper.subtitle}
                    </p>
                    <p className="mt-4 text-[16px] leading-relaxed text-[var(--fg-muted)]">
                      {paper.summary}
                    </p>

                    {paper.pdfUrl ? (
                      <div className="mt-6 flex flex-wrap gap-3">
                        <Button
                          href={paper.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          variant="primary"
                          size="md"
                        >
                          Read paper
                        </Button>
                        <Button href={paper.pdfUrl} download variant="secondary" size="md">
                          Download PDF
                        </Button>
                      </div>
                    ) : null}
                  </article>
                </li>
              ))}
            </ul>

            <p className="mt-6 text-[15px] leading-relaxed text-[var(--fg-faint)]">
              Additional valuation reports, models, and campus-facing educational tools are in
              development and will be posted here as they are completed.
            </p>
          </div>
        </div>
      </div>
      <div className="container-x">
        <div className="rule rule-section-divider" />
      </div>
    </section>
  );
}
