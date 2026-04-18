import Reveal from './Reveal';

type Step = {
  n: string;
  label: string;
  title: string;
  detail: string;
};

const steps: Step[] = [
  {
    n: '01',
    label: 'Universe',
    title: 'Liquid US equities',
    detail: 'Roughly 2,000 names that meet daily-volume and market-cap minimums. Updated monthly.',
  },
  {
    n: '02',
    label: 'Signals',
    title: 'Multi-factor score',
    detail: 'Each name scored across momentum, quality, value, and idiosyncratic-vol factors. Updated daily.',
  },
  {
    n: '03',
    label: 'Ranking',
    title: 'Top 6',
    detail: 'Names ranked by composite score. The model selects the top six. Tested 1–20; six was the Sharpe optimum.',
  },
  {
    n: '04',
    label: 'Portfolio',
    title: 'Equal weight',
    detail: 'Each of the six selections receives 16.6% of the book. No leverage, no derivatives, no shorting.',
  },
  {
    n: '05',
    label: 'Rebalance',
    title: 'Monthly',
    detail: 'Last trading day of each month. Tested daily / weekly / biweekly — monthly was best across every metric.',
  },
];

export default function HowItWorks() {
  return (
    <section
      id="strategy"
      className="relative border-t border-white/[0.06] py-24 sm:py-32"
    >
      <div className="container-x">
        <Reveal>
          <div className="max-w-2xl">
            <div className="text-[11px] uppercase tracking-[0.24em] text-moss-300/80">
              How the strategy works
            </div>
            <h2 className="mt-4 font-display text-3xl font-medium leading-tight tracking-tight sm:text-4xl">
              Five steps. No discretion.
            </h2>
            <p className="mt-5 text-white/65 leading-relaxed sm:text-lg">
              Every position the Fund takes is the output of the same deterministic
              pipeline. A name either ranks in the top six or it doesn't; if it
              doesn't, it isn't bought.
            </p>
          </div>
        </Reveal>

        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] sm:grid-cols-2 lg:grid-cols-5">
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={60 + i * 70}>
              <StepCard step={s} index={i} total={steps.length} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function StepCard({ step, index, total }: { step: Step; index: number; total: number }) {
  const isLast = index === total - 1;
  return (
    <div className="relative flex h-full flex-col bg-ink-900/55 p-6 transition-colors hover:bg-ink-800/80">
      <div className="flex items-center justify-between">
        <span className="num text-[11px] uppercase tracking-[0.22em] text-moss-300/80">
          {step.n}
        </span>
        {!isLast && (
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="hidden lg:block text-white/25"
            aria-hidden
          >
            <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      <div className="mt-3 text-[10.5px] uppercase tracking-[0.2em] text-white/45">
        {step.label}
      </div>
      <h3 className="mt-2 font-display text-lg text-white leading-snug">
        {step.title}
      </h3>
      <p className="mt-3 text-[12.5px] text-white/60 leading-relaxed">
        {step.detail}
      </p>
    </div>
  );
}
