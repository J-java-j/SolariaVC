import { useReveal } from '../hooks/useReveal';
import { SectionIntro } from './primitives';
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
      className={`relative scroll-mt-20 ${sectionSurface.light}`}
    >
      <div ref={ref} className={`container-x section-py reveal ${inView ? 'is-in' : ''}`}>
        <SectionIntro
          layout="split"
          eyebrow="What we do"
          headingId="approach-heading"
          title="Venture, research, and community — in one practice."
          description="Solaria Capital is a student-led investment organization at UC San Diego. We give undergraduates interested in business and investment a pre-professional home — managing real capital, producing research, backing campus founders, and building a network where ambitious builders connect."
        />

        <div className="pillars">
          {pillars.map((pillar) => (
            <div key={pillar.title} className="pillar">
              <h3 className="pillar__title">
                <span className="pillar__dot" aria-hidden />
                {pillar.title}
              </h3>
              <p className="pillar__body">{pillar.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
