const stats = [
  { k: '$250K', v: 'Inaugural fund' },
  { k: '12', v: 'Investing members' },
  { k: '4', v: 'Sectors of focus' },
  { k: '24h', v: 'First-meeting promise' },
];

export default function About() {
  return (
    <section id="about" className="relative py-28 sm:py-36">
      <div className="container-x">
        <div className="grid gap-16 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <SectionLabel>About</SectionLabel>
            <h2 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              A new kind of venture club.
            </h2>
          </div>
          <div className="lg:col-span-7 space-y-6 text-lg leading-relaxed text-white/75">
            <p>
              Solaria VC is a student-run venture club and registered LLC. We operate like a fund —
              with a real check-writing entity, real conviction, and a real bias for action.
            </p>
            <p>
              Our members come from engineering, design, business, and the sciences. We meet weekly,
              source from our networks, and write our own memos. We don't ask founders for warm intros —
              we earn ours.
            </p>
            <p className="text-white/60">
              We exist to give the next generation of investors a seat at the table — and to give the next
              generation of founders a partner who understands their ambition.
            </p>
          </div>
        </div>

        <div className="mt-20 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] sm:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.v}
              className="bg-ink-900/60 p-6 sm:p-8 transition-colors hover:bg-ink-800/80"
            >
              <div className="font-display text-3xl text-gradient-sun sm:text-4xl">{s.k}</div>
              <div className="mt-2 text-sm text-white/55">{s.v}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-sun-300/90">
      <span className="h-px w-6 bg-sun-400/60" />
      {children}
    </div>
  );
}
