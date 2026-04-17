import { SectionLabel } from './About';

const pillars = [
  {
    title: 'Frontier AI',
    body: 'Foundation model infrastructure, agents that actually ship work, and the developer tools that make them tractable.',
    icon: AiIcon,
  },
  {
    title: 'Energy & Climate',
    body: 'Atoms-level companies in fusion, fission, grid storage, and the software that lets them scale.',
    icon: EnergyIcon,
  },
  {
    title: 'Robotics & Manufacturing',
    body: 'Humanoids, autonomy stacks, and a re-industrialized supply chain built on American shores.',
    icon: RobotIcon,
  },
  {
    title: 'Bio × Compute',
    body: 'Computational biology, programmable medicine, and the diagnostics layer that makes care preventive.',
    icon: BioIcon,
  },
];

export default function Thesis() {
  return (
    <section id="thesis" className="relative py-28 sm:py-36 bg-gradient-to-b from-ink-950 via-ink-900/60 to-ink-950">
      <div className="container-x">
        <div className="max-w-3xl">
          <SectionLabel>Thesis</SectionLabel>
          <h2 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            We invest where the future gets built.
          </h2>
          <p className="mt-5 text-lg text-white/70">
            Four pillars. Pre-seed and seed. Conviction over coverage. We back founders before the
            consensus arrives.
          </p>
        </div>

        <div className="mt-16 grid gap-5 sm:grid-cols-2">
          {pillars.map(({ title, body, icon: Icon }) => (
            <div
              key={title}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-ink-900/40 p-7 sm:p-8 transition-all duration-500 hover:border-sun-400/30 hover:bg-ink-800/60"
            >
              <div
                className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-sun-500/10 blur-3xl transition-opacity duration-500 opacity-0 group-hover:opacity-100"
                aria-hidden
              />
              <Icon className="h-9 w-9 text-sun-400" />
              <h3 className="mt-6 font-display text-2xl tracking-tight">{title}</h3>
              <p className="mt-3 text-white/65 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AiIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="3" r="1" />
      <circle cx="12" cy="21" r="1" />
      <circle cx="3" cy="12" r="1" />
      <circle cx="21" cy="12" r="1" />
      <line x1="12" y1="4" x2="12" y2="9" />
      <line x1="12" y1="15" x2="12" y2="20" />
      <line x1="4" y1="12" x2="9" y2="12" />
      <line x1="15" y1="12" x2="20" y2="12" />
    </svg>
  );
}

function EnergyIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden>
      <path d="M13 2 L4 14 h7 l-1 8 9-12 h-7 z" strokeLinejoin="round" />
    </svg>
  );
}

function RobotIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden>
      <rect x="4" y="7" width="16" height="12" rx="2" />
      <line x1="12" y1="2" x2="12" y2="7" />
      <circle cx="12" cy="2" r="1" fill="currentColor" />
      <circle cx="9" cy="12" r="1.2" fill="currentColor" />
      <circle cx="15" cy="12" r="1.2" fill="currentColor" />
      <line x1="9" y1="16" x2="15" y2="16" />
    </svg>
  );
}

function BioIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden>
      <path d="M7 3 C 17 7, 7 17, 17 21" />
      <path d="M17 3 C 7 7, 17 17, 7 21" />
    </svg>
  );
}
