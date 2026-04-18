import { useState } from 'react';
import { useReveal } from '../hooks/useReveal';
import { Eyebrow, SectionTitle } from './primitives';

const notes = [
  { id: 'SR-026', date: '2026 · Q2', title: 'A factor model for pre-seed investing',                tag: 'Venture' },
  { id: 'SR-025', date: '2026 · Q1', title: 'Liquidity asymmetry in private secondary markets',     tag: 'Private markets' },
  { id: 'SR-024', date: '2025 · Q4', title: 'Hiring velocity as a leading indicator of Series B',   tag: 'Venture' },
  { id: 'SR-023', date: '2025 · Q3', title: 'Volatility budgeting across public and private',       tag: 'Portfolio' },
  { id: 'SR-022', date: '2025 · Q2', title: 'Reflexivity in venture round dynamics',                tag: 'Venture' },
  { id: 'SR-021', date: '2025 · Q1', title: 'A closed-form bound on factor crowding',               tag: 'Quant' },
];

export default function Research() {
  const [revealRef, inView] = useReveal(0.1);
  return (
    <section id="research" className="relative border-t border-line">
      <div className="mx-auto max-w-[1400px] px-5 py-24 sm:px-10 sm:py-40 lg:px-16 lg:py-48">
        <div className="grid gap-16 lg:grid-cols-12 lg:gap-20">
          <div
            ref={revealRef}
            className={`lg:col-span-4 lg:sticky lg:top-28 lg:self-start transition-all duration-1000 ${
              inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}
          >
            <Eyebrow>Research</Eyebrow>
            <SectionTitle className="mt-6">
              Published
              <br />
              <span className="text-accent">openly.</span>
            </SectionTitle>
            <div className="mt-10 flex items-baseline gap-8">
              <div>
                <div className="font-display text-[3rem] tabular-nums text-accent-strong leading-none">26</div>
                <div className="mt-2 font-mono text-[10px] tracking-[0.22em] uppercase text-fg-faint">
                  Notes published
                </div>
              </div>
              <div>
                <div className="font-display text-[3rem] tabular-nums text-accent-strong leading-none">4</div>
                <div className="mt-2 font-mono text-[10px] tracking-[0.22em] uppercase text-fg-faint">
                  Per year
                </div>
              </div>
            </div>
            <Subscribe />
          </div>

          <ol className="lg:col-span-8">
            {notes.map((n, i) => (
              <li key={n.id}>
                <a
                  href="#contact"
                  className="group grid grid-cols-12 gap-4 items-baseline border-b border-line py-7 hover:text-accent transition-colors"
                  style={{ animation: inView ? `rise .7s ease-out ${i * 80}ms both` : 'none' }}
                >
                  <div className="col-span-3 sm:col-span-2 font-mono text-[11px] tracking-[0.14em] text-accent-strong">
                    {n.id}
                  </div>
                  <div className="hidden sm:block sm:col-span-2 font-mono text-[11px] tabular-nums text-fg-faint">
                    {n.date}
                  </div>
                  <div className="col-span-9 sm:col-span-6 font-display text-[1.2rem] sm:text-[1.55rem] leading-tight tracking-tight text-fg group-hover:text-accent">
                    {n.title}
                  </div>
                  <div className="hidden sm:block col-span-2 text-right font-mono text-[10px] tracking-[0.18em] uppercase text-fg-muted group-hover:text-accent-strong transition-colors">
                    {n.tag} <span className="ml-1">↗</span>
                  </div>
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
    <form onSubmit={onSubmit} className="mt-10 border-t border-line pt-6">
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
      {(status === 'done' || status === 'error') && (
        <div className="mt-2 text-[11px] text-fg-faint">
          {status === 'done' ? 'You are on the list.' : 'Try again in a moment.'}
        </div>
      )}
    </form>
  );
}
