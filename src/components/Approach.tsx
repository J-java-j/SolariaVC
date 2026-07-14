import { useReveal } from '../hooks/useReveal';
import { SectionIntro } from './primitives';
import Card from './ui/Card';
import { sectionSurface } from '../lib/sectionTheme';

const pillars = [
  {
    title: 'Student-run portfolio',
    body: 'Members manage a live portfolio — analyzing opportunities, executing trades, rebalancing exposure, and assessing risk as a collaborative investment team.',
  },
  {
    title: 'Research & education',
    body: 'Teams produce valuation reports, quantitative models, backtesting frameworks, and industry analyses that support portfolio decisions — plus educational tools for the broader campus.',
  },
  {
    title: 'Campus venture support',
    body: 'We back campus startups with capital and connect founders to funding, resources, and operators — with paths for students to earn equity in the ventures they help grow.',
  },
  {
    title: 'Community & connection',
    body: 'Events, workshops, and competitions bring innovators together on a shared platform where student founders meet, collaborate, and push each other forward.',
  },
];

export default function Approach() {
  const [ref, inView] = useReveal(0.08);

  return (
    <section
      id="approach"
      data-theme="light"
      aria-labelledby="approach-heading"
      className={`relative scroll-mt-24 ${sectionSurface.light}`}
    >
      <div
        ref={ref}
        className={`container-x section-py transition-all duration-700 ease-out ${
          inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
        }`}
      >
        <SectionIntro
          eyebrow="What we do"
          headingId="approach-heading"
          title="Venture, research, and community — in one practice."
          description="Solaria Capital is a student-led investment organization at UC San Diego. We give undergraduates interested in business and investment a pre-professional home — managing real capital, producing research, backing campus founders, and building a network where ambitious builders connect."
        />

        <div className="section-grid grid gap-10 md:grid-cols-2 md:gap-12">
          {pillars.map((pillar) => (
            <Card key={pillar.title}>
              <h3 className="text-[20px] font-semibold leading-snug text-[var(--fg)]">{pillar.title}</h3>
              <p className="mt-4 text-body leading-relaxed text-[var(--fg-muted)]">{pillar.body}</p>
            </Card>
          ))}
        </div>
      </div>
      <div className="container-x">
        <div className="rule rule-section-divider" />
      </div>
    </section>
  );
}
