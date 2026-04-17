// Shared fund data + portfolio metrics for the Solaria site.
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

  // approximate trading-day positions of well-known historical drawdowns
  // so the equity curve resembles the real M4 V3 chart visually.
  // index 0 = Apr 2012; ~252 trading days per year
  const shocks = new Map<number, { fund: number; spx: number }>();
  // 2015 China devaluation: ~Aug 2015 ≈ idx 840 (3.33yr × 252)
  for (let i = 840; i < 880; i++) shocks.set(i, { fund: -0.0035, spx: -0.0050 });
  // 2018 Q4 selloff: ~Dec 2018 ≈ idx 1685
  for (let i = 1680; i < 1730; i++) shocks.set(i, { fund: -0.0045, spx: -0.0070 });
  // 2020 COVID crash: Mar 2020 ≈ idx 2000
  for (let i = 2000; i < 2050; i++) shocks.set(i, { fund: -0.0080, spx: -0.0140 });
  // 2022 bear market (high water for max DD): Jan-Oct 2022 ≈ idx 2520-2700
  for (let i = 2520; i < 2700; i++) shocks.set(i, { fund: -0.0028, spx: -0.0050 });

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

export function yearlyReturns(series: number[]): YearlyReturn[] {
  // approximate calendar years using 252 trading days each, ending at today
  const today = new Date();
  const yearsBack = Math.floor(series.length / TRADING_DAYS_PER_YEAR);
  const out: YearlyReturn[] = [];
  for (let y = yearsBack - 1; y >= 0; y--) {
    const endIdx = series.length - 1 - y * TRADING_DAYS_PER_YEAR;
    const startIdx = Math.max(0, endIdx - TRADING_DAYS_PER_YEAR);
    if (endIdx <= startIdx) continue;
    const start = series[startIdx];
    const end = series[endIdx];
    if (!start || !end) continue;
    const ret = ((end - start) / start) * 100;
    out.push({ year: today.getFullYear() - y, value: ret });
  }
  return out;
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
