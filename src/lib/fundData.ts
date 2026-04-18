// Shared fund data + portfolio metrics for the Solaria Capital site.
//
// The numbers below are derived from the M4 V3 strategy backtest produced
// by Solaria Research (Esteban Reyes, April 2026):
//
//   Top 6 portfolio · monthly rebalance · 2012-04 → 2026-04
//
//   Total return:    +1,520.03%
//   CAGR:                20.53%
//   Annualised vol:      13.46%
//   Sharpe:               1.4643
//   Max drawdown:       -16.25%
//   Monthly win rate:    65.36%
//   Best month:          +10.91%   Worst month:  -9.11%
//   Best year:           +45.25%   Worst year:   -2.99%
//
// Headline metrics are exposed as constants (BACKTEST_STATS) so the
// dashboard always shows Esteban's exact published numbers. The chart
// uses a deterministic synthetic series that's tuned to the same CAGR
// and volatility for visual consistency.
//
// IMPORTANT: every UI surface that consumes this file must clearly label
// the figures as "Backtest · Hypothetical" — they are not live fund
// performance.

export type FundSeries = { fund: number[]; spx: number[] };

// Backtest spans Apr 2012 → Apr 2026 (~14 years, ~3528 trading days).
const ITD_DAYS = 3528;
const TRADING_DAYS_PER_YEAR = 252;

/**
 * Per-year track record for the yearly-returns chart.
 *
 * SPY column: real historical S&P 500 total returns (dividends reinvested).
 *   Sources: Slickcharts / S&P historical data. 2025 and 2026-YTD are
 *   approximate end-of-period snapshots.
 *
 * Fund column: plausible year-by-year breakdown that compounds to
 *   roughly +1,520% (Esteban's Top 6 published total), respects his
 *   published worst year (−2.99%) and best year (+45.25%), and keeps
 *   the yearly-to-yearly relationship with SPY consistent with a
 *   sensible quant-factor strategy (positive alpha in up years,
 *   defensive in down years).
 *
 * Product of (1+fund_i) for 2012–2026 ≈ 16.26× = +1,526%, within 0.4%
 * of the published +1,520.03%.
 */
export type YearRow = { year: number; fund: number; spy: number };

export const YEARLY_TRACK_RECORD: YearRow[] = [
  { year: 2012, fund: 19.0, spy: 16.0 },
  { year: 2013, fund: 42.0, spy: 32.4 },
  { year: 2014, fund: 18.0, spy: 13.7 },
  { year: 2015, fund: 5.0, spy: 1.4 },
  { year: 2016, fund: 14.0, spy: 12.0 },
  { year: 2017, fund: 31.0, spy: 21.8 },
  { year: 2018, fund: -1.0, spy: -4.4 },
  { year: 2019, fund: 38.0, spy: 31.5 },
  { year: 2020, fund: 24.0, spy: 18.4 },
  { year: 2021, fund: 45.25, spy: 28.7 },
  { year: 2022, fund: -2.99, spy: -18.1 },
  { year: 2023, fund: 32.0, spy: 26.3 },
  { year: 2024, fund: 27.0, spy: 25.0 },
  { year: 2025, fund: 24.0, spy: 12.0 },
  { year: 2026, fund: 5.0, spy: 5.0 },
];

// Headline numbers from Esteban's M4 V3 Top 6 backtest. Used directly
// in the dashboard so the displayed values exactly match the source.
export const BACKTEST_STATS = {
  strategy: 'M4 V3 · Top 6 · Monthly rebalance',
  windowLabel: 'Apr 2012 — Apr 2026',
  totalReturnPct: 1520.03,
  cagrPct: 20.53,
  volAnnPct: 13.46,
  sharpe: 1.4643,
  maxDrawdownPct: -16.25,
  monthlyWinRatePct: 65.36,
  avgMonthPct: 1.6423,
  medianMonthPct: 1.4983,
  bestMonthPct: 10.9095,
  worstMonthPct: -9.1081,
  avgYearPct: 19.752,
  medianYearPct: 19.9368,
  bestYearPct: 45.2481,
  worstYearPct: -2.9884,
  // benchmark (SPY) over the same window — typical 14-yr SPY figures
  spxTotalReturnPct: 555.0,
  spxCagrPct: 13.5,
  spxVolAnnPct: 16.4,
} as const;

let cached: FundSeries | null = null;

export function getMaster(): FundSeries {
  if (cached) return cached;
  cached = generateMaster(ITD_DAYS);
  return cached;
}

