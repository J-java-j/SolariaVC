export default function Hero() {
  return (
    <section id="top" className="relative isolate pt-32 pb-24 sm:pt-40 sm:pb-32 lg:pt-48 lg:pb-40">
      <div className="absolute inset-0 -z-10 grid-bg" aria-hidden />
      <div
        className="absolute left-1/2 top-[18%] -z-10 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-gradient-to-br from-sun-300/20 via-sun-500/10 to-transparent blur-3xl animate-pulse-slow"
        aria-hidden
      />
      <SunDisc className="absolute left-1/2 top-12 -z-10 h-[460px] w-[460px] -translate-x-1/2 opacity-90" />

      <div className="container-x relative">
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-white/70">
            <span className="h-1.5 w-1.5 rounded-full bg-sun-400 animate-pulse" />
            Now investing — Cohort 01
          </div>
          <h1 className="mt-8 font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            Backing the founders <br className="hidden sm:block" />
            <span className="text-gradient-sun">building what's next.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/70 sm:text-xl">
            Solaria VC is a student-led venture club and LLC investing at the frontier —
            partnering with technical founders building durable companies in AI, energy, and the next computing platform.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#apply"
              className="inline-flex items-center gap-2 rounded-full bg-sun-500 px-6 py-3 text-sm font-semibold text-ink-950 hover:bg-sun-400 transition-colors glow-sun"
            >
              Pitch us
              <span aria-hidden>→</span>
            </a>
            <a
              href="#thesis"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-6 py-3 text-sm font-medium text-white/90 hover:bg-white/[0.06] hover:border-white/25 transition-colors"
            >
              Read the thesis
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function SunDisc({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 600" className={className} aria-hidden>
      <defs>
        <radialGradient id="sundisc" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff0c4" stopOpacity="1" />
          <stop offset="40%" stopColor="#ffb947" stopOpacity="0.9" />
          <stop offset="75%" stopColor="#f57f0c" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#762f10" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="suncore" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff8eb" />
          <stop offset="60%" stopColor="#ffd485" />
          <stop offset="100%" stopColor="#f57f0c" />
        </radialGradient>
      </defs>
      <circle cx="300" cy="300" r="280" fill="url(#sundisc)" />
      <circle cx="300" cy="300" r="120" fill="url(#suncore)" />
      <g className="animate-spin-slow" style={{ transformOrigin: '300px 300px' }}>
        {Array.from({ length: 36 }).map((_, i) => {
          const angle = (i * 360) / 36;
          return (
            <line
              key={i}
              x1="300"
              y1="60"
              x2="300"
              y2="100"
              stroke="#ffd485"
              strokeOpacity={i % 3 === 0 ? 0.6 : 0.25}
              strokeWidth="1.2"
              strokeLinecap="round"
              transform={`rotate(${angle} 300 300)`}
            />
          );
        })}
      </g>
    </svg>
  );
}
