const items = [
  { sym: 'SOL.MED', label: 'Medallion Fund · NAV', value: '102.74', delta: '+2.74%' },
  { sym: 'STAT.ARB', label: 'Statistical Arbitrage', value: '+1.82%', delta: 'MTD' },
  { sym: 'EQ.MOM', label: 'Equity Momentum', value: '+0.94%', delta: 'MTD' },
  { sym: 'VENT.SCORE', label: 'Venture Quant Score', value: '0.71', delta: 'σ' },
  { sym: 'VOL.HRZ', label: 'Vol Horizon · 30d', value: '14.6', delta: 'pts' },
  { sym: 'RES.NOTES', label: 'Research Notes · YTD', value: '12', delta: 'pub' },
  { sym: 'AUM', label: 'Capital Committed', value: '$2.51M', delta: 'AUM' },
];

export default function Marquee() {
  return (
    <section className="relative border-y border-white/[0.06] bg-ink-900/60 py-3 overflow-hidden">
      <div className="flex whitespace-nowrap animate-ticker">
        {[...items, ...items, ...items].map((it, i) => (
          <Item key={i} {...it} />
        ))}
      </div>
    </section>
  );
}

function Item({ sym, label, value, delta }: { sym: string; label: string; value: string; delta: string }) {
  const positive = delta.startsWith('+');
  return (
    <div className="flex items-center gap-3 px-8 text-xs">
      <span className="num text-white/40">{sym}</span>
      <span className="text-white/55">{label}</span>
      <span className="num text-white">{value}</span>
      <span className={`num ${positive ? 'text-moss-300' : 'text-white/45'}`}>{delta}</span>
      <span className="text-white/15">•</span>
    </div>
  );
}
