import { SectionLabel } from './About';

type Stage = 'Pre-seed' | 'Seed' | 'Series A' | 'In diligence';

const companies: { name: string; sector: string; stage: Stage; status: string }[] = [
  { name: 'Helios Labs', sector: 'AI Infra', stage: 'Pre-seed', status: 'Active' },
  { name: 'Coronal', sector: 'Energy', stage: 'Seed', status: 'Active' },
  { name: 'Aphelion Bio', sector: 'Bio × Compute', stage: 'Pre-seed', status: 'Active' },
  { name: 'Forgework', sector: 'Robotics', stage: 'Seed', status: 'Active' },
  { name: 'Stratus', sector: 'Defense', stage: 'In diligence', status: 'Pending' },
  { name: 'Penumbra AI', sector: 'Frontier AI', stage: 'Pre-seed', status: 'Active' },
];

export default function Portfolio() {
  return (
    <section id="portfolio" className="relative py-28 sm:py-36">
      <div className="container-x">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <SectionLabel>Portfolio</SectionLabel>
            <h2 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Companies in the orbit.
            </h2>
            <p className="mt-5 text-lg text-white/70">
              A snapshot of what we're backing today. Names are placeholders for our launching cohort —
              real ones land here as they go public.
            </p>
          </div>
        </div>

        <div className="mt-16 overflow-hidden rounded-2xl border border-white/10">
          <div className="grid grid-cols-12 border-b border-white/10 bg-white/[0.02] px-6 py-3 text-xs font-medium uppercase tracking-wider text-white/50">
            <div className="col-span-5">Company</div>
            <div className="col-span-3">Sector</div>
            <div className="col-span-2">Stage</div>
            <div className="col-span-2 text-right">Status</div>
          </div>
          {companies.map((c) => (
            <div
              key={c.name}
              className="grid grid-cols-12 items-center border-b border-white/5 px-6 py-5 transition-colors hover:bg-white/[0.02] last:border-b-0"
            >
              <div className="col-span-5 flex items-center gap-3">
                <div className="h-9 w-9 rounded-md bg-gradient-to-br from-sun-400/30 to-sun-700/30 ring-sun" />
                <span className="font-display text-lg">{c.name}</span>
              </div>
              <div className="col-span-3 text-white/65">{c.sector}</div>
              <div className="col-span-2 text-white/65">{c.stage}</div>
              <div className="col-span-2 text-right">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${
                    c.status === 'Active'
                      ? 'bg-sun-500/15 text-sun-200'
                      : 'bg-white/10 text-white/70'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      c.status === 'Active' ? 'bg-sun-300' : 'bg-white/50'
                    }`}
                  />
                  {c.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
