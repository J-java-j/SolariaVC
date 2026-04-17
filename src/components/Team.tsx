import { SectionLabel } from './About';

const team = [
  { name: 'Johnson Jiang', role: 'Managing Partner', focus: 'AI Infra · Energy' },
  { name: 'Open Seat', role: 'Partner', focus: 'Bio × Compute' },
  { name: 'Open Seat', role: 'Partner', focus: 'Robotics · Defense' },
  { name: 'Open Seat', role: 'Principal', focus: 'Frontier AI' },
  { name: 'Open Seat', role: 'Associate', focus: 'Sourcing · Diligence' },
  { name: 'Open Seat', role: 'Associate', focus: 'Platform · Ops' },
];

export default function Team() {
  return (
    <section id="team" className="relative py-28 sm:py-36 bg-gradient-to-b from-ink-950 to-ink-900/40">
      <div className="container-x">
        <div className="max-w-2xl">
          <SectionLabel>Team</SectionLabel>
          <h2 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            The investing committee.
          </h2>
          <p className="mt-5 text-lg text-white/70">
            Six seats. Each member writes their own memos and sources their own deals. We're hiring our
            inaugural cohort now.
          </p>
        </div>

        <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] sm:grid-cols-2 lg:grid-cols-3">
          {team.map((m, i) => (
            <article
              key={i}
              className="group relative bg-ink-900/60 p-7 transition-colors hover:bg-ink-800/80"
            >
              <div className="flex items-center gap-4">
                <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-sun-300/30 via-sun-600/30 to-ink-700 ring-sun">
                  <span className="absolute inset-0 grid place-items-center font-display text-xl text-sun-100/80">
                    {m.name === 'Open Seat' ? '+' : m.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                  </span>
                </div>
                <div>
                  <h3 className="font-display text-xl">{m.name}</h3>
                  <div className="text-sm text-sun-200/80">{m.role}</div>
                </div>
              </div>
              <div className="mt-5 text-sm text-white/55">{m.focus}</div>
              {m.name === 'Open Seat' && (
                <a
                  href="#apply"
                  className="mt-4 inline-flex items-center gap-1 text-sm text-white/80 hover:text-sun-300"
                >
                  Apply for this seat <span aria-hidden>→</span>
                </a>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
