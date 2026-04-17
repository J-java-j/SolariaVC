import { useEffect, useMemo, useRef, useState } from 'react';

type Timeframe = '1M' | '3M' | 'YTD' | '1Y' | 'ITD';

const TFS: Timeframe[] = ['1M', '3M', 'YTD', '1Y', 'ITD'];

// Trading-day-ish bucket counts
const TF_DAYS: Record<Timeframe, number> = {
  '1M': 22,
  '3M': 66,
  'YTD': 78,   // ~Q1 + part of Q2 by mid-April
  '1Y': 252,
  'ITD': 320,  // since inception
};

type Series = { fund: number[]; spx: number[] };

export default function FundChart() {
  const [tf, setTf] = useState<Timeframe>('YTD');
  const master = useMemo(() => generateMaster(TF_DAYS.ITD), []);
  const series = useMemo(() => sliceSeries(master, TF_DAYS[tf]), [master, tf]);

  const fundReturn = pct(series.fund);
  const spxReturn = pct(series.spx);
  const spread = fundReturn - spxReturn;

  return (
    <div className="rounded-2xl border border-white/10 bg-ink-900/55 p-5 sm:p-7 hairline">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="label">Net Asset Value · Indicative</div>
          <div className="mt-2 flex items-baseline gap-3">
            <div className="num text-4xl text-white sm:text-5xl">
              {(100 * (1 + fundReturn / 100)).toFixed(2)}
            </div>
            <div
              className={`num text-sm ${
                fundReturn >= 0 ? 'text-moss-300' : 'text-rose-400'
              }`}
            >
              {fundReturn >= 0 ? '+' : ''}
              {fundReturn.toFixed(2)}%{' '}
              <span className="text-white/45">{tf}</span>
            </div>
          </div>
          <div className="mt-1 text-xs text-white/40">
            Base 100 at inception · Q1 2026
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Timeframe"
          className="flex items-center gap-1 rounded-lg border border-white/10 bg-ink-950/60 p-1 text-[11px]"
        >
          {TFS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tf === t}
              onClick={() => setTf(t)}
              className={`num rounded-md px-2.5 py-1 transition-colors ${
                tf === t
                  ? 'bg-moss-500/20 text-moss-200 ring-1 ring-moss-500/40'
                  : 'text-white/55 hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <InteractiveChart series={series} timeframe={tf} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <Pill label="Fund" value={`${fundReturn >= 0 ? '+' : ''}${fundReturn.toFixed(2)}%`} tone="moss" />
        <Pill label="S&P 500" value={`${spxReturn >= 0 ? '+' : ''}${spxReturn.toFixed(2)}%`} tone="muted" />
        <Pill
          label="Alpha"
          value={`${spread >= 0 ? '+' : ''}${spread.toFixed(2)}%`}
          tone={spread >= 0 ? 'moss' : 'rose'}
        />
        <Pill label="Sharpe · ITD" value="2.14" tone="muted" />
      </div>
    </div>
  );
}

function Pill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'moss' | 'muted' | 'rose';
}) {
  const color =
    tone === 'moss'
      ? 'text-moss-300'
      : tone === 'rose'
      ? 'text-rose-400'
      : 'text-white/85';
  return (
    <div className="rounded-lg border border-white/10 bg-ink-950/40 px-3 py-2">
      <div className="label !text-[10px] !tracking-[0.18em] !text-white/40">{label}</div>
      <div className={`num mt-1 text-base ${color}`}>{value}</div>
    </div>
  );
}

function InteractiveChart({
  series,
  timeframe,
}: {
  series: Series;
  timeframe: Timeframe;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [size, setSize] = useState({ w: 760, h: 240 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.max(320, entry.contentRect.width);
      const h = Math.max(180, Math.min(280, w * 0.32));
      setSize({ w, h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const padTop = 14;
  const padBottom = 24;
  const padLeft = 0;
  const padRight = 0;

  // Combined min/max across both series for shared y-axis
  const all = [...series.fund, ...series.spx];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;

  const xs = (i: number) =>
    padLeft + (i * (size.w - padLeft - padRight)) / (series.fund.length - 1);
  const ys = (v: number) =>
    padTop + (1 - (v - min) / span) * (size.h - padTop - padBottom);

  const fundPath = smoothPath(series.fund.map((v, i) => [xs(i), ys(v)]));
  const spxPath = smoothPath(series.spx.map((v, i) => [xs(i), ys(v)]));
  const fundArea = `${fundPath} L ${xs(series.fund.length - 1)} ${size.h - padBottom} L ${xs(0)} ${size.h - padBottom} Z`;

  const fundLast = series.fund[series.fund.length - 1];
  const fundLastY = ys(fundLast);

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, (x - padLeft) / (size.w - padLeft - padRight)));
    const idx = Math.round(ratio * (series.fund.length - 1));
    setHoverIdx(idx);
  };

  const dateLabels = useMemo(
    () => generateDateLabels(series.fund.length, timeframe),
    [series.fund.length, timeframe]
  );

  return (
    <div ref={wrapRef} className="relative w-full select-none">
      <svg
        viewBox={`0 0 ${size.w} ${size.h}`}
        className="w-full"
        preserveAspectRatio="none"
        onMouseMove={onMove}
        onMouseLeave={() => setHoverIdx(null)}
        onTouchStart={(e) => {
          const t = e.touches[0];
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const x = t.clientX - rect.left;
          const ratio = Math.max(0, Math.min(1, x / size.w));
          setHoverIdx(Math.round(ratio * (series.fund.length - 1)));
        }}
        onTouchMove={(e) => {
          const t = e.touches[0];
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const x = t.clientX - rect.left;
          const ratio = Math.max(0, Math.min(1, x / size.w));
          setHoverIdx(Math.round(ratio * (series.fund.length - 1)));
        }}
        onTouchEnd={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="fundarea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.36" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="fundline" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.55" />
            <stop offset="80%" stopColor="#34d399" stopOpacity="1" />
            <stop offset="100%" stopColor="#a7f3d0" stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* horizontal grid */}
        {[0.25, 0.5, 0.75].map((y) => (
          <line
            key={y}
            x1={padLeft}
            x2={size.w - padRight}
            y1={padTop + (size.h - padTop - padBottom) * y}
            y2={padTop + (size.h - padTop - padBottom) * y}
            stroke="#34d39922"
            strokeDasharray="2 5"
          />
        ))}

        {/* baseline at index 0 (= 100) */}
        <line
          x1={padLeft}
          x2={size.w - padRight}
          y1={ys(100)}
          y2={ys(100)}
          stroke="#ffffff20"
        />

        {/* SPX line */}
        <path
          d={spxPath}
          fill="none"
          stroke="#ffffff60"
          strokeWidth="1.4"
          strokeDasharray="3 4"
          strokeLinecap="round"
          className="transition-all duration-500"
        />

        {/* Fund area + line */}
        <path d={fundArea} fill="url(#fundarea)" className="transition-all duration-500" />
        <path
          d={fundPath}
          fill="none"
          stroke="url(#fundline)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-all duration-500"
        />

        {/* terminal dot */}
        <circle cx={xs(series.fund.length - 1)} cy={fundLastY} r="4" fill="#34d399" />
        <circle cx={xs(series.fund.length - 1)} cy={fundLastY} r="9" fill="#34d399" opacity="0.18" />

        {/* hover crosshair */}
        {hoverIdx !== null && (
          <g pointerEvents="none">
            <line
              x1={xs(hoverIdx)}
              x2={xs(hoverIdx)}
              y1={padTop}
              y2={size.h - padBottom}
              stroke="#34d39966"
              strokeDasharray="2 4"
            />
            <circle cx={xs(hoverIdx)} cy={ys(series.spx[hoverIdx])} r="3.5" fill="#ffffff" />
            <circle cx={xs(hoverIdx)} cy={ys(series.fund[hoverIdx])} r="4" fill="#34d399" />
            <circle
              cx={xs(hoverIdx)}
              cy={ys(series.fund[hoverIdx])}
              r="9"
              fill="#34d399"
              opacity="0.2"
            />
          </g>
        )}

        {/* x axis labels (sparse) */}
        {dateLabels.map((d, i) => (
          <text
            key={i}
            x={xs(d.idx)}
            y={size.h - 6}
            fontSize="10"
            fill="#ffffff55"
            className="num"
            textAnchor={i === 0 ? 'start' : i === dateLabels.length - 1 ? 'end' : 'middle'}
          >
            {d.label}
          </text>
        ))}
      </svg>

      {/* tooltip */}
      {hoverIdx !== null && (
        <Tooltip
          x={xs(hoverIdx)}
          width={size.w}
          fundVal={series.fund[hoverIdx]}
          spxVal={series.spx[hoverIdx]}
          dateLabel={pointDateLabel(hoverIdx, series.fund.length, timeframe)}
        />
      )}

      {/* legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
        <Legend swatch={<span className="inline-block h-1 w-3 rounded bg-moss-400" />} label="Medallion Fund" />
        <Legend
          swatch={<span className="inline-block h-px w-3 border-t border-dashed border-white/50" />}
          label="S&P 500"
        />
        <span className="ml-auto text-white/40">Sharpe 2.14 · Vol 8.6 · MaxDD −3.1%</span>
      </div>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-white/65">
      {swatch} {label}
    </span>
  );
}

function Tooltip({
  x,
  width,
  fundVal,
  spxVal,
  dateLabel,
}: {
  x: number;
  width: number;
  fundVal: number;
  spxVal: number;
  dateLabel: string;
}) {
  // x is in viewBox units; scale to %.
  const left = (x / width) * 100;
  // shift if near edge
  const transform =
    left > 75 ? 'translateX(-100%)' : left < 25 ? 'translateX(0)' : 'translateX(-50%)';
  const fundDelta = fundVal - 100;
  const spxDelta = spxVal - 100;
  return (
    <div
      className="pointer-events-none absolute top-2 z-10 min-w-[180px] rounded-lg border border-white/10 bg-ink-950/95 p-3 text-xs shadow-2xl backdrop-blur-md"
      style={{ left: `${left}%`, transform }}
    >
      <div className="num text-[10px] text-white/45">{dateLabel}</div>
      <div className="mt-2 flex items-center justify-between gap-4">
        <span className="flex items-center gap-2 text-white/85">
          <span className="h-2 w-2 rounded-sm bg-moss-400" /> Fund
        </span>
        <span className="num text-white">{fundVal.toFixed(2)}</span>
        <span className={`num ${fundDelta >= 0 ? 'text-moss-300' : 'text-rose-400'}`}>
          {fundDelta >= 0 ? '+' : ''}
          {fundDelta.toFixed(2)}%
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-4">
        <span className="flex items-center gap-2 text-white/85">
          <span className="h-px w-3 border-t border-dashed border-white/50" /> SPX
        </span>
        <span className="num text-white">{spxVal.toFixed(2)}</span>
        <span className={`num ${spxDelta >= 0 ? 'text-moss-300' : 'text-rose-400'}`}>
          {spxDelta >= 0 ? '+' : ''}
          {spxDelta.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

// ----- math helpers -----

function pct(series: number[]): number {
  if (series.length < 2) return 0;
  const a = series[0];
  const b = series[series.length - 1];
  return ((b - a) / a) * 100;
}

function smoothPath(points: [number, number][]): string {
  if (points.length === 0) return '';
  let d = `M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`;
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const cx0 = x0 + (x1 - x0) / 2;
    const cx1 = x1 - (x1 - x0) / 2;
    d += ` C ${cx0.toFixed(2)} ${y0.toFixed(2)}, ${cx1.toFixed(2)} ${y1.toFixed(2)}, ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }
  return d;
}

function sliceSeries(master: Series, days: number): Series {
  const fund = master.fund.slice(-days);
  const spx = master.spx.slice(-days);
  // re-base the slice to start at 100 so the chart shows return-from-window-start
  const fa = fund[0] || 1;
  const sa = spx[0] || 1;
  return {
    fund: fund.map((v) => (v / fa) * 100),
    spx: spx.map((v) => (v / sa) * 100),
  };
}

// generate a master series of daily NAVs starting at 100. Fund tracks SPX with alpha.
function generateMaster(days: number): Series {
  // Use a deterministic seed-ish RNG so the chart is consistent across renders
  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 0x100000000;
    return seed / 0x100000000;
  };
  const gauss = () => {
    const u = 1 - rand();
    const v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  const dailyVolFund = 0.0055;
  const dailyVolSpx = 0.009;
  const annualAlphaFund = 0.18;  // ~18% annual return
  const annualAlphaSpx = 0.08;   // ~8% annual return
  const driftFund = annualAlphaFund / 252;
  const driftSpx = annualAlphaSpx / 252;

  const fund: number[] = [100];
  const spx: number[] = [100];

  for (let i = 1; i < days; i++) {
    // shared market shock + idiosyncratic
    const market = gauss();
    const idiosyncratic = gauss();

    const spxRet = driftSpx + dailyVolSpx * market;
    // fund has lower beta (~0.4) plus its own alpha process
    const fundRet =
      driftFund + 0.4 * dailyVolSpx * market + dailyVolFund * idiosyncratic;

    spx.push(spx[i - 1] * (1 + spxRet));
    fund.push(fund[i - 1] * (1 + fundRet));
  }

  return { fund, spx };
}

function generateDateLabels(n: number, tf: Timeframe): { idx: number; label: string }[] {
  const today = new Date();
  // approximate business-day to calendar-day
  const calDays = Math.round(n * 1.45);
  const start = new Date(today.getTime() - calDays * 24 * 3600 * 1000);

  const ticks = tf === '1M' ? 4 : tf === '3M' ? 4 : tf === 'YTD' ? 5 : tf === '1Y' ? 5 : 4;
  const out: { idx: number; label: string }[] = [];
  for (let i = 0; i < ticks; i++) {
    const idx = Math.round((i * (n - 1)) / (ticks - 1));
    const ratio = idx / (n - 1);
    const ts = start.getTime() + ratio * (today.getTime() - start.getTime());
    const d = new Date(ts);
    const label =
      tf === '1Y' || tf === 'ITD'
        ? d.toLocaleString('en-US', { month: 'short', year: '2-digit' })
        : d.toLocaleString('en-US', { month: 'short', day: 'numeric' });
    out.push({ idx, label });
  }
  return out;
}

function pointDateLabel(idx: number, n: number, tf: Timeframe): string {
  const today = new Date();
  const calDays = Math.round(n * 1.45);
  const start = new Date(today.getTime() - calDays * 24 * 3600 * 1000);
  const ratio = idx / (n - 1);
  const ts = start.getTime() + ratio * (today.getTime() - start.getTime());
  const d = new Date(ts);
  return tf === '1Y' || tf === 'ITD'
    ? d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : d.toLocaleString('en-US', { month: 'short', day: 'numeric' });
}
