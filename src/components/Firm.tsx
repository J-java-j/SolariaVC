import { useReveal } from '../hooks/useReveal';
import { Eyebrow, SectionTitle } from './primitives';

const team = [
  { name: 'Johnson Jiang', role: 'Founder & Managing Partner', focus: 'Quant research · capital markets', founder: true },
  { name: 'Karl Li',       role: 'Co-Founder',                 focus: 'Strategy · operations',           founder: true },
  { name: 'Esteban Reyes', role: 'Head of R&D',                focus: 'Quant models · backtesting' },
  { name: 'Tahir Eygoren', role: 'R&D',                        focus: 'Model implementation · data' },
  { name: 'Monica Lin',    role: 'Marketing',                  focus: 'Brand · communications' },
];

export default function Firm() {
  const [revealRef, inView] = useReveal(0.1);
  return (
    <section id="firm" className="relative border-t border-line">
      <div className="mx-auto max-w-[1400px] px-5 py-20 sm:px-10 sm:py-32 lg:px-16 lg:py-40">
        <div
          ref={revealRef}
          className={`max-w-3xl transition-all duration-1000 ${
            inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <Eyebrow>The firm</Eyebrow>
          <SectionTitle className="mt-5">
            Same team. Same priors.
            <br />
            <span className="text-accent italic font-light">Three surfaces.</span>
          </SectionTitle>
          <p className="mt-5 sm:mt-6 max-w-2xl text-[15.5px] sm:text-[17px] leading-relaxed text-fg-muted">
            Solaria Capital, LLC is a privately-held investment partnership founded in 2026,
            headquartered in La Jolla, California.
          </p>
        </div>

        <div className="mt-10 sm:mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {team.map((m, i) => {
            const init = m.name.split(' ').map((p) => p[0]).slice(0, 2).join('');
            return (
              <article
                key={m.name}
                className="group rounded-2xl border border-line bg-fg-b p-6 transition-all hover:border-line-strong hover:-translate-y-0.5"
                style={{ animation: inView ? `rise .7s ease-out ${i * 80}ms both` : 'none' }}
              >
                <div className="flex items-center gap-4">
                  <div className="grid h-14 w-14 place-items-center rounded-full bg-[rgba(var(--accent-rgb),0.10)] ring-1 ring-[rgba(var(--accent-rgb),0.25)] font-display text-[17px] text-accent">
                    {init}
                  </div>
                  <div>
                    <div className="font-display text-[17px] leading-tight text-fg">{m.name}</div>
                    <div className="mt-1 text-[12.5px] text-accent-strong/85">{m.role}</div>
                  </div>
                </div>
                <div className="mt-5 border-t border-line pt-4 flex items-center justify-between">
                  <div className="font-mono text-[11px] text-fg-muted">{m.focus}</div>
                  {m.founder && (
                    <div className="rounded bg-[rgba(var(--accent-rgb),0.10)] px-2 py-0.5 font-mono text-[9px] tracking-[0.22em] uppercase text-accent-strong ring-1 ring-[rgba(var(--accent-rgb),0.25)]">
                      Founder
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
