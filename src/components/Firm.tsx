import Spotlight from './Spotlight';

type Member = {
  name: string;
  role: string;
  dept: 'Capital' | 'R&D' | 'Marketing';
  focus: string;
  founder?: boolean;
};

const team: Member[] = [
  {
    name: 'Johnson Jiang',
    role: 'Founder & Managing Partner',
    dept: 'Capital',
    focus: 'Quant Research · Capital Markets',
    founder: true,
  },
  {
    name: 'Karl Li',
    role: 'Co-Founder',
    dept: 'Capital',
    focus: 'Strategy · Operations',
    founder: true,
  },
  {
    name: 'Esteban Reyes',
    role: 'Head of Research & Development',
    dept: 'R&D',
    focus: 'Quant Models · Backtesting',
  },
  {
    name: 'Tahir Eygoren',
    role: 'Research & Development',
    dept: 'R&D',
    focus: 'Model Implementation · Data Pipelines',
  },
  {
    name: 'Monica Lin',
    role: 'Marketing',
    dept: 'Marketing',
    focus: 'Brand · Communications',
  },
];

const facts = [
  { k: 'Founded', v: '2026' },
  { k: 'Headquarters', v: 'San Diego, CA' },
  { k: 'Domicile', v: 'Delaware, USA' },
  { k: 'Entity', v: 'Solaria Capital, LLC' },
];

const deptStyles: Record<Member['dept'], string> = {
  Capital: 'bg-moss-500/10 text-moss-200 ring-moss-500/30',
  'R&D': 'bg-sky-500/10 text-sky-200 ring-sky-500/30',
  Marketing: 'bg-amber-500/10 text-amber-200 ring-amber-500/30',
};

const avatarGradient: Record<Member['dept'], string> = {
  Capital: 'from-moss-300/40 via-moss-700/50 to-ink-800',
  'R&D': 'from-sky-300/40 via-sky-700/50 to-ink-800',
  Marketing: 'from-amber-300/40 via-amber-700/50 to-ink-800',
};

export default function Firm() {
  return (
    <section
      id="firm"
      className="relative py-28 sm:py-36 border-t border-white/[0.06] bg-gradient-to-b from-ink-950 to-ink-900/40"
    >
      <div className="container-x">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="label">The Firm</div>
            <h2 className="mt-4 font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
              Built for the long arc.
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-white/70">
              Solaria is a privately held investment partnership. We operate three desks under
              one roof — Capital, which runs the Medallion Fund; Ventures, which writes
              pre-seed and seed checks; and Research, which publishes the quantitative work
              that informs both. Same team, same priors, three surfaces.
            </p>

            <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
              {facts.map((f) => (
                <div key={f.k} className="bg-ink-900/60 px-5 py-4">
                  <dt className="label !text-white/40 !text-[10px]">{f.k}</dt>
                  <dd className="num mt-1.5 text-white">{f.v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="lg:col-span-7">
            <div className="flex items-end justify-between gap-4 mb-6">
              <div className="label">The Team</div>
              <div className="num text-[11px] text-white/40">
                {team.length} partners · 3 departments
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {team.map((m, i) => (
                <MemberCard key={m.name} m={m} delay={i * 60} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MemberCard({ m, delay }: { m: Member; delay: number }) {
  const initials = m.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('');

  return (
    <Spotlight intensity={0.14} className="rounded-xl">
      <article
        className="relative h-full rounded-xl border border-white/10 bg-ink-900/55 p-5 transition-all hover:border-moss-500/30 hover:translate-y-[-2px] animate-rise"
        style={{ animationDelay: `${delay}ms` }}
      >
        <div className="flex items-start justify-between gap-3">
          <div
            className={`grid h-12 w-12 flex-shrink-0 place-items-center rounded-full bg-gradient-to-br ring-moss font-display text-base text-moss-100/90 ${avatarGradient[m.dept]}`}
          >
            {initials}
          </div>
          <span
            className={`num inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] ring-1 ${deptStyles[m.dept]}`}
          >
            {m.dept}
          </span>
        </div>
        <h3 className="mt-4 font-display text-lg leading-tight tracking-tight">
          {m.name}
        </h3>
        <div className="mt-1 text-[12.5px] text-moss-300/85">{m.role}</div>
        <div className="mt-4 border-t border-white/[0.06] pt-3 text-[11px] text-white/50 leading-relaxed">
          {m.focus}
        </div>
        {m.founder && (
          <span className="absolute right-3 bottom-3 text-[9px] uppercase tracking-[0.2em] text-white/30">
            Founder
          </span>
        )}
      </article>
    </Spotlight>
  );
}
