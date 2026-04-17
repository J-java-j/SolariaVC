import { useEffect, useRef, useState } from 'react';
import Spotlight from './Spotlight';

const pillars = [
  {
    n: '01',
    title: 'Systematic, not narrative.',
    body:
      'Decisions follow models. Models follow data. We document our priors and update them in writing — public and private alike. Every position has a written thesis with a falsification condition.',
    detail: 'Each strategy in the Medallion Fund is rules-defined and back-tested out-of-sample on a 6-year hold-out period before a single dollar is committed.',
  },
  {
    n: '02',
    title: 'Closed-end discipline.',
    body:
      'A finite vintage and a long lock-up let us underwrite for outcomes, not for marks. Patient capital, mechanically deployed.',
    detail: 'We raise once per vintage, deploy on a glide path, and report quarterly. No subscriptions mid-vintage, no redemptions until the lock-up closes.',
  },
  {
    n: '03',
    title: 'Research as product.',
    body:
      'Every position has a published thesis. Every back-test has a published method. The portfolio is the most honest form of the research.',
    detail: 'Solaria Research publishes every quarter. Open methodology, open code where possible, and full disclosure of the priors that drove a position.',
  },
];

export default function Approach() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const pillarRefs = useRef<(HTMLElement | null)[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const els = pillarRefs.current.filter(Boolean) as HTMLElement[];
    if (els.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        // pick the most-visible entry
        let bestIdx = -1;
        let bestRatio = -1;
        for (const e of entries) {
          const idx = els.indexOf(e.target as HTMLElement);
          if (idx === -1) continue;
          if (e.intersectionRatio > bestRatio) {
            bestRatio = e.intersectionRatio;
            bestIdx = idx;
          }
        }
        if (bestIdx >= 0 && bestRatio > 0.25) setActiveIdx(bestIdx);
      },
      { threshold: [0.25, 0.55, 0.85], rootMargin: '-20% 0px -30% 0px' }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <section
      id="approach"
      ref={sectionRef}
      className="relative border-t border-white/[0.06] py-28 sm:py-36"
    >
      <div className="container-x">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          {/* sticky left rail */}
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-28">
              <div className="label">Approach</div>
              <h2 className="mt-4 font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
                How we underwrite.
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-white/70">
                Three principles, applied without exception. They guide every position the
                Fund takes and every note the Research desk publishes.
              </p>

              {/* progress rail with active highlight */}
              <ol className="mt-10 space-y-3.5">
                {pillars.map((p, i) => {
                  const active = i === activeIdx;
                  return (
                    <li key={p.n} className="flex items-start gap-3">
                      <div
                        className={`mt-2 h-px transition-all duration-500 ${
                          active ? 'w-10 bg-moss-400' : 'w-5 bg-white/15'
                        }`}
                      />
                      <div>
                        <div
                          className={`num text-[11px] tracking-[0.18em] transition-colors ${
                            active ? 'text-moss-300' : 'text-white/35'
                          }`}
                        >
                          {p.n}
                        </div>
                        <div
                          className={`text-sm transition-colors ${
                            active ? 'text-white' : 'text-white/45'
                          }`}
                        >
                          {p.title.replace('.', '')}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>

          {/* scrolling pillar cards */}
          <div className="lg:col-span-7">
            <div className="space-y-8 lg:space-y-16">
              {pillars.map((p, i) => (
                <PillarCard
                  key={p.n}
                  setRef={(el) => {
                    pillarRefs.current[i] = el;
                  }}
                  pillar={p}
                  active={i === activeIdx}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const PillarCard = ({
  setRef,
  pillar,
  active,
}: {
  setRef: (el: HTMLElement | null) => void;
  pillar: (typeof pillars)[number];
  active: boolean;
}) => {
  return (
    <Spotlight intensity={0.14} className="rounded-2xl">
      <article
        ref={setRef}
        className={`relative rounded-2xl border bg-ink-900/50 p-7 sm:p-10 transition-all duration-500 ${
          active
            ? 'border-moss-500/40 bg-ink-900/70 translate-y-0'
            : 'border-white/10 hover:border-white/25'
        }`}
      >
        <div className="flex items-baseline gap-5">
          <div
            className={`num text-sm transition-colors ${
              active ? 'text-moss-300' : 'text-moss-300/50'
            }`}
          >
            {pillar.n}
          </div>
          <div className="flex-1">
            <h3 className="font-display text-2xl leading-tight tracking-tight sm:text-3xl">
              {pillar.title}
            </h3>
            <p className="mt-4 max-w-2xl text-white/70 leading-relaxed">{pillar.body}</p>
            <div className="mt-6 border-l-2 border-moss-500/30 pl-4 text-sm text-white/55 italic">
              {pillar.detail}
            </div>
          </div>
        </div>
      </article>
    </Spotlight>
  );
};
