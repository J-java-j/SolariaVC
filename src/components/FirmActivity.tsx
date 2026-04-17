import Reveal from './Reveal';
import AnimatedNumber from './AnimatedNumber';

const items = [
  {
    n: 12,
    label: 'Research notes published',
    sub: 'YTD 2026',
    icon: NoteIcon,
  },
  {
    n: 8,
    label: 'Companies under coverage',
    sub: 'across 7 sectors',
    icon: GraphIcon,
  },
  {
    n: 4,
    label: 'Strategy back-tests live',
    sub: '6-yr hold-out window',
    icon: BeakerIcon,
  },
  {
    n: 5,
    label: 'Partner reviews this month',
    sub: 'last update 2 days ago',
    icon: PulseIcon,
  },
];

export default function FirmActivity() {
  return (
    <section className="relative border-t border-white/[0.06] py-14 sm:py-20">
      <div className="container-x">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="label">Firm Activity</div>
              <h3 className="mt-3 font-display text-2xl tracking-tight sm:text-3xl">
                The desks ship. The dashboard updates.
              </h3>
            </div>
            <div className="num inline-flex items-center gap-2 text-[11px] text-white/45">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-moss-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-moss-400" />
              </span>
              Updated continuously
            </div>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] sm:grid-cols-2 lg:grid-cols-4">
            {items.map(({ n, label, sub, icon: Icon }, i) => (
              <div
                key={label}
                className="group relative bg-ink-900/55 p-6 transition-colors hover:bg-ink-800/70"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="flex items-start justify-between">
                  <Icon className="h-5 w-5 text-moss-400" />
                  <span className="num text-[10px] uppercase tracking-[0.2em] text-white/30">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                <div className="num mt-5 text-4xl text-white">
                  <AnimatedNumber value={n} />
                </div>
                <div className="mt-2 text-sm text-white/75">{label}</div>
                <div className="num mt-1 text-[11px] text-white/40">{sub}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function NoteIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <line x1="8" y1="8" x2="16" y2="8" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="8" y1="16" x2="13" y2="16" />
    </svg>
  );
}

function GraphIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden>
      <path d="M4 19h16M4 19v-9M9 19v-5M14 19V8M19 19V4" strokeLinecap="round" />
    </svg>
  );
}

function BeakerIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden>
      <path d="M9 3v6L4 19a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-5-10V3" strokeLinejoin="round" />
      <line x1="8" y1="3" x2="16" y2="3" strokeLinecap="round" />
      <line x1="7" y1="14" x2="17" y2="14" />
    </svg>
  );
}

function PulseIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden>
      <path d="M3 12h4l3-7 4 14 3-7h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
