import { useReveal } from '../hooks/useReveal';

export default function Quote() {
  const [ref, seen] = useReveal(0.4);
  return (
    <section className="relative">
      <div
        ref={ref}
        className="mx-auto max-w-[1320px] px-6 py-44 sm:px-10 sm:py-56 lg:px-14 lg:py-64 text-center"
      >
        <div className="font-mono text-[10px] tracking-[0.28em] uppercase text-[var(--moss)]">
          Our prior
        </div>
        <p
          className="editorial-h mx-auto mt-10 max-w-[20ch] text-[2.6rem] sm:text-[4.2rem] lg:text-[5.6rem] leading-[1.04]"
          style={{
            opacity: seen ? 1 : 0,
            transform: seen ? 'translateY(0)' : 'translateY(28px)',
            transition:
              'opacity 1.4s cubic-bezier(0.22,1,0.36,1), transform 1.4s cubic-bezier(0.22,1,0.36,1)',
          }}
        >
          Time, compounded, <span style={{ color: 'var(--moss)' }}>is the only edge.</span>
        </p>
      </div>
      <div className="mx-auto max-w-[1320px] px-6 sm:px-10 lg:px-14">
        <div className="rule" />
      </div>
    </section>
  );
}
