import { useRef } from 'react';
import { Eyebrow } from './primitives';
import { useScrollProgress } from '../hooks/useScrollProgress';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export default function Approach() {
  const ref = useRef<HTMLDivElement | null>(null);
  const p = useScrollProgress(ref);

  const opacities = [
    clamp01((p - 0.15) / 0.18),
    clamp01((p - 0.30) / 0.18),
    clamp01((p - 0.45) / 0.18),
  ];

  const lineStyle = (o: number): React.CSSProperties => ({
    opacity: o,
    transform: `translateY(${(1 - o) * 18}px)`,
    transition: 'transform 200ms linear',
  });

  return (
    <section id="approach" className="relative">
      <div
        ref={ref}
        className="mx-auto max-w-[1320px] px-6 py-44 sm:px-10 sm:py-56 lg:px-14 lg:py-64"
      >
        <Eyebrow num="§ 01">Approach</Eyebrow>
        <div className="mt-16 sm:mt-24 editorial-h text-[2.6rem] sm:text-[4.2rem] lg:text-[5.4rem] leading-[1.04] max-w-[20ch]">
          <div style={lineStyle(opacities[0])}>Models, not narratives.</div>
          <div style={{ ...lineStyle(opacities[1]), color: 'var(--ink-soft)' }}>
            Patient, not passive.
          </div>
          <div style={lineStyle(opacities[2])}>
            <span style={{ color: 'var(--moss)' }}>One desk. Two surfaces.</span>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-[1320px] px-6 sm:px-10 lg:px-14">
        <div className="rule" />
      </div>
    </section>
  );
}
