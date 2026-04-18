import { useReveal } from '../hooks/useReveal';
import { Eyebrow, SectionTitle } from './primitives';

const companies = [
  { name: 'Helios Compute', sector: 'AI Infra' },
  { name: 'Penumbra AI',    sector: 'AI Infra' },
  { name: 'Coronal Energy', sector: 'Energy' },
  { name: 'Aphelion Bio',   sector: 'Bio × Compute' },
  { name: 'Forgework',      sector: 'Robotics' },
  { name: 'Umbra Data',     sector: 'Data' },
];

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
            First checks.
            <br />
            <span className="text-accent italic font-light">Scored by models.</span>
          </SectionTitle>
        </div>

        <div className="mt-16 sm:mt-24 grid gap-y-6 sm:gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map((c, i) => (
            <div
              key={c.name}
              className="border-t border-line pt-5"
              style={{ animation: inView ? `rise .7s ease-out ${i * 80}ms both` : 'none' }}
            >
              <div className="font-display text-[1.4rem] sm:text-[1.6rem] leading-tight tracking-tight text-fg">
                {c.name}
              </div>
              <div className="mt-1.5 font-mono text-[11px] tracking-[0.14em] uppercase text-fg-muted">
                {c.sector}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
