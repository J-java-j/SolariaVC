export default function Hero() {
  return (
    <section id="top" className="relative isolate pt-32 pb-20 sm:pt-40 sm:pb-28 lg:pt-44 lg:pb-32 overflow-hidden">
      <div className="absolute inset-0 -z-10 grid-bg" aria-hidden />
      <NavChartBackdrop className="absolute inset-x-0 bottom-0 -z-10 h-[420px] w-full opacity-60" />
      <div
        className="absolute -top-32 left-1/2 -z-10 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-gradient-to-br from-moss-500/20 via-moss-700/10 to-transparent blur-3xl"
        aria-hidden
      />

      <div className="container-x relative">
        <div className="max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-moss-400 animate-pulse" />
            <span className="label !text-white/65">Q2 2026 · Subscriptions open</span>
          </div>

          <h1 className="mt-7 font-display text-5xl font-semibold leading-[1.04] tracking-tight sm:text-6xl lg:text-[5.5rem]">
            Quantitative conviction <br className="hidden sm:block" />
            for the <span className="text-gradient-moss">next era of capital.</span>
          </h1>

          <p className="mt-7 max-w-2xl text-lg leading-relaxed text-white/70 sm:text-xl">
            Solaria is an investment firm built around two products: <span className="text-white">the Medallion Fund</span>,
            a closed-end portfolio running systematic strategies — and <span className="text-white">Solaria Research</span>,
            applying quantitative models to venture and private markets.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <a
              href="#fund"
              className="inline-flex items-center gap-2 rounded-md bg-moss-500 px-5 py-3 text-sm font-semibold text-ink-950 hover:bg-moss-400 transition-colors glow-moss"
            >
              View the Fund
              <span aria-hidden>→</span>
            </a>
            <a
              href="#research"
              className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white/90 hover:bg-white/[0.06] hover:border-white/25 transition-colors"
            >
              Read the research
            </a>
          </div>

          <dl className="mt-16 grid max-w-3xl grid-cols-2 gap-x-10 gap-y-6 sm:grid-cols-4">
            <Stat label="Fund vintage" value="2026" />
            <Stat label="Target NAV" value="$2.5M" />
            <Stat label="Strategies" value="04" />
            <Stat label="Research notes" value="12+" />
          </dl>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l border-white/10 pl-4">
      <dt className="label">{label}</dt>
      <dd className="num mt-1.5 text-2xl text-white sm:text-3xl">{value}</dd>
    </div>
  );
}

function NavChartBackdrop({ className = '' }: { className?: string }) {
  // Generate a smooth, generally-up-and-to-the-right curve in SVG path form.
  const points = generateSeries(64);
  const path = pathFromPoints(points, 1200, 380, 8);
  const area = `${path} L 1200 380 L 0 380 Z`;
  return (
    <svg viewBox="0 0 1200 380" preserveAspectRatio="none" className={className} aria-hidden>
      <defs>
        <linearGradient id="navarea" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="navline" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.3" />
          <stop offset="50%" stopColor="#34d399" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#a7f3d0" stopOpacity="1" />
        </linearGradient>
      </defs>
      {/* horizontal grid */}
      {[0.25, 0.5, 0.75].map((y) => (
        <line key={y} x1="0" x2="1200" y1={380 * y} y2={380 * y} stroke="#34d39920" strokeDasharray="2 6" />
      ))}
      <path d={area} fill="url(#navarea)" />
      <path
        d={path}
        fill="none"
        stroke="url(#navline)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="3500"
        strokeDashoffset="3500"
        className="animate-draw"
      />
    </svg>
  );
}

function generateSeries(n: number): number[] {
  // deterministic-ish gentle uptrend with noise; runs at module load
  const out: number[] = [];
  let v = 0.55;
  for (let i = 0; i < n; i++) {
    const drift = 0.006;
    const wobble = Math.sin(i * 0.45) * 0.04 + Math.sin(i * 0.13) * 0.025;
    const shock = i === 18 || i === 41 ? -0.06 : 0;
    v = Math.max(0.15, Math.min(0.95, v + drift + wobble * 0.4 + shock));
    out.push(v);
  }
  return out;
}

function pathFromPoints(values: number[], w: number, h: number, padTop: number): string {
  const n = values.length;
  const stepX = w / (n - 1);
  const usableH = h - padTop;
  const ys = values.map((v) => padTop + (1 - v) * usableH);
  let d = `M 0 ${ys[0].toFixed(1)}`;
  for (let i = 1; i < n; i++) {
    const x0 = (i - 1) * stepX;
    const x1 = i * stepX;
    const cpx0 = x0 + stepX / 2;
    const cpx1 = x1 - stepX / 2;
    d += ` C ${cpx0.toFixed(1)} ${ys[i - 1].toFixed(1)}, ${cpx1.toFixed(1)} ${ys[i].toFixed(1)}, ${x1.toFixed(1)} ${ys[i].toFixed(1)}`;
  }
  return d;
}
