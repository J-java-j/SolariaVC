import { useState } from 'react';
import { useReveal } from '../hooks/useReveal';
import { Eyebrow, SectionTitle } from './primitives';

const notes = [
  { id: 'SR-026', date: '2026 · Q2', title: 'A factor model for pre-seed investing', excerpt: 'Five orthogonal factors — founder velocity, market entropy, capital efficiency, technical moat, timing — back-tested against 2,400 outcomes since 2018.', tag: 'Venture' },
  { id: 'SR-025', date: '2026 · Q1', title: 'Liquidity asymmetry in private secondary markets', excerpt: 'Private secondaries clear at structurally wider spreads. We model implied vol of common stock against round-by-round preferred prices.', tag: 'Private markets' },
  { id: 'SR-024', date: '2025 · Q4', title: 'Hiring velocity as leading indicator of Series B', excerpt: 'Engineering hires per quarter, weighted by seniority, predicts upround probability with AUC 0.74.', tag: 'Venture' },
  { id: 'SR-023', date: '2025 · Q3', title: 'Volatility budgeting across public and private books', excerpt: 'A unified framework treating illiquid private positions as continuously-marked via comparable baskets.', tag: 'Portfolio' },
];

export default function Research() {
  const [revealRef, inView] = useReveal(0.1);
  return (
    <section id="research" className="relative border-t border-line">
      <div className="mx-auto max-w-[1400px] px-5 py-20 sm:px-10 sm:py-32 lg:px-16 lg:py-40">
        <div className="grid gap-12 lg:grid-cols-12">
          <div
            ref={revealRef}
            className={`lg:col-span-5 lg:sticky lg:top-24 lg:self-start transition-all duration-1000 ${
              inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}
          >
            <Eyebrow>Solaria Research</Eyebrow>
            <SectionTitle className="mt-5">
              The models,
              <br />
              <span className="text-accent italic font-light">published openly.</span>
            </SectionTitle>
            <p className="mt-5 sm:mt-6 text-[15.5px] sm:text-[17px] leading-relaxed text-fg-muted">
              Most venture investing relies on pattern-matching and a story. We publish the models behind
              ours — open methodology, reproducible back-tests, honest priors.
            </p>
            <Subscribe />
          </div>

          <ol className="lg:col-span-7 space-y-2">
            {notes.map((n, i) => (
              <li key={n.id}>
                <a
                  href="#contact"
                  className="group relative block rounded-xl border border-line bg-fg-b px-5 py-5 sm:px-6 sm:py-6 hover:border-line-strong hover:bg-fg-c transition-all"
                  style={{ animation: inView ? `rise .8s ease-out ${i * 90}ms both` : 'none' }}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
                      <span className="rounded bg-[rgba(var(--accent-rgb),0.10)] px-2 py-0.5 text-accent-strong tracking-[0.1em] ring-1 ring-[rgba(var(--accent-rgb),0.25)]">
                        {n.id}
                      </span>
                      <span className="tabular-nums text-fg-muted">{n.date}</span>
                      <span className="text-fg-faint">·</span>
                      <span className="text-fg-muted">{n.tag}</span>
                    </div>
                    <span className="font-mono text-[14px] text-fg-faint group-hover:text-accent-strong transition-colors">
                      ↗
                    </span>
                  </div>
                  <h3 className="mt-3 font-display text-[1.25rem] sm:text-[1.35rem] leading-tight tracking-tight text-fg group-hover:text-accent-strong transition-colors">
                    {n.title}
                  </h3>
                  <p className="mt-2 text-[14px] text-fg-muted leading-relaxed">{n.excerpt}</p>
                </a>
              </li>
            ))}
          </ol>
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
    <form onSubmit={onSubmit} className="mt-8 rounded-xl border border-line bg-fg-b p-5">
      <div className="font-mono text-[9.5px] tracking-[0.22em] uppercase text-fg-faint">
        Quarterly · no spam
      </div>
      <div className="mt-3 flex gap-2">
        <input
          type="email"
          required
          placeholder="your@email.com"
          value={email}
          disabled={status === 'sending' || status === 'done'}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 rounded-md border border-line bg-fg-a px-3 py-2 text-[13px] text-fg placeholder:text-fg-faint outline-none focus:border-line-strong disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={status === 'sending' || status === 'done'}
          className="rounded-md bg-accent px-4 py-2 text-[12px] font-semibold hover:opacity-90 transition-colors disabled:opacity-70"
        >
          {status === 'sending' ? '…' : status === 'done' ? '✓' : 'Subscribe →'}
        </button>
      </div>
      <div className="mt-2 text-[11px] text-fg-faint">
        {status === 'done' ? 'You are on the list.' : status === 'error' ? 'Try again in a moment.' : ''}
      </div>
    </form>
  );
}