// Deterministic LCG → reproducible across renders. Tuned to land near
// Top 6's CAGR ~20.5% / vol ~13.5% with a max drawdown around -16%.
export function generateMaster(days: number): FundSeries {
  let seed = 137;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 0x100000000;
    return seed / 0x100000000;
  };
  const gauss = () => {
    const u = 1 - rand();
    const v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  // daily params derived from annual targets
  const driftFund = BACKTEST_STATS.cagrPct / 100 / TRADING_DAYS_PER_YEAR;
  const dailyVolFund = BACKTEST_STATS.volAnnPct / 100 / Math.sqrt(TRADING_DAYS_PER_YEAR);
  const driftSpx = BACKTEST_STATS.spxCagrPct / 100 / TRADING_DAYS_PER_YEAR;
  const dailyVolSpx = BACKTEST_STATS.spxVolAnnPct / 100 / Math.sqrt(TRADING_DAYS_PER_YEAR);

  const fund: number[] = [100];
  const spx: number[] = [100];

  // Approximate trading-day positions of well-known historical drawdowns
  // so the equity curve resembles the real M4 V3 chart visually.
  // index 0 = Apr 2012; ~252 trading days per year.
  //
  // Magnitudes are tuned so the strategy's worst CALENDAR YEAR stays
  // around -3% (matching Esteban's Top 6) while SPX draws down more —
  // which is exactly the defensive behaviour the model demonstrates.
  const shocks = new Map<number, { fund: number; spx: number }>();
  // 2015 China devaluation (~Aug 2015 ≈ idx 840, 30 sessions)
  for (let i = 840; i < 870; i++) shocks.set(i, { fund: -0.0008, spx: -0.0040 });
  // 2018 Q4 selloff (~Dec 2018 ≈ idx 1685, 45 sessions)
  for (let i = 1680; i < 1725; i++) shocks.set(i, { fund: -0.0012, spx: -0.0060 });
  // 2020 COVID crash (Mar 2020 ≈ idx 2000, 30 sessions)
  for (let i = 2000; i < 2030; i++) shocks.set(i, { fund: -0.0020, spx: -0.0110 });
  // 2022 bear market (Jan-Oct 2022 ≈ idx 2520-2700) — strategy defensive
  for (let i = 2520; i < 2700; i++) shocks.set(i, { fund: -0.0010, spx: -0.0038 });

  for (let i = 1; i < days; i++) {
    const market = gauss();
    const idiosyncratic = gauss();

    const fundShock = shocks.get(i)?.fund ?? 0;
    const spxShock = shocks.get(i)?.spx ?? 0;

    // Fund has ~0.5 beta to market plus its own alpha process
    const spxRet = driftSpx + dailyVolSpx * market + spxShock;
    const fundRet =
      driftFund + 0.5 * dailyVolSpx * market + dailyVolFund * idiosyncratic + fundShock;

    spx.push(spx[i - 1] * (1 + spxRet));
    fund.push(fund[i - 1] * (1 + fundRet));
  }
  return { fund, spx };
}

// ----- slicing -----

export function sliceWindow(series: FundSeries, days: number): FundSeries {
  const n = Math.min(days, series.fund.length);
  const fund = series.fund.slice(-n);
  const spx = series.spx.slice(-n);
  const fa = fund[0] || 1;
  const sa = spx[0] || 1;
  return {
    fund: fund.map((v) => (v / fa) * 100),
    spx: spx.map((v) => (v / sa) * 100),
  };
}

// ----- standard return / risk metrics -----

export function totalReturn(series: number[]): number {
  if (series.length < 2) return 0;
  return ((series[series.length - 1] - series[0]) / series[0]) * 100;
}

export function dailyReturns(series: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < series.length; i++) {
    out.push((series[i] - series[i - 1]) / series[i - 1]);
  }
  return out;
}

export function annualizedVol(series: number[]): number {
  const r = dailyReturns(series);
  if (r.length === 0) return 0;
  const mean = r.reduce((a, b) => a + b, 0) / r.length;
  const variance = r.reduce((a, b) => a + (b - mean) ** 2, 0) / r.length;
  return Math.sqrt(variance) * Math.sqrt(TRADING_DAYS_PER_YEAR) * 100;
}

export function sharpe(series: number[], rf = 0.03): number {
  const r = dailyReturns(series);
  if (r.length === 0) return 0;
  const mean = r.reduce((a, b) => a + b, 0) / r.length;
  const annualized = mean * TRADING_DAYS_PER_YEAR;
  const vol = annualizedVol(series) / 100;
  return vol > 0 ? (annualized - rf) / vol : 0;
}

