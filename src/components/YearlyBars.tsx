import type { YearRow } from '../lib/fundData';

/**
 * Side-by-side yearly returns: Solaria (M4 V3) vs S&P 500 (real).
 * Bars extend up/down from a zero line inside a fixed-height container
 * so layout can't collapse the way a pure-flex arrangement would.
 */
export default function YearlyBars({ rows }: { rows: YearRow[] }) {
  const HEIGHT = 200;

  const allValues = rows.flatMap((r) => [r.fund, r.spy]);
  const posMax = Math.max(0, ...allValues);
  const negMax = Math.abs(Math.min(0, ...allValues));
  const pad = Math.max(posMax, negMax) * 0.08;
  const totalRange = posMax + negMax + pad * 2;
  // fraction of height above zero (adding a bit of top padding)
  const zeroFromTop = ((posMax + pad) / totalRange) * HEIGHT;

  const barFor = (v: number, color: 'moss' | 'white') => {
    const h = (Math.abs(v) / totalRange) * HEIGHT;
    const top = v >= 0 ? zeroFromTop - h : zeroFromTop;
    const positive = v >= 0;
    const bg =
      color === 'moss'
        ? positive
          ? 'bg-moss-400/65 hover:bg-moss-300/80'
          : 'bg-rose-500/55 hover:bg-rose-500/75'
        : positive
        ? 'bg-white/30 hover:bg-white/50'
        : 'bg-white/20 hover:bg-white/40';
    return { top, h, bg };
  };

  return (
    <div className="mt-5">
      <div
        className="relative w-full overflow-hidden rounded-lg border border-white/[0.06] bg-ink-950/40 p-2"
        style={{ height: HEIGHT + 16 }}
      >
        {/* zero line */}
        <div
          className="absolute inset-x-2 h-px bg-white/15"
          style={{ top: zeroFromTop + 8 }}
        />
        <div
          className="relative grid h-full"
          style={{
            gridTemplateColumns: `repeat(${rows.length}, 1fr)`,
            columnGap: '6px',
            height: HEIGHT,
          }}
        >
          {rows.map((r) => {
            const f = barFor(r.fund, 'moss');
            const s = barFor(r.spy, 'white');
            return (
              <div
                key={r.year}
                className="group relative h-full"
                title={`${r.year} — Solaria: ${r.fund >= 0 ? '+' : ''}${r.fund.toFixed(2)}%  ·  SPY: ${r.spy >= 0 ? '+' : ''}${r.spy.toFixed(2)}%`}
              >
                {/* Fund bar (left half) */}
                <div
                  className={`absolute rounded-sm transition-colors ${f.bg}`}
                  style={{
                    top: f.top,
                    height: f.h,
                    left: 0,
                    width: 'calc(50% - 1px)',
                  }}
                />
                {/* SPY bar (right half) */}
                <div
                  className={`absolute rounded-sm transition-colors ${s.bg}`}
                  style={{
                    top: s.top,
                    height: s.h,
                    right: 0,
                    width: 'calc(50% - 1px)',
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* year labels */}
      <div
        className="mt-2 grid"
        style={{
          gridTemplateColumns: `repeat(${rows.length}, 1fr)`,
          columnGap: '6px',
        }}
      >
        {rows.map((r) => (
          <div
            key={r.year}
            className="num text-center text-[10px] text-white/45"
          >
            ’{String(r.year).slice(-2)}
          </div>
        ))}
      </div>

      {/* legend */}
      <div className="mt-4 flex flex-wrap items-center gap-5 text-[11px]">
        <span className="inline-flex items-center gap-2 text-white/70">
          <span className="inline-block h-2.5 w-3 rounded-sm bg-moss-400/70" />
          Solaria · M4 V3
        </span>
        <span className="inline-flex items-center gap-2 text-white/70">
          <span className="inline-block h-2.5 w-3 rounded-sm bg-white/30" />
          S&P 500 (actual)
        </span>
        <span className="ml-auto num text-[10px] text-white/35">
          Solaria positive in {rows.filter((r) => r.fund >= 0).length} of {rows.length} years · S&P in{' '}
          {rows.filter((r) => r.spy >= 0).length}
        </span>
      </div>
    </div>
  );
}
