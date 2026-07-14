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
      className={`relative scroll-mt-24 ${sectionSurface.light}`}
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
              eyebrow="The experience"
              headingId="experience-heading"
              title="Hands-on practice for the next generation of investors."
              description="Members learn by doing — with real workflows, real responsibility, and real stakes. Every discipline below is practiced on live work across the portfolio, research desk, and venture team."
            />
          </div>

          <div className="lg:col-span-7 lg:pt-1">
            <CommunityAccordion items={experienceDisciplines} />
          </div>
        </div>
      </div>
      <div className="container-x">
        <div className="rule" />
      </div>
    </section>
  );
}
