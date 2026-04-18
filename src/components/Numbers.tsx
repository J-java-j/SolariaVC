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
};

const scenes: Scene[] = [
  { n: 1, value: BACKTEST_STATS.cagrPct,        suffix: '%',           decimals: 2, label: 'Annualised return' },
  { n: 2, value: BACKTEST_STATS.totalReturnPct, prefix: '+', suffix: '%', decimals: 0, label: 'Total return' },
  { n: 3, value: BACKTEST_STATS.sharpe,                                  decimals: 2, label: 'Sharpe ratio' },
];

export default function Numbers() {
  return (
    <section className="relative">
      {scenes.map((scene, i) => (
        <Scene
          key={scene.n}
          scene={scene}
          total={scenes.length}
          isLast={i === scenes.length - 1}
        />
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
  const [ref, shown] = useInView<HTMLDivElement>({ threshold: 0.3 });

  return (
    <div
      ref={ref}
      className={`relative px-5 py-20 sm:py-28 lg:py-36 ${
        isLast ? '' : 'border-b border-white/[0.05]'
      }`}
    >
      <div className="container-x">
        <div className="mb-6 flex items-center justify-between sm:mb-10">
          <span className="num text-[10px] font-medium uppercase tracking-[0.24em] text-moss-300/70 sm:text-[11px]">
            ─  Backtest
          </span>
          <span className="num text-[10px] font-medium uppercase tracking-[0.24em] text-white/30 sm:text-[11px]">
            {String(scene.n).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </span>
        </div>

        <div
          className="text-center transition-all duration-[800ms] ease-out"
          style={{
            opacity: shown ? 1 : 0,
            transform: shown ? 'translateY(0)' : 'translateY(20px)',
          }}
        >
          <div className="num font-display font-medium leading-[1.05] tracking-[-0.04em] text-gradient-moss text-4xl sm:text-6xl md:text-7xl lg:text-8xl py-2">
            <AnimatedNumber
              value={scene.value}
              prefix={scene.prefix}
              suffix={scene.suffix}
              decimals={scene.decimals}
              duration={1600}
            />
          </div>
          <div
            className="mt-3 text-sm font-medium uppercase tracking-[0.2em] text-white/55 sm:mt-5 sm:text-xs"
            style={{
              opacity: shown ? 1 : 0,
              transform: shown ? 'translateY(0)' : 'translateY(8px)',
              transition: 'all 600ms ease-out 350ms',
            }}
          >
            {scene.label}
          </div>
        </div>
      </div>
    </div>
  );
}
