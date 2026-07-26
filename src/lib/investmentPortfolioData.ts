/** Placeholder until live trading data is posted. Holdings mirror the MAG 7 universe in the M5V_3 paper. */
export const INVESTMENT_PORTFOLIO_HOLDINGS = [
  { ticker: 'AAPL', name: 'Apple' },
  { ticker: 'AMZN', name: 'Amazon' },
  { ticker: 'GOOGL', name: 'Alphabet' },
  { ticker: 'META', name: 'Meta' },
  { ticker: 'MSFT', name: 'Microsoft' },
  { ticker: 'NVDA', name: 'Nvidia' },
  { ticker: 'TSLA', name: 'Tesla' },
] as const;

/**
 * Backtest window and stats from Table 1, Solaria MAG7 Family (M5V_3).
 * Select is shown — the paper's strongest risk/return blend vs. MAGS ETF.
 */
export const INVESTMENT_PORTFOLIO = {
  /** Opens an HTML viewer tab that embeds the PDF (avoids forced download). */
  paperUrl: '/research/solaria-family-model-m5v3.html',
  paperPdfUrl: '/research/solaria-family-model-m5v3.pdf',
  chartSrc: '/investment-portfolio/growth-of-one.png',
  chartAlt:
    'Growth of $1 for Solaria Core, Select, and Max compared to the MAGS ETF, May 2023 through May 2026',
  windowLabel: 'Apr 2023 → May 2026',
  modelLabel: 'Solaria MAG7 Family · Select',
  cagrPct: 46.51,
  sharpe: 1.587,
  holdingsNote: 'MAG 7 names shown as placeholder until live positions are published.',
} as const;
