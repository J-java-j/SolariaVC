import { useState } from 'react';
import Spotlight from './Spotlight';
import { SOLARIA_EMAIL } from './EmailButton';

const notes = [
  {
    id: 'SR-026',
    date: '2026 · Q2',
    cat: 'Venture Quant',
    title: 'A factor model for pre-seed investing',
    excerpt:
      'We define five orthogonal factors — founder velocity, market entropy, capital efficiency, technical moat, and timing — and back-test against 2,400 outcomes since 2018.',
    tags: ['Factors', 'Pre-seed', 'Backtest'],
  },
  {
    id: 'SR-025',
    date: '2026 · Q1',
    cat: 'Market Microstructure',
    title: 'Liquidity asymmetry in private secondary markets',
    excerpt:
      'Private secondaries clear at structurally wider spreads than public equities. We model the implied volatility of common-stock secondaries against round-by-round preferred prices.',
    tags: ['Secondary', 'Liquidity'],
  },
  {
    id: 'SR-024',
    date: '2025 · Q4',
    cat: 'Alternative Data',
    title: 'Hiring velocity as a leading indicator of Series B success',
    excerpt:
      'Engineering hires per quarter, weighted by seniority, predicts upround probability with AUC 0.74 across our 2019–2024 cohort.',
    tags: ['Talent', 'Series B'],
  },
  {
    id: 'SR-023',
    date: '2025 · Q3',
    cat: 'Portfolio Theory',
    title: 'Volatility budgeting across public and private allocations',
    excerpt:
      'A unified vol-budgeting framework that treats illiquid private positions as continuously-marked exposures via observable comparable baskets.',
    tags: ['Vol', 'Portfolio'],
  },
];

export default function Research() {
  return (
    <section id="research" className="relative py-28 sm:py-36 border-t border-white/[0.06] bg-gradient-to-b from-ink-950 via-ink-900/50 to-ink-950">
      <div className="container-x">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-4">
            <div className="label">Solaria Research</div>
            <h2 className="mt-4 font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
              Quant models, applied to venture.
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-white/70">
              Most venture investing relies on pattern-matching and a story. We publish the models behind ours.
              Open methodology. Reproducible back-tests. Honest priors.
            </p>
            <div className="mt-8">
              <Subscribe />
            </div>
            <div className="mt-8 flex flex-wrap gap-2">
              {['Factor Models', 'Microstructure', 'Alt Data', 'Portfolio', 'Bayesian Priors', 'Causal Inf.'].map(
                (t) => (
                  <span
                    key={t}
                    className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/65"
                  >
                    {t}
                  </span>
                )
              )}
            </div>
          </div>

          <div className="lg:col-span-8">
            <Spotlight intensity={0.1}>
            <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/10 bg-ink-900/40">
              {notes.map((n) => (
                <li key={n.id}>
                  <a
                    href="#contact"
                    className="group block px-6 py-6 sm:px-8 sm:py-7 transition-colors hover:bg-white/[0.025]"
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <span className="num text-moss-300/90">{n.id}</span>
                      <span className="text-white/40">·</span>
                      <span className="text-white/55">{n.date}</span>
                      <span className="text-white/40">·</span>
                      <span className="rounded bg-moss-500/10 px-2 py-0.5 text-moss-200/90 ring-1 ring-moss-500/20">
                        {n.cat}
                      </span>
                    </div>
                    <h3 className="mt-3 font-display text-2xl leading-tight tracking-tight transition-colors group-hover:text-moss-200">
                      {n.title}
                    </h3>
                    <p className="mt-3 max-w-3xl text-white/65 leading-relaxed">{n.excerpt}</p>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap gap-1.5">
                        {n.tags.map((t) => (
                          <span key={t} className="text-[11px] text-white/45">
                            #{t.toLowerCase().replace(/\s+/g, '-')}
                          </span>
                        ))}
                      </div>
                      <span className="text-xs text-white/55 transition-transform group-hover:translate-x-1">
                        Read note →
                      </span>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
            </Spotlight>
          </div>
        </div>
      </div>
    </section>
  );
}

function Subscribe() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    const subject = 'Solaria Research — Subscribe';
    const body = `Please add me to the Solaria Research mailing list.\n\nEmail: ${email}\n`;
    const mailto = `mailto:${SOLARIA_EMAIL}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;

    // Always copy our inbox so the user can paste if no mail client opens.
    try {
      await navigator.clipboard?.writeText(SOLARIA_EMAIL);
    } catch {
      /* ignore */
    }
    window.location.href = mailto;
    setDone(true);
    window.setTimeout(() => setDone(false), 3000);
  };

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-white/10 bg-ink-900/60 p-4"
    >
      <label htmlFor="rs-email" className="label">
        Subscribe — research notes
      </label>
      <div className="mt-3 flex gap-2">
        <input
          id="rs-email"
          name="email"
          type="email"
          required
          placeholder="you@firm.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="num w-full rounded-md border border-white/10 bg-ink-950/80 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-moss-500/60"
        />
        <button
          type="submit"
          className="rounded-md bg-moss-500 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-moss-400 transition-colors"
        >
          {done ? 'Sent ✓' : 'Subscribe'}
        </button>
      </div>
      <div className="mt-2 text-[11px] text-white/40">
        {done
          ? `Compose opened — or email ${SOLARIA_EMAIL} (copied to clipboard).`
          : `Quarterly. No spam. Or email ${SOLARIA_EMAIL} directly.`}
      </div>
    </form>
  );
}
