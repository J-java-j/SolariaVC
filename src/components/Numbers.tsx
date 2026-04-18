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
  { n: 1, value: BACKTEST_STATS.cagrPct,         suffix: '%',          decimals: 2, label: 'Annualised return' },
  { n: 2, value: BACKTEST_STATS.totalReturnPct,  prefix: '+', suffix: '%', decimals: 0, label: 'Total return' },
  { n: 3, value: BACKTEST_STATS.sharpe,                                 decimals: 2, label: 'Sharpe ratio' },
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
  const [ref, shown] = useInView<HTMLDivElement>({ threshold: 0.4 });

  return (
    <div
      ref={ref}
      className={`relative flex min-h-[60svh] items-center justify-center px-4 sm:min-h-[78vh] sm:px-6 ${
        isLast ? '' : 'border-b border-white/[0.05]'
      }`}
    >
      <div className="absolute right-4 top-5 num text-[10px] uppercase tracking-[0.22em] text-white/30 sm:right-12 sm:top-12 sm:text-[11px] sm:tracking-[0.24em]">
        {String(scene.n).padStart(2, '0')} / {String(total).padStart(2, '0')}
      </div>

      <div
        className="w-full text-center transition-all duration-[900ms] ease-out"
        style={{
          opacity: shown ? 1 : 0,
          transform: shown ? 'translateY(0) scale(1)' : 'translateY(28px) scale(0.96)',
        }}
      >
        <div
          className="num font-display font-medium tracking-[-0.04em] text-gradient-moss"
          style={{
            // tighter clamp so even "+1,520%" fits comfortably on a 320px viewport
            fontSize: 'clamp(2.5rem, 13vw, 10rem)',
            lineHeight: 1.05,
            paddingTop: '0.22em',
            paddingBottom: '0.12em',
          }}
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
          className="mt-4 text-base text-white/70 sm:mt-8 sm:text-xl"
          style={{
            opacity: shown ? 1 : 0,
            transform: shown ? 'translateY(0)' : 'translateY(12px)',
            transition: 'all 700ms ease-out 400ms',
          }}
        >
          {scene.label}
        </div>
      </div>
    </div>
  );
}
