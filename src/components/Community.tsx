import { useReveal } from '../hooks/useReveal';
import { SectionIntro } from './primitives';
import CommunityAccordion from './ui/CommunityAccordion';
import { communityPrograms } from '../lib/homeData';
import { sectionSurface } from '../lib/sectionTheme';

export default function Community() {
  const [ref, inView] = useReveal(0.08);

  return (
    <section id="community" data-theme="light" className={`relative scroll-mt-24 ${sectionSurface.light}`}>
      <div
        ref={ref}
        className={`container-x section-py transition-all duration-700 ease-out ${
          inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
        }`}
      >
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <SectionIntro
              eyebrow="Community"
              title="A network for people who build."
              description="Solaria VC is more than a check — it's founders, researchers, and operators in the same room, learning from each other and pushing frontier work forward."
            />
            <p className="mt-5 max-w-md text-body text-[var(--fg-muted)]">
              Open to ambitious students, alumni founders, and collaborators across campus.
            </p>
          </div>

          <div className="lg:col-span-7 lg:pt-1">
            <CommunityAccordion items={communityPrograms} />
          </div>
        </div>
      </div>
    </section>
  );
}
