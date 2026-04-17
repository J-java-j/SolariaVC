import { useEffect, useRef } from 'react';
import { useLivePrices, formatPrice, formatChange, type Quote } from '../hooks/useLivePrices';

export default function LiveTicker() {
  const { quotes, hasReal } = useLivePrices();

  return (
    <section
      aria-label="Live market ticker"
      className="relative border-y border-white/[0.06] bg-ink-900/70 backdrop-blur-sm overflow-hidden"
    >
      <div className="container-x flex items-stretch gap-4">
        <div className="flex shrink-0 items-center gap-2 border-r border-white/[0.06] py-3 pr-5">
          <span className="relative flex h-2 w-2">
            <span
              className={`absolute inset-0 rounded-full ${
                hasReal ? 'bg-moss-400 animate-ping' : 'bg-amber-300/70'
              } opacity-75`}
            />
            <span
              className={`relative inline-flex h-2 w-2 rounded-full ${
                hasReal ? 'bg-moss-400' : 'bg-amber-300'
              }`}
            />
          </span>
          <span className="num text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
            {hasReal ? 'Live' : 'Indicative'}
          </span>
        </div>
        <div className="relative flex-1 overflow-hidden">
          <div className="ticker-track flex whitespace-nowrap py-3 will-change-transform">
            {[...quotes, ...quotes].map((q, i) => (
              <TickerItem key={`${q.symbol}-${i}`} q={q} />
            ))}
          </div>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-ink-900/95 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-ink-900/95 to-transparent" />
        </div>
      </div>
    </section>
  );
}

function TickerItem({ q }: { q: Quote }) {
  const positive = q.changePct >= 0;
  const prevPrice = useRef(q.price);
  const flashRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!flashRef.current) return;
    const went = q.price - prevPrice.current;
    if (Math.abs(went) > 0.001) {
      const cls = went > 0 ? 'flash-up' : 'flash-down';
      flashRef.current.classList.add(cls);
      const t = setTimeout(() => flashRef.current?.classList.remove(cls), 600);
      prevPrice.current = q.price;
      return () => clearTimeout(t);
    }
  }, [q.price]);

  return (
    <div className="flex items-center gap-3 px-6 text-xs">
      <span className="num font-semibold text-white/85">{q.symbol.replace('-USD', '')}</span>
      <span ref={flashRef} className="num text-white transition-colors">
        {formatPrice(q)}
      </span>
      <span
        className={`num inline-flex items-center gap-0.5 ${
          positive ? 'text-moss-300' : 'text-rose-400'
        }`}
      >
        <Arrow up={positive} />
        {formatChange(q)}
      </span>
      <span className="text-white/15">•</span>
    </div>
  );
}

function Arrow({ up }: { up: boolean }) {
  return (
    <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden>
      <path
        d={up ? 'M5 1 L9 7 L1 7 Z' : 'M5 9 L1 3 L9 3 Z'}
        fill="currentColor"
      />
    </svg>
  );
}
