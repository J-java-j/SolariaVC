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
  const [ref, shown] = useInView<HTMLDivElement>({ threshold: 0.35 });

  return (
    <div
      ref={ref}
      className={`relative px-5 py-24 sm:py-32 lg:py-40 ${
        isLast ? '' : 'border-b border-white/[0.05]'
      }`}
    >
      <div className="container-x">
        <div className="flex items-center justify-between mb-8 sm:mb-10">
          <span className="num text-[10px] uppercase tracking-[0.24em] text-moss-300/70 sm:text-[11px]">
            ─  Backtest
          </span>
          <span className="num text-[10px] uppercase tracking-[0.24em] text-white/30 sm:text-[11px]">
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
          <div
            className="num font-display font-medium tracking-[-0.04em] text-gradient-moss"
            style={{
              fontSize: 'clamp(2.5rem, 12vw, 9rem)',
              lineHeight: 1.05,
              paddingTop: '0.18em',
              paddingBottom: '0.1em',
            }}
          >
            <AnimatedNumber
              value={scene.value}
              prefix={scene.prefix}
              suffix={scene.suffix}
              decimals={scene.decimals}
              duration={1600}
            />
          </div>
          <div
            className="mt-3 text-base text-white/65 sm:mt-5 sm:text-lg"
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
