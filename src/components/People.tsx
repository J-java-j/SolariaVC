import { useReveal } from '../hooks/useReveal';
import { Eyebrow } from './primitives';

const partners = [
  { name: 'Johnson Jiang', role: 'Founder · Managing Partner' },
  { name: 'Karl Li', role: 'Co-Founder · Partner' },
];

const team = [
  { name: 'Esteban Reyes', role: 'Head of R&D' },
  { name: 'Tahir Eygoren', role: 'Research' },
  { name: 'Monica Lin', role: 'Operations' },
  { name: 'Elliot Yaroslavsky', role: 'Legal' },
];

function PortraitTile({ size = 'lg' }: { size?: 'lg' | 'sm' }) {
  const dims = size === 'lg' ? 'h-56 w-44' : 'h-44 w-36';
  return (
    <div className={`relative ${dims} mb-6 overflow-hidden`}>
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(155deg, var(--bg-warm) 0%, var(--bg-soft) 100%)',
        }}
      />
      <svg
        viewBox="0 0 144 176"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid slice"
      >
        <circle cx="72" cy="68" r="32" fill="var(--bg)" opacity="0.6" />
        <path d="M 16 176 Q 72 110, 128 176 Z" fill="var(--bg)" opacity="0.6" />
      </svg>
    </div>
  );
}

export default function People() {
  const [ref, inView] = useReveal();
  return (
    <section id="people" className="relative">
      <div
        ref={ref}
        className={`mx-auto max-w-[1320px] px-6 py-32 sm:px-10 sm:py-44 lg:px-14 lg:py-56 transition-all duration-1000 ${
          inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <Eyebrow num="§ 04">People</Eyebrow>
        <h2 className="editorial-h mt-10 text-[2.4rem] sm:text-[3.6rem] lg:text-[4.4rem]">
          Two partners. <span style={{ color: 'var(--ink-soft)' }}>Every call.</span>
        </h2>

        <div className="mt-20 sm:mt-24 grid gap-14 sm:grid-cols-2 sm:gap-16 sm:gap-x-20">
          {partners.map((p) => (
            <div key={p.name}>
              <PortraitTile size="lg" />
              <div className="editorial-h text-[1.9rem] leading-[1.05] tracking-tight">
                {p.name}
              </div>
              <div
                className="mt-2 font-mono text-[10.5px] tracking-[0.18em] uppercase"
                style={{ color: 'var(--moss)' }}
              >
                {p.role}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-24 sm:mt-32 border-t border-[var(--ink-line)] pt-12">
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[var(--ink-faint)]">
            The desk
          </div>
          <div className="mt-12 grid gap-y-12 sm:grid-cols-2 sm:gap-y-14 sm:gap-x-16 lg:grid-cols-4 lg:gap-x-14">
            {team.map((p) => (
              <div key={p.name}>
                <PortraitTile size="sm" />
                <div className="editorial-h text-[1.4rem] leading-[1.1] tracking-tight">
                  {p.name}
                </div>
                <div
                  className="mt-1.5 font-mono text-[10.5px] tracking-[0.18em] uppercase"
                  style={{ color: 'var(--moss)' }}
                >
                  {p.role}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-[1320px] px-6 sm:px-10 lg:px-14">
        <div className="rule" />
      </div>
    </section>
  );
}
