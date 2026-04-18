import { useState } from 'react';
import Reveal from './Reveal';

const notes = [
  { id: 'SR-026', date: '2026 · Q2', cat: 'Venture Quant',          title: 'A factor model for pre-seed investing',                  excerpt: 'Five orthogonal factors — founder velocity, market entropy, capital efficiency, technical moat, and timing — back-tested against 2,400 outcomes since 2018.' },
  { id: 'SR-025', date: '2026 · Q1', cat: 'Market Microstructure',  title: 'Liquidity asymmetry in private secondary markets',       excerpt: 'Private secondaries clear at structurally wider spreads than public equities. We model the implied volatility against round-by-round preferred prices.' },
  { id: 'SR-024', date: '2025 · Q4', cat: 'Alternative Data',       title: 'Hiring velocity as a leading indicator of Series B',     excerpt: 'Engineering hires per quarter, weighted by seniority, predicts up-round probability with AUC 0.74 across our 2019–2024 cohort.' },
  { id: 'SR-023', date: '2025 · Q3', cat: 'Portfolio Theory',       title: 'Volatility budgeting across public and private',         excerpt: 'A unified vol-budgeting framework that treats illiquid private positions as continuously-marked exposures via observable comparable baskets.' },
];

export default function Research() {
  return (
    <section
      id="research"
      className="relative border-t border-white/[0.06] py-16 sm:py-24 lg:py-32"
    >
      <div className="container-x">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <Reveal className="lg:col-span-4">
            <div className="text-[11px] uppercase tracking-[0.24em] text-moss-300/80">
              Solaria Research
            </div>
            <h2 className="mt-4 font-display text-3xl font-medium leading-tight tracking-tight sm:text-4xl">
              Quant models, applied to venture.
            </h2>
            <p className="mt-6 text-white/70 leading-relaxed">
              Quantitative notes published quarterly. Open methodology, honest priors.
            </p>

            <Subscribe />
          </Reveal>

          <Reveal delay={120} className="lg:col-span-8">
            <ul className="divide-y divide-white/[0.06] border-y border-white/[0.06]">
              {notes.map((n) => (
                <li key={n.id}>
                  <a
                    href="#contact"
                    className="block py-6 transition-colors hover:bg-white/[0.015]"
                  >
                    <div className="flex flex-wrap items-center gap-x-3 text-[11px]">
                      <span className="num text-moss-300/85">{n.id}</span>
                      <span className="text-white/35">·</span>
                      <span className="text-white/55">{n.date}</span>
                      <span className="text-white/35">·</span>
                      <span className="text-white/60">{n.cat}</span>
                    </div>
                    <h3 className="mt-2 font-display text-xl leading-snug text-white">
                      {n.title}
                    </h3>
                    <p className="mt-2 max-w-3xl text-sm text-white/65 leading-relaxed">
                      {n.excerpt}
                    </p>
                  </a>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Subscribe() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'subscribe',
          name: 'Research Subscriber',
          email: email.trim(),
          organization: '',
          message: 'Add me to the Solaria Research distribution list.',
        }),
      });
      if (!res.ok) throw new Error('http ' + res.status);
      setStatus('done');
      setEmail('');
    } catch {
      setStatus('error');
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="mt-8 border-t border-white/[0.06] pt-6"
    >
      <div className="text-[10.5px] uppercase tracking-[0.2em] text-white/45">
        Subscribe — research notes
      </div>
      <div className="mt-3 flex gap-2">
        <input
          type="email"
          required
          placeholder="you@firm.com"
          value={email}
          disabled={status === 'sending' || status === 'done'}
          onChange={(e) => setEmail(e.target.value)}
          className="num w-full rounded-md border border-white/10 bg-ink-950/60 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-moss-500/50 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={status === 'sending' || status === 'done'}
          className="rounded-md bg-moss-500 px-4 py-2 text-sm font-medium text-ink-950 transition-colors hover:bg-moss-400 disabled:opacity-70"
        >
          {status === 'sending' ? '…' : status === 'done' ? '✓' : 'Subscribe'}
        </button>
      </div>
      <div className="mt-2 text-[11px] text-white/40">
        {status === 'done'
          ? 'You are on the list.'
          : status === 'error'
          ? 'Try again in a moment.'
          : 'Quarterly. No spam.'}
      </div>
    </form>
  );
}
