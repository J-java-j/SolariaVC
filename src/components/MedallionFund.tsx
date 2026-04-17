const allocation = [
  { strategy: 'Statistical Arbitrage', weight: 32, color: '#34d399' },
  { strategy: 'Equity Momentum', weight: 24, color: '#10b981' },
  { strategy: 'Volatility Carry', weight: 18, color: '#059669' },
  { strategy: 'Frontier Venture', weight: 26, color: '#047857' },
];

const terms = [
  { k: 'Structure', v: 'Closed-end LLC' },
  { k: 'Vintage', v: '2026' },
  { k: 'Min. commitment', v: '$25,000' },
  { k: 'Lock-up', v: '24 months' },
  { k: 'Mgmt / Perf', v: '1.5 / 20' },
  { k: 'Domicile', v: 'Delaware, USA' },
];

export default function MedallionFund() {
  return (
    <section id="fund" className="relative py-28 sm:py-36 border-t border-white/[0.06]">
      <div className="absolute inset-0 -z-10 dot-bg opacity-50" aria-hidden />
      <div className="container-x">
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-5">
            <div className="label">The Medallion Fund</div>
            <h2 className="mt-4 font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
              A closed-end portfolio, run on systematic conviction.
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-white/70">
              The Medallion Fund deploys capital across four uncorrelated strategies — three quantitative,
              one frontier-venture. Closed-end means we raise once, invest with patience, and report with
              discipline. No mark-to-narrative.
            </p>

            <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
              {terms.map((t) => (
                <div key={t.k} className="bg-ink-900/60 px-5 py-4">
                  <div className="label !text-white/40 !text-[10px]">{t.k}</div>
                  <div className="num mt-1.5 text-white">{t.v}</div>
                </div>
              ))}
            </div>

            <a
              href="#contact"
              className="mt-10 inline-flex items-center gap-2 rounded-md bg-moss-500 px-5 py-3 text-sm font-semibold text-ink-950 hover:bg-moss-400 transition-colors glow-moss"
            >
              Request the prospectus
              <span aria-hidden>→</span>
            </a>
          </div>

          <div className="lg:col-span-7">
            <NavCard />
            <AllocationCard />
          </div>
        </div>
      </div>
    </section>
  );
}

function NavCard() {
  return (
    <div className="rounded-2xl border border-white/10 bg-ink-900/50 p-6 sm:p-8 hairline">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="label">Net Asset Value · Indicative</div>
          <div className="mt-2 flex items-baseline gap-3">
            <div className="num text-4xl text-white sm:text-5xl">102.74</div>
            <div className="num text-sm text-moss-300">+2.74% YTD</div>
          </div>
          <div className="mt-1 text-xs text-white/40">Base 100 at inception · Q1 2026</div>
        </div>
        <div className="flex gap-1.5 text-[11px]">
          {['1M', '3M', 'YTD', '1Y', 'ITD'].map((t, i) => (
            <span
              key={t}
              className={`rounded px-2 py-1 ${
                i === 2
                  ? 'bg-moss-500/15 text-moss-200 ring-1 ring-moss-500/30'
                  : 'text-white/45 hover:text-white/70'
              }`}
            >
              {t}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-6">
        <NavLine />
      </div>
    </div>
  );
}

function AllocationCard() {
  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-ink-900/50 p-6 sm:p-8">
      <div className="label">Strategy Allocation</div>
      <div className="mt-5 space-y-4">
        {allocation.map((a) => (
          <div key={a.strategy}>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2.5 text-white/85">
                <span className="h-2 w-2 rounded-sm" style={{ background: a.color }} />
                {a.strategy}
              </span>
              <span className="num text-white/65">{a.weight}%</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
              <div
                className="h-full rounded-full"
                style={{ width: `${a.weight}%`, background: `linear-gradient(90deg, ${a.color}aa, ${a.color})` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NavLine() {
  const series = generate(120);
  const benchmark = generateBenchmark(120, series);
  const w = 760;
  const h = 200;
  const padTop = 12;
  const padBottom = 8;

  const fundPath = pathFromSeries(series, w, h, padTop, padBottom);
  const benchPath = pathFromSeries(benchmark, w, h, padTop, padBottom);
  const last = series[series.length - 1];
  const lastY = padTop + (1 - last) * (h - padTop - padBottom);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="fundarea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="fundline" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.5" />
            <stop offset="80%" stopColor="#34d399" stopOpacity="1" />
            <stop offset="100%" stopColor="#a7f3d0" stopOpacity="1" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((y) => (
          <line
            key={y}
            x1="0"
            x2={w}
            y1={padTop + (h - padTop - padBottom) * y}
            y2={padTop + (h - padTop - padBottom) * y}
            stroke="#34d39922"
            strokeDasharray="2 5"
          />
        ))}
        <path d={`${fundPath} L ${w} ${h} L 0 ${h} Z`} fill="url(#fundarea)" />
        <path
          d={benchPath}
          fill="none"
          stroke="#ffffff30"
          strokeWidth="1.2"
          strokeDasharray="3 4"
          strokeLinecap="round"
        />
        <path
          d={fundPath}
          fill="none"
          stroke="url(#fundline)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={w} cy={lastY} r="4" fill="#34d399" />
        <circle cx={w} cy={lastY} r="9" fill="#34d399" opacity="0.18" />
      </svg>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
        <Legend swatch={<span className="inline-block h-1 w-3 rounded bg-moss-400" />} label="Medallion Fund" />
        <Legend swatch={<span className="inline-block h-px w-3 border-t border-dashed border-white/40" />} label="Benchmark · 60/40" />
        <span className="ml-auto text-white/40">Sharpe 2.14 · Vol 8.6 · MaxDD −3.1%</span>
      </div>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-white/65">
      {swatch} {label}
    </span>
  );
}

function generate(n: number): number[] {
  const out: number[] = [];
  let v = 0.5;
  for (let i = 0; i < n; i++) {
    const drift = 0.0035;
    const wobble = Math.sin(i * 0.42) * 0.03 + Math.sin(i * 0.17) * 0.018;
    const shock = i === 32 || i === 71 ? -0.04 : 0;
    v = Math.max(0.18, Math.min(0.95, v + drift + wobble * 0.4 + shock));
    out.push(v);
  }
  return out;
}

function generateBenchmark(n: number, fund: number[]): number[] {
  const out: number[] = [];
  let v = 0.5;
  for (let i = 0; i < n; i++) {
    const drift = 0.0014;
    const wobble = Math.sin(i * 0.31) * 0.02;
    v = Math.max(0.2, Math.min(0.85, v + drift + wobble * 0.3));
    out.push(Math.min(v, fund[i] - 0.02));
  }
  return out;
}

function pathFromSeries(values: number[], w: number, h: number, padTop: number, padBottom: number): string {
  const n = values.length;
  const stepX = w / (n - 1);
  const usableH = h - padTop - padBottom;
  const ys = values.map((v) => padTop + (1 - v) * usableH);
  let d = `M 0 ${ys[0].toFixed(2)}`;
  for (let i = 1; i < n; i++) {
    const x0 = (i - 1) * stepX;
    const x1 = i * stepX;
    const cpx0 = x0 + stepX / 2;
    const cpx1 = x1 - stepX / 2;
    d += ` C ${cpx0.toFixed(2)} ${ys[i - 1].toFixed(2)}, ${cpx1.toFixed(2)} ${ys[i].toFixed(2)}, ${x1.toFixed(2)} ${ys[i].toFixed(2)}`;
  }
  return d;
}
