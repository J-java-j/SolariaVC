import { useReveal } from '../hooks/useReveal';
import { Eyebrow } from './primitives';

export default function Ventures() {
  const [ref, inView] = useReveal(0.1);
  return (
    <section id="ventures" className="relative">
      <div
        ref={ref}
        className={`mx-auto max-w-[1320px] px-6 py-32 sm:px-10 sm:py-44 lg:px-14 lg:py-56 transition-all duration-1000 ${
          inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <Eyebrow num="§ 03">Ventures</Eyebrow>
        <div className="mt-16 sm:mt-24 grid items-baseline gap-10 lg:grid-cols-12 lg:gap-20">
          <h2 className="editorial-h lg:col-span-7 text-[2.6rem] sm:text-[4.2rem] lg:text-[5.4rem] leading-[1.02]">
            Coming
            <br />
            <span style={{ color: 'var(--moss)' }}>soon.</span>
          </h2>
          <div className="flex items-center gap-3 lg:col-span-5">
            <span className="live-dot" />
            <span className="font-mono text-[10.5px] tracking-[0.22em] uppercase text-[var(--ink-faint)]">
              Vintage 2026 · First checks soon
            </span>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-[1320px] px-6 sm:px-10 lg:px-14">
        <div className="rule" />
      </div>
    </section>
  );
}
