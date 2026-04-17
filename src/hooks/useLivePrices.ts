import { useEffect, useRef, useState } from 'react';

export type Quote = {
  symbol: string;
  label: string;
  price: number;
  change: number;
  changePct: number;
  prevClose: number;
  isLive: boolean;
  category: 'index' | 'equity' | 'crypto';
  decimals: number;
  prefix?: string;
};

type Asset = {
  symbol: string;
  label: string;
  basePrice: number;
  category: 'index' | 'equity' | 'crypto';
  decimals: number;
  prefix?: string;
  vol: number; // daily-ish volatility for sim
};

const universe: Asset[] = [
  { symbol: '^GSPC',   label: 'S&P 500',     basePrice: 5240,  category: 'index',  decimals: 2, vol: 0.008 },
  { symbol: '^NDX',    label: 'Nasdaq 100',  basePrice: 18420, category: 'index',  decimals: 2, vol: 0.011 },
  { symbol: '^DJI',    label: 'Dow Jones',   basePrice: 39800, category: 'index',  decimals: 2, vol: 0.007 },
  { symbol: 'AAPL',    label: 'Apple',       basePrice: 222,   category: 'equity', decimals: 2, prefix: '$', vol: 0.014 },
  { symbol: 'MSFT',    label: 'Microsoft',   basePrice: 425,   category: 'equity', decimals: 2, prefix: '$', vol: 0.013 },
  { symbol: 'NVDA',    label: 'Nvidia',      basePrice: 132,   category: 'equity', decimals: 2, prefix: '$', vol: 0.026 },
  { symbol: 'GOOGL',   label: 'Alphabet',    basePrice: 168,   category: 'equity', decimals: 2, prefix: '$', vol: 0.015 },
  { symbol: 'META',    label: 'Meta',        basePrice: 525,   category: 'equity', decimals: 2, prefix: '$', vol: 0.018 },
  { symbol: 'TSLA',    label: 'Tesla',       basePrice: 248,   category: 'equity', decimals: 2, prefix: '$', vol: 0.030 },
  { symbol: 'AMZN',    label: 'Amazon',      basePrice: 188,   category: 'equity', decimals: 2, prefix: '$', vol: 0.016 },
  { symbol: 'BTC-USD', label: 'Bitcoin',     basePrice: 67000, category: 'crypto', decimals: 0, prefix: '$', vol: 0.022 },
  { symbol: 'ETH-USD', label: 'Ethereum',    basePrice: 3450,  category: 'crypto', decimals: 0, prefix: '$', vol: 0.025 },
];

function seedQuotes(): Quote[] {
  return universe.map((a) => {
    // start each session with a small random session-day offset
    const driftSeed = (hash(a.symbol) % 200 - 100) / 100; // -1..1
    const sessionMove = driftSeed * a.vol * 0.6;
    const price = a.basePrice * (1 + sessionMove);
    const change = price - a.basePrice;
    return {
      symbol: a.symbol,
      label: a.label,
      price,
      change,
      changePct: (change / a.basePrice) * 100,
      prevClose: a.basePrice,
      isLive: false,
      category: a.category,
      decimals: a.decimals,
      prefix: a.prefix,
    };
  });
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function gauss(): number {
  // Box-Muller
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function tickQuote(q: Quote): Quote {
  const a = universe.find((x) => x.symbol === q.symbol)!;
  // small intraday step
  const step = gauss() * a.vol * 0.06;
  const newPrice = Math.max(0.01, q.price * (1 + step));
  const change = newPrice - q.prevClose;
  return {
    ...q,
    price: newPrice,
    change,
    changePct: (change / q.prevClose) * 100,
  };
}

async function tryFetchCoinGecko(): Promise<Partial<Quote>[] | null> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true',
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return null;
    const j: { bitcoin?: { usd: number; usd_24h_change: number }; ethereum?: { usd: number; usd_24h_change: number } } = await res.json();
    const out: Partial<Quote>[] = [];
    if (j.bitcoin) {
      out.push({
        symbol: 'BTC-USD',
        price: j.bitcoin.usd,
        changePct: j.bitcoin.usd_24h_change ?? 0,
        change: (j.bitcoin.usd * (j.bitcoin.usd_24h_change ?? 0)) / 100,
        prevClose: j.bitcoin.usd / (1 + (j.bitcoin.usd_24h_change ?? 0) / 100),
        isLive: true,
      });
    }
    if (j.ethereum) {
      out.push({
        symbol: 'ETH-USD',
        price: j.ethereum.usd,
        changePct: j.ethereum.usd_24h_change ?? 0,
        change: (j.ethereum.usd * (j.ethereum.usd_24h_change ?? 0)) / 100,
        prevClose: j.ethereum.usd / (1 + (j.ethereum.usd_24h_change ?? 0) / 100),
        isLive: true,
      });
    }
    return out;
  } catch {
    return null;
  }
}

