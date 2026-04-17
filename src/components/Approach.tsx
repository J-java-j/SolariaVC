const pillars = [
  {
    n: '01',
    title: 'Systematic, not narrative.',
    body:
      'Decisions follow models. Models follow data. We document our priors and update them in writing — public and private alike.',
  },
  {
    n: '02',
    title: 'Closed-end discipline.',
    body:
      'A finite vintage and a long lock-up let us underwrite for outcomes, not for marks. Patient capital, mechanically deployed.',
  },
  {
    n: '03',
    title: 'Research as product.',
    body:
      'Every position has a published thesis. Every back-test has a published method. The portfolio is the most honest form of the research.',
  },
];

export default function Approach() {
  return (
    <section id="approach" className="relative py-28 sm:py-36 border-t border-white/[0.06]">
      <div className="container-x">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="label">Approach</div>
            <h2 className="mt-4 font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
              How we underwrite.
            </h2>
          </div>
          <div className="lg:col-span-8">
            <div className="grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
              {pillars.map((p) => (
                <article key={p.n} className="relative bg-ink-900/60 p-7 sm:p-9 transition-colors hover:bg-ink-800/80">
                  <div className="flex items-baseline gap-5">
                    <div className="num text-sm text-moss-300/80">{p.n}</div>
                    <div className="flex-1">
                      <h3 className="font-display text-2xl leading-tight tracking-tight">{p.title}</h3>
                      <p className="mt-3 max-w-2xl text-white/65 leading-relaxed">{p.body}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