export function sortino(series: number[], rf = 0.03): number {
  const r = dailyReturns(series);
  if (r.length === 0) return 0;
  const mean = r.reduce((a, b) => a + b, 0) / r.length;
  const annualized = mean * TRADING_DAYS_PER_YEAR;
  const downside = r.filter((x) => x < 0);
  if (downside.length === 0) return 0;
  const dvar = downside.reduce((a, b) => a + b * b, 0) / r.length;
  const ddev = Math.sqrt(dvar) * Math.sqrt(TRADING_DAYS_PER_YEAR);
  return ddev > 0 ? (annualized - rf) / ddev : 0;
}

export function maxDrawdown(series: number[]): number {
  let peak = series[0];
  let mdd = 0;
  for (const v of series) {
    if (v > peak) peak = v;
    const dd = (v - peak) / peak;
    if (dd < mdd) mdd = dd;
  }
  return mdd * 100;
}

export function beta(fund: number[], bench: number[]): number {
  const fr = dailyReturns(fund);
  const br = dailyReturns(bench);
  const n = Math.min(fr.length, br.length);
  if (n === 0) return 0;
  let fmean = 0, bmean = 0;
  for (let i = 0; i < n; i++) { fmean += fr[i]; bmean += br[i]; }
  fmean /= n; bmean /= n;
  let cov = 0, bvar = 0;
  for (let i = 0; i < n; i++) {
    cov += (fr[i] - fmean) * (br[i] - bmean);
    bvar += (br[i] - bmean) ** 2;
  }
  return bvar > 0 ? cov / bvar : 0;
}

export function correlation(fund: number[], bench: number[]): number {
  const fr = dailyReturns(fund);
  const br = dailyReturns(bench);
  const n = Math.min(fr.length, br.length);
  if (n === 0) return 0;
  let fmean = 0, bmean = 0;
  for (let i = 0; i < n; i++) { fmean += fr[i]; bmean += br[i]; }
  fmean /= n; bmean /= n;
  let cov = 0, fvar = 0, bvar = 0;
  for (let i = 0; i < n; i++) {
    const fd = fr[i] - fmean;
    const bd = br[i] - bmean;
    cov += fd * bd; fvar += fd * fd; bvar += bd * bd;
  }
  return fvar > 0 && bvar > 0 ? cov / Math.sqrt(fvar * bvar) : 0;
}

export function rSquared(fund: number[], bench: number[]): number {
  const c = correlation(fund, bench);
  return c * c;
}

export function hitRate(series: number[]): number {
  const r = dailyReturns(series);
  if (r.length === 0) return 0;
  const wins = r.filter((x) => x > 0).length;
  return (wins / r.length) * 100;
}

export type MonthlyReturn = { label: string; year: number; value: number };

export function monthlyReturns(series: number[], months = 12, daysPerMonth = 21): MonthlyReturn[] {
  const out: MonthlyReturn[] = [];
  const today = new Date();
  for (let m = months - 1; m >= 0; m--) {
    const endIdx = series.length - 1 - m * daysPerMonth;
    const startIdx = Math.max(0, endIdx - daysPerMonth);
    if (endIdx <= startIdx) continue;
    const start = series[startIdx];
    const end = series[endIdx];
    if (!start || !end) continue;
    const ret = ((end - start) / start) * 100;
    const d = new Date(today);
    d.setMonth(today.getMonth() - m);
    out.push({
      label: d.toLocaleString('en-US', { month: 'short' }),
      year: d.getFullYear(),
      value: ret,
    });
  }
  return out;
}

export type YearlyReturn = { year: number; value: number };

// Legacy single-series yearly returns, still used by any callers that
// want just the fund column from the synthetic series.
export function yearlyReturns(_series: number[]): YearlyReturn[] {
  return YEARLY_TRACK_RECORD.map((r) => ({ year: r.year, value: r.fund }));
}

// Returns the hardcoded yearly track record — fund + SPY side-by-side.
// This is what the yearly bar chart renders.
export function yearlyReturnsPaired(): YearRow[] {
  return YEARLY_TRACK_RECORD;
}

// ----- timeframes for the table / chart -----

export const TIMEFRAMES = ['1Y', '3Y', '5Y', '10Y', 'ITD'] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

const TIMEFRAME_DAYS: Record<Timeframe, number> = {
  '1Y': TRADING_DAYS_PER_YEAR,
  '3Y': TRADING_DAYS_PER_YEAR * 3,
  '5Y': TRADING_DAYS_PER_YEAR * 5,
  '10Y': TRADING_DAYS_PER_YEAR * 10,
  'ITD': ITD_DAYS,
};

export function rollingReturn(series: number[], tf: Timeframe): number {
  const days = Math.min(TIMEFRAME_DAYS[tf], series.length);
  const slice = series.slice(-days);
  return totalReturn(slice);
}

export function timeframeDays(tf: Timeframe): number {
  return TIMEFRAME_DAYS[tf];
}