async function tryFetchYahoo(symbols: string[]): Promise<Partial<Quote>[] | null> {
  const yahooUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(',')}`;
  // Try direct first (rare CORS support), then fall back to a public proxy.
  const targets = [yahooUrl, `https://corsproxy.io/?${encodeURIComponent(yahooUrl)}`];
  for (const url of targets) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) continue;
      const j: { quoteResponse?: { result?: YahooQuote[] } } = await res.json();
      const list = j?.quoteResponse?.result;
      if (!Array.isArray(list) || list.length === 0) continue;
      return list.map((q): Partial<Quote> => ({
        symbol: q.symbol,
        price: q.regularMarketPrice ?? 0,
        change: q.regularMarketChange ?? 0,
        changePct: q.regularMarketChangePercent ?? 0,
        prevClose: q.regularMarketPreviousClose ?? 0,
        isLive: true,
      }));
    } catch {
      continue;
    }
  }
  return null;
}

type YahooQuote = {
  symbol: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  regularMarketPreviousClose?: number;
};

export function useLivePrices() {
  const [quotes, setQuotes] = useState<Quote[]>(() => seedQuotes());
  const [hasReal, setHasReal] = useState(false);
  const realLastFetched = useRef<number>(0);

  // fetch real prices on mount + every 60s
  useEffect(() => {
    let cancelled = false;

    const fetchReal = async () => {
      const equitySymbols = universe
        .filter((a) => a.category !== 'crypto')
        .map((a) => a.symbol);

      const [yahoo, coingecko] = await Promise.all([
        tryFetchYahoo(equitySymbols),
        tryFetchCoinGecko(),
      ]);

      if (cancelled) return;
      const incoming = [...(yahoo ?? []), ...(coingecko ?? [])];
      if (incoming.length === 0) return;
      realLastFetched.current = Date.now();
      setHasReal(true);
      setQuotes((prev) =>
        prev.map((q) => {
          const upd = incoming.find((u) => u.symbol === q.symbol);
          if (!upd) return q;
          return {
            ...q,
            price: upd.price ?? q.price,
            change: upd.change ?? q.change,
            changePct: upd.changePct ?? q.changePct,
            prevClose: upd.prevClose ?? q.prevClose,
            isLive: true,
          };
        })
      );
    };

    fetchReal();
    const interval = setInterval(fetchReal, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // simulate ticks every ~2.5s for liveness
  useEffect(() => {
    const id = setInterval(() => {
      setQuotes((prev) => prev.map(tickQuote));
    }, 2500);
    return () => clearInterval(id);
  }, []);

  return { quotes, hasReal };
}

export function formatPrice(q: Quote): string {
  const p = q.price;
  const opts: Intl.NumberFormatOptions = {
    minimumFractionDigits: q.decimals,
    maximumFractionDigits: q.decimals,
  };
  const formatted = new Intl.NumberFormat('en-US', opts).format(p);
  return `${q.prefix ?? ''}${formatted}`;
}

export function formatChange(q: Quote): string {
  const sign = q.changePct >= 0 ? '+' : '';
  return `${sign}${q.changePct.toFixed(2)}%`;
}
