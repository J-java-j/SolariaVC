import { useReveal } from '../hooks/useReveal';
import { Eyebrow, SectionTitle } from './primitives';

export default function Ventures() {
  const [revealRef, inView] = useReveal(0.1);
  return (
    <section id="ventures" className="relative border-t border-line">
      <div className="mx-auto max-w-[1400px] px-5 py-24 sm:px-10 sm:py-40 lg:px-16 lg:py-48">
        <div
          ref={revealRef}
          className={`transition-all duration-1000 ${
            inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <Eyebrow>Ventures</Eyebrow>
          <SectionTitle className="mt-6">
            <span className="text-accent">Coming soon.</span>
          </SectionTitle>
        </div>
      </div>
    </section>
  );
}
