import Reveal from './Reveal';

type Member = {
  name: string;
  role: string;
  dept: 'Capital' | 'R&D' | 'Marketing';
  focus: string;
  founder?: boolean;
};

const team: Member[] = [
  { name: 'Johnson Jiang',  role: 'Founder & Managing Partner',     dept: 'Capital',   focus: 'Quant Research · Capital Markets',  founder: true },
  { name: 'Karl Li',        role: 'Co-Founder',                     dept: 'Capital',   focus: 'Strategy · Operations',             founder: true },
  { name: 'Esteban Reyes',  role: 'Head of Research & Development', dept: 'R&D',       focus: 'Quant Models · Backtesting' },
  { name: 'Tahir Eygoren',  role: 'Research & Development',         dept: 'R&D',       focus: 'Model Implementation · Data' },
  { name: 'Monica Lin',     role: 'Marketing',                      dept: 'Marketing', focus: 'Brand · Communications' },
];

const facts = [
  { k: 'Founded',      v: '2026' },
  { k: 'Headquarters', v: 'La Jolla, CA' },
  { k: 'Domicile',     v: 'California, USA' },
  { k: 'Entity',       v: 'Solaria Capital, LLC' },
];

export default function Firm() {
  return (
    <section
      id="firm"
      className="relative border-t border-white/[0.06] py-20 sm:py-28 lg:py-36"
    >
      <div className="container-x">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <Reveal className="lg:col-span-5">
            <div className="text-[11px] uppercase tracking-[0.24em] text-moss-300/80">
              The Firm
            </div>
            <h2 className="mt-4 font-display text-3xl font-medium leading-tight tracking-tight sm:text-4xl">
              Three desks, one team.
            </h2>
            <p className="mt-6 text-white/70 leading-relaxed">
              A privately held investment partnership. Five partners, three desks.
            </p>

            <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-white/[0.06] pt-6 text-sm">
              {facts.map((f) => (
                <div key={f.k}>
                  <dt className="text-[10.5px] uppercase tracking-[0.2em] text-white/45">
                    {f.k}
                  </dt>
                  <dd className="num mt-1 text-white">{f.v}</dd>
                </div>
              ))}
            </dl>
          </Reveal>

          <Reveal delay={120} className="lg:col-span-7">
            <div className="text-[10.5px] uppercase tracking-[0.2em] text-white/45 mb-4">
              The Team
            </div>
            <ul className="divide-y divide-white/[0.06] border-y border-white/[0.06]">
              {team.map((m) => (
                <li key={m.name} className="py-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <div className="flex items-baseline gap-3 min-w-0">
                      <span className="font-display text-lg text-white">{m.name}</span>
                      {m.founder && (
                        <span className="text-[10px] uppercase tracking-[0.18em] text-moss-300/70">
                          Founder
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-white/65">{m.role}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-3 text-[11px] text-white/40">
                    <span className="num">{m.dept}</span>
                    <span className="text-white/25">·</span>
                    <span>{m.focus}</span>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
