import Reveal from './Reveal';

type Desk = {
  n: string;
  name: string;
  short: string;
  body: string;
  metric: { label: string; value: string };
  href: string;
  cta: string;
};

const desks: Desk[] = [
  {
    n: '01',
    name: 'Capital',
    short: 'The Medallion Fund',
    body: 'Closed-end quantitative portfolio. Four uncorrelated strategies — three quantitative, one frontier-venture — combined into a monthly-rebalanced book. Raise once per vintage, deploy patiently, report quarterly.',
    metric: { label: 'Backtest CAGR', value: '20.53%' },
    href: '#fund',
    cta: 'View the Fund',
  },
  {
    n: '02',
    name: 'Ventures',
    short: 'Solaria Ventures',
    body: 'Pre-seed and seed venture arm. Sourced through our network, scored by our models, underwritten by the partners. Concentrated, technical-founder-only, zero-coverage approach.',
    metric: { label: 'Companies tracked', value: '08' },
    href: '#ventures',
    cta: 'View the portfolio',
  },
  {
    n: '03',
    name: 'Research',
    short: 'Solaria Research',
    body: 'Quantitative research published openly. Factor models, market microstructure, alternative data, portfolio theory. The same models that drive the Fund and Ventures decisions are the ones we publish.',
    metric: { label: 'Notes published', value: '12' },
    href: '#research',
    cta: 'Read the notes',
  },
];

export default function ThreeDesks() {
  return (
    <section
      id="desks"
      className="relative border-t border-white/[0.06] py-16 sm:py-24 lg:py-32"
    >
      <div className="container-x">
        <Reveal>
          <div className="max-w-2xl">
            <div className="text-[11px] uppercase tracking-[0.24em] text-moss-300/80">
              The Firm
            </div>
            <h2 className="mt-4 font-display text-3xl font-medium leading-tight tracking-tight sm:text-4xl">
              Three desks under one roof.
            </h2>
            <p className="mt-5 text-white/65 leading-relaxed sm:text-lg">
              Solaria Capital is structured around three connected products. Capital
              deploys money. Ventures sources and scores private deals. Research
              builds and publishes the models that drive both.
            </p>
          </div>
        </Reveal>

        <div className="mt-14 grid gap-4 lg:grid-cols-3 lg:gap-6">
          {desks.map((d, i) => (
            <Reveal key={d.n} delay={80 + i * 80}>
              <DeskCard d={d} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function DeskCard({ d }: { d: Desk }) {
  return (
    <a
      href={d.href}
      className="group block h-full rounded-xl border border-white/[0.08] bg-ink-900/40 p-7 transition-all hover:border-moss-500/30 hover:bg-ink-900/70"
    >
      <div className="flex items-baseline justify-between">
        <span className="num text-[11px] uppercase tracking-[0.22em] text-moss-300/80">
          {d.n} · {d.name}
        </span>
      </div>

      <h3 className="mt-4 font-display text-2xl text-white leading-tight">
        {d.short}
      </h3>

      <p className="mt-4 text-sm text-white/65 leading-relaxed">{d.body}</p>

      <div className="mt-6 flex items-end justify-between gap-3 border-t border-white/[0.06] pt-5">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">
            {d.metric.label}
          </div>
          <div className="num mt-1 text-xl text-moss-300">{d.metric.value}</div>
        </div>
        <span className="text-[12px] text-white/55 transition-all group-hover:text-moss-200 group-hover:translate-x-0.5">
          {d.cta} <span aria-hidden>→</span>
        </span>
      </div>
    </a>
  );
}
