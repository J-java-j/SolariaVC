import AnimatedNumber from './AnimatedNumber';
import { useInView } from '../hooks/useInView';
import { BACKTEST_STATS } from '../lib/fundData';

type Scene = {
  n: number;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  label: string;
  context: string;
};

const scenes: Scene[] = [
  {
    n: 1,
    value: BACKTEST_STATS.cagrPct,
    suffix: '%',
    decimals: 2,
    label: 'Annualised return',
    context: 'Across fourteen years of backtest.',
  },
  {
    n: 2,
    value: BACKTEST_STATS.totalReturnPct,
    prefix: '+',
    suffix: '%',
    decimals: 0,
    label: 'Total return',
    context: 'A dollar in 2012 is sixteen today.',
  },
  {
    n: 3,
    value: BACKTEST_STATS.sharpe,
    decimals: 2,
    label: 'Sharpe ratio',
    context: 'Returns above the noise.',
  },
];

export default function Numbers() {
  return (
    <section className="relative">
      {scenes.map((scene, i) => (
        <Scene key={scene.n} scene={scene} total={scenes.length} isLast={i === scenes.length - 1} />
      ))}
    </section>
  );
}

function Scene({
  scene,
  total,
  isLast,
}: {
  scene: Scene;
  total: number;
  isLast: boolean;
}) {
  const [ref, shown] = useInView<HTMLDivElement>({ threshold: 0.45 });

  return (
    <div
      ref={ref}
      className={`relative flex min-h-[78vh] items-center justify-center px-6 ${
        isLast ? '' : 'border-b border-white/[0.05]'
      }`}
    >
      {/* index counter top-right */}
      <div className="absolute right-6 top-8 sm:right-12 sm:top-12 num text-[11px] uppercase tracking-[0.24em] text-white/30">
        {String(scene.n).padStart(2, '0')} / {String(total).padStart(2, '0')}
      </div>

      {/* small "BACKTEST" stamp top-left */}
      <div className="absolute left-6 top-8 sm:left-12 sm:top-12 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-moss-300/70">
        <span className="h-px w-6 bg-moss-500/50" />
        Backtest
      </div>

      <div
        className="text-center transition-all duration-[900ms] ease-out"
        style={{
          opacity: shown ? 1 : 0,
          transform: shown ? 'translateY(0) scale(1)' : 'translateY(28px) scale(0.96)',
        }}
      >
        <div
          className="num font-display font-medium leading-[0.9] tracking-[-0.04em] text-gradient-moss"
          style={{ fontSize: 'clamp(4.5rem, 16vw, 12rem)' }}
        >
          <AnimatedNumber
            value={scene.value}
            prefix={scene.prefix}
            suffix={scene.suffix}
            decimals={scene.decimals}
            duration={1800}
          />
        </div>
        <div
          className="mt-6 sm:mt-10 font-display text-xl text-white/85 sm:text-2xl"
          style={{
            opacity: shown ? 1 : 0,
            transform: shown ? 'translateY(0)' : 'translateY(12px)',
            transition: 'all 700ms ease-out 400ms',
          }}
        >
          {scene.label}
        </div>
        <div
          className="mt-2 text-sm text-white/45 max-w-md mx-auto"
          style={{
            opacity: shown ? 1 : 0,
            transform: shown ? 'translateY(0)' : 'translateY(8px)',
            transition: 'all 700ms ease-out 600ms',
          }}
        >
          {scene.context}
        </div>
      </div>
    </div>
  );
}
