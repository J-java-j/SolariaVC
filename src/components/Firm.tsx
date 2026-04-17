import Spotlight from './Spotlight';

const team = [
  { name: 'Johnson Jiang', role: 'Founder & Managing Partner', focus: 'Quant Research · Capital Markets' },
  { name: 'Open Seat', role: 'Partner — Quant Strategies', focus: 'Statistical Arb · Vol' },
  { name: 'Open Seat', role: 'Partner — Ventures', focus: 'Pre-seed · Seed · Diligence' },
  { name: 'Open Seat', role: 'Head of Research', focus: 'Factor Models · Alt Data' },
];

const facts = [
  { k: 'Founded', v: '2026' },
  { k: 'Domicile', v: 'Delaware, USA' },
  { k: 'Entity', v: 'Solaria Capital, LLC' },
  { k: 'Desks', v: 'Capital · Ventures · Research' },
];

export default function Firm() {
  return (
    <section id="firm" className="relative py-28 sm:py-36 border-t border-white/[0.06] bg-gradient-to-b from-ink-950 to-ink-900/40">
      <div className="container-x">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="label">The Firm</div>
            <h2 className="mt-4 font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
              Built for the long arc.
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-white/70">
              Solaria is a privately held investment partnership. We operate three desks under one
              roof — Capital, which runs the Medallion Fund; Ventures, which writes pre-seed and
              seed checks; and Research, which publishes the quantitative work that informs both.
              Same team, same priors, three surfaces.
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
            <Spotlight intensity={0.1}>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-ink-900/40">
              <div className="grid grid-cols-12 border-b border-white/[0.06] bg-white/[0.02] px-6 py-3 text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">
                <div className="col-span-5">Partner</div>
                <div className="col-span-4">Role</div>
                <div className="col-span-3 text-right">Focus</div>
              </div>
              {team.map((m, i) => (
                <div
                  key={i}
                  className="grid grid-cols-12 items-center border-b border-white/[0.04] px-6 py-5 transition-colors hover:bg-white/[0.025] last:border-b-0"
                >
                  <div className="col-span-5 flex items-center gap-3.5">
                    <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-md bg-gradient-to-br from-moss-400/30 via-moss-700/30 to-ink-800 ring-moss font-display text-sm text-moss-100/85">
                      {m.name === 'Open Seat' ? '+' : m.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                    </div>
                    <span className="font-display text-lg">{m.name}</span>
                  </div>
                  <div className="col-span-4 text-sm text-white/65">{m.role}</div>
                  <div className="col-span-3 text-right text-sm text-white/45">{m.focus}</div>
                </div>
              ))}
            </div>
            </Spotlight>
          </div>
        </div>
      </div>
    </section>
  );
}
