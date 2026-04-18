import { useReveal } from '../hooks/useReveal';
import { Eyebrow, SectionTitle } from './primitives';

const team = [
  { name: 'Johnson Jiang', role: 'Founder, Managing Partner' },
  { name: 'Karl Li',       role: 'Co-Founder' },
  { name: 'Esteban Reyes', role: 'Head of R&D' },
  { name: 'Tahir Eygoren', role: 'R&D' },
  { name: 'Monica Lin',    role: 'Marketing' },
];

export default function Firm() {
  const [revealRef, inView] = useReveal(0.1);
  return (
    <section id="firm" className="relative border-t border-line">
      <div className="mx-auto max-w-[1400px] px-5 py-24 sm:px-10 sm:py-40 lg:px-16 lg:py-48">
        <div
          ref={revealRef}
          className={`max-w-3xl transition-all duration-1000 ${
            inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <Eyebrow>Firm</Eyebrow>
          <SectionTitle className="mt-6">
            Same team.
            <br />
            <span className="text-accent">Three surfaces.</span>
          </SectionTitle>
        </div>

        <div className="mt-16 sm:mt-24 grid gap-y-6 sm:gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {team.map((m, i) => (
            <div
              key={m.name}
              className="border-t border-line pt-5"
              style={{ animation: inView ? `rise .7s ease-out ${i * 80}ms both` : 'none' }}
            >
              <div className="font-display text-[1.4rem] sm:text-[1.6rem] leading-tight tracking-tight text-fg">
                {m.name}
              </div>
              <div className="mt-1.5 font-mono text-[11px] tracking-[0.14em] uppercase text-fg-muted">
                {m.role}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 sm:mt-20 flex flex-wrap gap-x-10 gap-y-3 font-mono text-[11px] tracking-[0.18em] uppercase text-fg-faint">
          <span>Founded 2026</span>
          <span className="opacity-60">·</span>
          <span>La Jolla, CA</span>
          <span className="opacity-60">·</span>
          <span>Privately-held partnership</span>
        </div>
      </div>
    </section>
  );
}
