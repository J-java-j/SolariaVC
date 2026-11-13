import { useReveal } from '../hooks/useReveal';
import { SectionIntro } from './primitives';
import CommunityAccordion from './ui/CommunityAccordion';
import { experienceDisciplines } from '../lib/homeData';
import { sectionSurface } from '../lib/sectionTheme';

export default function Experience() {
  const [ref, inView] = useReveal(0.08);

  return (
    <section
      id="experience"
      data-theme="light"
      aria-labelledby="experience-heading"
      className={`relative scroll-mt-20 ${sectionSurface.light} section-surface--soft`}
    >
      <div ref={ref} className={`container-x section-py reveal ${inView ? 'is-in' : ''}`}>
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-28">
              <SectionIntro
                eyebrow="The experience"
                headingId="experience-heading"
                title="Hands-on practice for the next generation of investors."
                description="Members learn by doing — with real workflows, real responsibility, and real stakes. Every discipline below is practiced on live work across the portfolio, research desk, and venture team."
              />
            </div>
          </div>

          <div className="lg:col-span-7">
            <CommunityAccordion items={experienceDisciplines} variant="list" />
          </div>
        </div>
      </div>
    </section>
  );
}
