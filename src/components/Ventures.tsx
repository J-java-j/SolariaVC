import { useMemo, useState } from 'react';
import Spotlight from './Spotlight';

type Company = {
  name: string;
  desc: string;
  sector: string;
  stage: 'Pre-seed' | 'Seed' | 'Series A';
  year: string;
  status: 'Active' | 'Diligence';
};

const companies: Company[] = [
  {
    name: 'Helios Compute',
    desc: 'Distributed inference infrastructure for foundation models at the edge.',
    sector: 'AI Infra',
    stage: 'Seed',
    year: '2026',
    status: 'Active',
  },
  {
    name: 'Penumbra AI',
    desc: 'Runtime for autonomous research agents that ship production code.',
    sector: 'AI Infra',
    stage: 'Pre-seed',
    year: '2026',
    status: 'Active',
  },
  {
    name: 'Coronal Energy',
    desc: 'Long-duration grid-scale storage built on iron-air chemistry.',
    sector: 'Energy',
    stage: 'Seed',
    year: '2026',
    status: 'Active',
  },
  {
    name: 'Vesper Labs',
    desc: 'Carbon removal via mineralization of basalt waste streams.',
    sector: 'Energy',
    stage: 'Pre-seed',
    year: '2026',
    status: 'Active',
  },
  {
    name: 'Aphelion Bio',
    desc: 'Programmable diagnostics from a single drop of blood.',
    sector: 'Bio × Compute',
    stage: 'Pre-seed',
    year: '2025',
    status: 'Active',
  },
  {
    name: 'Forgework',
    desc: 'Vertically-integrated robotic manufacturing for precision parts.',
    sector: 'Robotics',
    stage: 'Seed',
    year: '2025',
    status: 'Active',
  },
  {
    name: 'Stratus Defense',
    desc: 'Autonomy stack for unmanned aerial systems at the tactical edge.',
    sector: 'Defense',
    stage: 'Seed',
    year: '2026',
    status: 'Diligence',
  },
  {
    name: 'Umbra Data',
    desc: 'Alternative data marketplace for institutional quant researchers.',
    sector: 'Data',
    stage: 'Seed',
    year: '2025',
    status: 'Active',
  },
];

const sectors = ['All', ...Array.from(new Set(companies.map((c) => c.sector)))];

const stats = [
  { k: 'Companies', v: String(companies.length).padStart(2, '0') },
  { k: 'Sectors', v: String(sectors.length - 1) },
  { k: 'Deployed', v: '$680K' },
  { k: 'Vintages', v: "'25–'26" },
];

export default function Ventures() {
  const [filter, setFilter] = useState<string>('All');

  const filtered = useMemo(
    () => (filter === 'All' ? companies : companies.filter((c) => c.sector === filter)),
    [filter]
  );

  return (
    <section id="ventures" className="relative py-28 sm:py-36 border-t border-white/[0.06]">
      <div className="absolute inset-0 -z-10 grid-bg opacity-40" aria-hidden />
      <div className="container-x">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="label">Solaria Ventures</div>
            <h2 className="mt-4 font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
              Backing the founders <br className="hidden sm:block" />
              building what's next.
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-white/70">
              The venture arm writes pre-seed and seed checks into technical founders shipping
              across AI, energy, bio, robotics, and defense. Sourced through our network,
              scored by our models, underwritten by the partners.
            </p>
            <p className="mt-4 text-white/55">
              Ventures allocations feed into the Medallion Fund's Frontier sleeve — the same
              conviction, the same investors on the other side.
            </p>

            <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] sm:grid-cols-4">
              {stats.map((s) => (
                <div
                  key={s.k}
                  className="bg-ink-900/60 px-5 py-4 transition-colors hover:bg-ink-800/80"
                >
                  <dt className="label !text-white/40 !text-[10px]">{s.k}</dt>
                  <dd className="num mt-1.5 text-lg text-white">{s.v}</dd>
                </div>
              ))}
            </dl>

            <a
              href="#contact"
              className="mt-10 inline-flex items-center gap-2 rounded-md bg-moss-500 px-5 py-3 text-sm font-semibold text-ink-950 transition-all hover:bg-moss-400 hover:translate-y-[-1px] glow-moss"
            >
              Pitch the Ventures team
              <span aria-hidden>→</span>
            </a>
          </div>

          <div className="lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div
                role="tablist"
                aria-label="Filter by sector"
                className="flex flex-wrap gap-1.5"
              >
                {sectors.map((s) => {
                  const active = filter === s;
                  return (
                    <button
                      key={s}
                      role="tab"
                      aria-selected={active}
                      onClick={() => setFilter(s)}
                      className={`rounded-full px-3 py-1 text-[11px] transition-all ${
                        active
                          ? 'bg-moss-500/20 text-moss-200 ring-1 ring-moss-500/40'
                          : 'border border-white/10 bg-white/[0.03] text-white/60 hover:text-white hover:border-white/25'
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

            <div key={filter} className="grid gap-4 sm:grid-cols-2">
              {filtered.map((c, i) => (
                <CompanyCard key={c.name} c={c} delay={i * 50} />
              ))}
              {filtered.length === 0 && (
                <div className="sm:col-span-2 rounded-xl border border-dashed border-white/10 bg-ink-900/40 p-10 text-center text-sm text-white/55">
                  No companies in this sector yet — we're actively sourcing.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CompanyCard({ c, delay }: { c: Company; delay: number }) {
  const initials = c.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('');

  return (
    <Spotlight intensity={0.14} className="rounded-xl">
      <article
        className="relative rounded-xl border border-white/10 bg-ink-900/55 p-5 transition-all hover:border-moss-500/30 hover:translate-y-[-2px] animate-rise"
        style={{ animationDelay: `${delay}ms` }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-md bg-gradient-to-br from-moss-400/30 via-moss-700/40 to-ink-800 ring-moss font-display text-sm text-moss-100/85">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="font-display text-base leading-tight">{c.name}</div>
              <div className="mt-0.5 text-[11px] text-white/45">
                {c.sector} · {c.year}
              </div>
            </div>
          </div>
          <span
            className={`num inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] ring-1 ${
              c.status === 'Active'
                ? 'bg-moss-500/15 text-moss-200 ring-moss-500/30'
                : 'bg-amber-500/10 text-amber-200 ring-amber-500/30'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                c.status === 'Active' ? 'bg-moss-300' : 'bg-amber-300'
              }`}
            />
            {c.status}
          </span>
        </div>
        <p className="mt-3.5 text-sm text-white/70 leading-relaxed">{c.desc}</p>
        <div className="mt-5 flex items-center justify-between text-[11px]">
          <span className="text-white/45">
            Stage:{' '}
            <span className="num text-white/80">{c.stage}</span>
          </span>
          <a
            href="#contact"
            className="text-moss-300/80 transition-colors hover:text-moss-200"
          >
            Learn more <span aria-hidden>→</span>
          </a>
        </div>
      </article>
    </Spotlight>
  );
}
