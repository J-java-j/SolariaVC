import { useMemo, useState } from 'react';
import Reveal from './Reveal';

type Company = {
  name: string;
  desc: string;
  sector: string;
  stage: 'Pre-seed' | 'Seed' | 'Series A';
  year: string;
  status: 'Active' | 'Diligence';
};

const companies: Company[] = [
  { name: 'Helios Compute',  desc: 'Distributed inference infrastructure for foundation models.', sector: 'AI Infra',     stage: 'Seed',     year: '2026', status: 'Active' },
  { name: 'Penumbra AI',     desc: 'Runtime for autonomous research agents that ship code.',      sector: 'AI Infra',     stage: 'Pre-seed', year: '2026', status: 'Active' },
  { name: 'Coronal Energy',  desc: 'Long-duration grid-scale storage on iron-air chemistry.',     sector: 'Energy',       stage: 'Seed',     year: '2026', status: 'Active' },
  { name: 'Vesper Labs',     desc: 'Carbon removal via mineralisation of basalt waste streams.',  sector: 'Energy',       stage: 'Pre-seed', year: '2026', status: 'Active' },
  { name: 'Aphelion Bio',    desc: 'Programmable diagnostics from a single drop of blood.',       sector: 'Bio × Compute', stage: 'Pre-seed', year: '2025', status: 'Active' },
  { name: 'Forgework',       desc: 'Vertically-integrated robotic manufacturing.',                sector: 'Robotics',     stage: 'Seed',     year: '2025', status: 'Active' },
  { name: 'Stratus Defense', desc: 'Autonomy stack for unmanned aerial systems at the edge.',     sector: 'Defense',      stage: 'Seed',     year: '2026', status: 'Diligence' },
  { name: 'Umbra Data',      desc: 'Alternative data marketplace for institutional researchers.',  sector: 'Data',         stage: 'Seed',     year: '2025', status: 'Active' },
];

const sectors = ['All', ...Array.from(new Set(companies.map((c) => c.sector)))];

export default function Ventures() {
  const [filter, setFilter] = useState<string>('All');
  const filtered = useMemo(
    () => (filter === 'All' ? companies : companies.filter((c) => c.sector === filter)),
    [filter]
  );

  return (
    <section
      id="ventures"
      className="relative border-t border-white/[0.06] py-20 sm:py-28 lg:py-36"
    >
      <div className="container-x">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <Reveal className="lg:col-span-5">
            <div className="text-[11px] uppercase tracking-[0.24em] text-moss-300/80">
              Solaria Ventures
            </div>
            <h2 className="mt-4 font-display text-3xl font-medium leading-tight tracking-tight sm:text-4xl">
              Pre-seed and seed,
              <br /> scored by our models.
            </h2>
            <p className="mt-6 text-white/70 leading-relaxed">
              Early checks into technical founders. Sourced through our network,
              scored by our models.
            </p>

            <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-white/[0.06] pt-6 text-sm">
              <Stat k="Tracked" v={String(companies.length).padStart(2, '0')} />
              <Stat k="Sectors" v={String(sectors.length - 1)} />
              <Stat k="Deployed" v="$13K" />
              <Stat k="Vintages" v="’25–’26" />
            </dl>

            <a
              href="#contact"
              className="mt-8 inline-flex items-center gap-2 text-sm text-moss-300 hover:text-moss-200"
            >
              Pitch us <span aria-hidden>→</span>
            </a>
          </Reveal>

          <Reveal delay={120} className="lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div className="flex flex-wrap gap-1.5">
                {sectors.map((s) => {
                  const active = filter === s;
                  return (
                    <button
                      key={s}
                      onClick={() => setFilter(s)}
                      className={`rounded-md px-2.5 py-1 text-[11px] transition-colors ${
                        active
                          ? 'bg-moss-500/15 text-moss-200 ring-1 ring-moss-500/30'
                          : 'text-white/55 hover:text-white'
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
              <div className="num text-[11px] text-white/40">
                {filtered.length} {filtered.length === 1 ? 'company' : 'companies'}
              </div>
            </div>

            <ul className="divide-y divide-white/[0.06] border-y border-white/[0.06]">
              {filtered.map((c) => (
                <li key={c.name} className="py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-3">
                        <span className="font-display text-lg text-white">
                          {c.name}
                        </span>
                        <span className="text-[11px] text-white/40">
                          {c.sector} · {c.stage} · {c.year}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm text-white/65 leading-relaxed">
                        {c.desc}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 num text-[10px] uppercase tracking-[0.18em] ${
                        c.status === 'Active' ? 'text-moss-300/85' : 'text-amber-300/85'
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            {filtered.length === 0 && (
              <div className="border-y border-white/[0.06] py-12 text-center text-sm text-white/55">
                No companies in this sector yet.
              </div>
            )}
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[10.5px] uppercase tracking-[0.2em] text-white/45">{k}</dt>
      <dd className="num mt-1 text-white">{v}</dd>
    </div>
  );
}
