import { useReveal } from '../hooks/useReveal';
import { SectionIntro } from './primitives';
import CommunityAccordion from './ui/CommunityAccordion';
import { communityPrograms } from '../lib/homeData';
import { sectionSurface } from '../lib/sectionTheme';

export default function Community() {
  const [ref, inView] = useReveal(0.08);

  return (
    <section id="community" data-theme="light" className={`relative scroll-mt-20 ${sectionSurface.light}`}>
      <div ref={ref} className={`container-x section-py--compact reveal ${inView ? 'is-in' : ''}`}>
        <div className="grid gap-10 lg:grid-cols-12 lg:items-end lg:gap-16">
          <div className="lg:col-span-5">
            <SectionIntro
              eyebrow="Community"
              title="A network for people who build."
              description="Solaria Capital is more than a check — it's founders, researchers, and operators in the same room, learning from each other and pushing frontier work forward."
            />
            <p className="mt-6 max-w-md border-l-2 border-[var(--accent)] pl-4 text-[1rem] leading-relaxed text-[var(--fg)]">
              Open to ambitious students, alumni founders, and collaborators across campus.
            </p>
          </div>

          <div className="lg:col-span-7">
            <CommunityAccordion items={communityPrograms} variant="cards" />
          </div>
        </div>
      </div>
    </section>
  );
}
