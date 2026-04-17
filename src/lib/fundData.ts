// Shared synthetic fund data + standard portfolio metrics.
// Until the fund has real performance data, every chart, table, and stat on
// the site derives from the same deterministic series so the numbers are
// internally consistent — Sharpe in the dashboard matches Sharpe in the
// chart legend, monthly heatmap matches the rolling-return table, etc.

export type FundSeries = { fund: number[]; spx: number[] };

const ITD_DAYS = 320;

let cached: FundSeries | null = null;

export function getMaster(): FundSeries {
  if (cached) return cached;
  cached = generateMaster(ITD_DAYS);
  return cached;
}

export function generateMaster(days: number): FundSeries {
  // deterministic LCG for reproducibility across renders
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
  const driftFund = 0.18 / 252; // ~18% annual
  const driftSpx = 0.08 / 252; // ~8% annual

  const fund: number[] = [100];
  const spx: number[] = [100];

  for (let i = 1; i < days; i++) {
    const market = gauss();
    const idiosyncratic = gauss();
    const spxRet = driftSpx + dailyVolSpx * market;
    const fundRet =
      driftFund + 0.4 * dailyVolSpx * market + dailyVolFund * idiosyncratic;
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
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

export function sharpe(series: number[], rf = 0.03): number {
  const r = dailyReturns(series);
  if (r.length === 0) return 0;
  const mean = r.reduce((a, b) => a + b, 0) / r.length;
  const annualized = mean * 252;
  const vol = annualizedVol(series) / 100;
  return vol > 0 ? (annualized - rf) / vol : 0;
}

export function sortino(series: number[], rf = 0.03): number {
  const r = dailyReturns(series);
  if (r.length === 0) return 0;
  const mean = r.reduce((a, b) => a + b, 0) / r.length;
  const annualized = mean * 252;
  const downside = r.filter((x) => x < 0);
  if (downside.length === 0) return 0;
  const dvar = downside.reduce((a, b) => a + b * b, 0) / r.length;
  const ddev = Math.sqrt(dvar) * Math.sqrt(252);
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
  let fmean = 0,
    bmean = 0;
  for (let i = 0; i < n; i++) {
    fmean += fr[i];
    bmean += br[i];
  }
  fmean /= n;
  bmean /= n;
  let cov = 0,
    bvar = 0;
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
  let fmean = 0,
    bmean = 0;
  for (let i = 0; i < n; i++) {
    fmean += fr[i];
    bmean += br[i];
  }
  fmean /= n;
  bmean /= n;
  let cov = 0,
    fvar = 0,
    bvar = 0;
  for (let i = 0; i < n; i++) {
    const fd = fr[i] - fmean;
    const bd = br[i] - bmean;
    cov += fd * bd;
    fvar += fd * fd;
    bvar += bd * bd;
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

// ----- helpers for the rolling returns table -----

export const TIMEFRAMES = ['1M', '3M', 'YTD', '1Y', 'ITD'] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

const TIMEFRAME_DAYS: Record<Timeframe, number> = {
  '1M': 22,
  '3M': 66,
  'YTD': 78,
  '1Y': 252,
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
