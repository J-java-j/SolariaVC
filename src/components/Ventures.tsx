import { useReveal } from '../hooks/useReveal';
import { Eyebrow, SectionTitle } from './primitives';

const companies = [
  { name: 'Helios Compute',  sector: 'AI Infra',     stage: 'Seed',     desc: 'Distributed inference infra for foundation models at the edge.',          metric: '3.2x' },
  { name: 'Penumbra AI',     sector: 'AI Infra',     stage: 'Pre-seed', desc: 'Runtime for autonomous research agents that ship production code.',       metric: '2.1x' },
  { name: 'Coronal Energy',  sector: 'Energy',       stage: 'Seed',     desc: 'Long-duration grid-scale storage on iron-air chemistry.',                 metric: '1.8x' },
  { name: 'Aphelion Bio',    sector: 'Bio×Compute',  stage: 'Pre-seed', desc: 'Programmable diagnostics from a single drop of blood.',                   metric: '1.4x' },
  { name: 'Forgework',       sector: 'Robotics',     stage: 'Seed',     desc: 'Vertically-integrated robotic manufacturing for precision parts.',        metric: '2.6x' },
  { name: 'Umbra Data',      sector: 'Data',         stage: 'Seed',     desc: 'Alternative data marketplace for institutional quant researchers.',       metric: '1.9x' },
];

export default function Ventures() {
  const [revealRef, inView] = useReveal(0.1);
  return (
    <section id="ventures" className="relative border-t border-line">
      <div className="mx-auto max-w-[1400px] px-5 py-20 sm:px-10 sm:py-32 lg:px-16 lg:py-40">
        <div
          ref={revealRef}
          className={`max-w-3xl transition-all duration-1000 ${
            inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <Eyebrow>Solaria Ventures</Eyebrow>
          <SectionTitle className="mt-5">
            Pre-seed and seed,
            <br />
            <span className="text-accent italic font-light">scored by the models.</span>
          </SectionTitle>
          <p className="mt-5 sm:mt-6 max-w-2xl text-[15.5px] sm:text-[17px] leading-relaxed text-fg-muted">
            First checks into technical founders across AI, energy, bio, robotics, and defense. Sourced
            through our network, scored by the SR-026 factor model, underwritten by the partners.
          </p>
        </div>

        <div className="mt-10 sm:mt-14 grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map((c, i) => {
            const init = c.name.split(' ').map((p) => p[0]).slice(0, 2).join('');
            return (
              <article
                key={c.name}
                className="group relative rounded-2xl border border-line bg-fg-b p-6 transition-all duration-300 hover:border-line-strong hover:-translate-y-1 hover:bg-fg-c"
                style={{ animation: inView ? `rise .8s ease-out ${i * 80}ms both` : 'none' }}
              >
                <div className="flex items-start justify-between">
                  <div className="grid h-11 w-11 place-items-center rounded-lg bg-[rgba(var(--accent-rgb),0.10)] ring-1 ring-[rgba(var(--accent-rgb),0.25)] font-display text-[14px] text-accent">
                    {init}
                  </div>
                  <div className="text-right">
                    <div className="font-display text-[1.2rem] tabular-nums font-semibold text-accent-strong">
                      {c.metric}
                    </div>
                    <div className="font-mono text-[9.5px] tracking-[0.2em] uppercase text-fg-faint">TVPI</div>
                  </div>
                </div>
                <div className="mt-5">
                  <div className="font-display text-[1.1rem] text-fg">{c.name}</div>
                  <div className="mt-1 font-mono text-[10.5px] tracking-[0.14em] uppercase text-fg-faint">
                    {c.sector} · {c.stage}
                  </div>
                </div>
                <p className="mt-4 text-[13.5px] leading-relaxed text-fg-muted">{c.desc}</p>
              </article>
            );
          })}
        </div>

        <div className="mt-10 sm:mt-12 flex flex-wrap items-center justify-between gap-6 rounded-xl border border-line bg-fg-b px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-[13px] text-fg-muted">
            <span><span className="font-mono text-accent-strong tabular-nums text-[15px]">8</span> active</span>
            <span><span className="font-mono text-accent-strong tabular-nums text-[15px]">5</span> sectors</span>
            <span><span className="font-mono text-accent-strong tabular-nums text-[15px]">$13K</span> deployed</span>
            <span><span className="font-mono text-accent-strong tabular-nums text-[15px]">2.3x</span> blended TVPI</span>
          </div>
          <a
            href="#contact"
            className="group inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-[12.5px] font-semibold hover:opacity-90 transition-all"
          >
            Pitch the Ventures team{' '}
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </a>
        </div>
      </div>
    </section>
  );
}
