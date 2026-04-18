import { useReveal } from '../hooks/useReveal';
import { useTypewriter } from '../hooks/useTypewriter';
import { useCountUp } from '../hooks/useCountUp';
import { BACKTEST_STATS } from '../lib/fundData';

/**
 * Medallion Fund — the gold-themed flagship section. Three movements:
 *   1. Giant MEDALLION watermark + "The Flagship" intro
 *   2. Typewriter "One dollar became sixteen."
 *   3. Three big numbers (CAGR / Sharpe / Max DD)
 * The page-level ThemeManager engages the gold theme as this section
 * crosses 55% of the viewport.
 */
export default function Fund() {
  const [titleRef, titleIn] = useReveal(0.4);
  const [dollarRef, dollarIn] = useReveal(0.5);
  const [numbersRef, numbersIn] = useReveal(0.4);

  const phrase = useTypewriter('One dollar became ', dollarIn, 48, 300);
  const showSixteen = phrase.length >= 18;

  const cagr = useCountUp(BACKTEST_STATS.cagrPct, numbersIn, 2200, 2);
  const sharpe = useCountUp(BACKTEST_STATS.sharpe, numbersIn, 2200, 2);
  const dd = useCountUp(BACKTEST_STATS.maxDrawdownPct, numbersIn, 2200, 1);

  return (
    <section id="fund" className="relative border-t border-line overflow-hidden">
      {/* === MOVEMENT 1: title with massive MEDALLION watermark === */}
      <div ref={titleRef} className="relative min-h-[90vh] flex items-center justify-center px-5 sm:px-10">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
          <div
            className="font-display tracking-[-0.02em] whitespace-nowrap select-none"
            style={{
              fontSize: 'clamp(6rem, 22vw, 22rem)',
              color: 'var(--accent-500)',
              opacity: titleIn ? 0.08 : 0,
              transition:
                'opacity 1600ms cubic-bezier(0.22,1,0.36,1), transform 1800ms cubic-bezier(0.22,1,0.36,1)',
              transform: titleIn ? 'translateY(0) scale(1)' : 'translateY(40px) scale(0.96)',
            }}
          >
            MEDALLION
          </div>
        </div>

        <div className="relative text-center max-w-3xl">
          <div
            className="font-mono text-[10.5px] tracking-[0.35em] uppercase text-accent-strong"
            style={{
              opacity: titleIn ? 1 : 0,
              transform: titleIn ? 'translateY(0)' : 'translateY(12px)',
              transition: 'opacity 900ms cubic-bezier(0.22,1,0.36,1), transform 900ms cubic-bezier(0.22,1,0.36,1)',
            }}
          >
            The Flagship
          </div>
          <h2
            className="mt-6 sm:mt-8 font-display tracking-[-0.015em] leading-[0.98] text-[2.4rem] sm:text-[5.2rem] lg:text-[7rem] text-fg"
            style={{
              opacity: titleIn ? 1 : 0,
              transform: titleIn ? 'translateY(0)' : 'translateY(30px)',
              transition:
                'opacity 1200ms cubic-bezier(0.22,1,0.36,1) 200ms, transform 1200ms cubic-bezier(0.22,1,0.36,1) 200ms',
            }}
          >
            Medallion <span className="text-accent">Fund</span>
          </h2>
          <p
            className="mt-7 mx-auto max-w-[38ch] text-[15.5px] sm:text-[17px] leading-relaxed text-fg-muted"
            style={{
              opacity: titleIn ? 1 : 0,
              transform: titleIn ? 'translateY(0)' : 'translateY(20px)',
              transition:
                'opacity 1000ms cubic-bezier(0.22,1,0.36,1) 600ms, transform 1000ms cubic-bezier(0.22,1,0.36,1) 600ms',
            }}
          >
            Closed-end. Multi-strategy. Fourteen years of evidence.
          </p>
        </div>
      </div>

      {/* === MOVEMENT 2: typewriter "One dollar became sixteen" === */}
      <div
        ref={dollarRef}
        className="relative mx-auto max-w-[1400px] px-5 py-24 sm:px-10 sm:py-36 lg:px-16 lg:py-44 text-center"
      >
        <h3
          className="font-display tracking-[-0.01em] leading-[1.05] text-[1.9rem] sm:text-[3.6rem] lg:text-[5rem] text-fg"
          style={{ textWrap: 'balance' as never }}
        >
          <span className="inline-block">{phrase}</span>
          <span
            className="inline-block text-accent relative"
            style={{
              opacity: showSixteen ? 1 : 0,
              transform: showSixteen ? 'scale(1)' : 'scale(0.5)',
              transition:
                'opacity 700ms cubic-bezier(0.22,1,0.36,1), transform 900ms cubic-bezier(0.34, 1.56, 0.64, 1)',
              transformOrigin: 'left center',
              marginLeft: showSixteen ? '0.2em' : '0',
            }}
          >
            sixteen
          </span>
          <span
            className="inline-block"
            style={{
              opacity: showSixteen ? 1 : 0,
              transition: 'opacity 400ms 400ms',
            }}
          >
            .
          </span>
          <span
            className="inline-block w-[0.08em] bg-current align-baseline"
            style={{
              height: '0.9em',
              marginLeft: '0.05em',
              opacity: !showSixteen && phrase.length > 0 ? 1 : 0,
              animation: !showSixteen && phrase.length > 0 ? 'blink 900ms steps(1) infinite' : 'none',
            }}
          />
        </h3>

        <p
          className="mt-8 mx-auto max-w-[42ch] text-[14.5px] sm:text-[16px] text-fg-muted leading-relaxed"
          style={{
            opacity: showSixteen ? 1 : 0,
            transform: showSixteen ? 'translateY(0)' : 'translateY(10px)',
            transition:
              'opacity 800ms cubic-bezier(0.22,1,0.36,1) 700ms, transform 800ms cubic-bezier(0.22,1,0.36,1) 700ms',
          }}
        >
          Apr 2012 → Apr 2026. Net of modeled fees. Past performance is backtested and not indicative
          of future results.
        </p>
      </div>

      {/* === MOVEMENT 3: three big numbers (springy, staggered) === */}
      <div
        ref={numbersRef}
        className="relative mx-auto max-w-[1400px] px-5 pb-24 sm:px-10 sm:pb-40 lg:px-16 lg:pb-48"
      >
        <div className="grid gap-14 sm:gap-16 lg:gap-24 sm:grid-cols-3">
          {[
            { label: 'Backtest CAGR', value: `${cagr}%`, sub: 'S&P 500 · 13.45%', accent: true, delay: 0 },
            { label: 'Sharpe ratio', value: sharpe, sub: 'HF benchmark · 0.60', accent: false, delay: 220 },
            { label: 'Max drawdown', value: `${dd}%`, sub: 'S&P 500 · −33.8%', accent: false, delay: 440 },
          ].map((m) => (
            <div
              key={m.label}
              className="text-center"
              style={{
                opacity: numbersIn ? 1 : 0,
                transform: numbersIn ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.92)',
                transition: `opacity 900ms cubic-bezier(0.22,1,0.36,1) ${m.delay}ms, transform 1100ms cubic-bezier(0.34, 1.56, 0.64, 1) ${m.delay}ms`,
              }}
            >
              <div className="font-mono text-[10px] tracking-[0.28em] uppercase text-fg-faint">{m.label}</div>
              <div
                className={`mt-4 sm:mt-6 font-display leading-[0.95] tabular-nums text-[3.4rem] sm:text-[5.6rem] lg:text-[7rem] ${
                  m.accent ? 'text-accent' : 'text-fg'
                }`}
              >
                {m.value}
              </div>
              <div className="mt-3 sm:mt-4 font-mono text-[10.5px] tabular-nums text-fg-faint">{m.sub}</div>
            </div>
          ))}
        </div>

        <div
          className="mt-20 sm:mt-28 flex justify-center"
          style={{
            opacity: numbersIn ? 1 : 0,
            transition: 'opacity 1000ms cubic-bezier(0.22,1,0.36,1) 800ms',
          }}
        >
          <a href="#contact" className="group inline-flex items-center gap-3 text-[13px] hover:opacity-80 transition-opacity">
            <span className="font-mono tracking-[0.24em] uppercase text-[11px] text-accent-strong">
              Request prospectus
            </span>
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border"
              style={{ borderColor: 'var(--line-strong)', color: 'var(--accent-300)' }}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}
