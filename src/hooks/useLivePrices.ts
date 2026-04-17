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
  symbol: string;       // canonical symbol shown in UI
  yahoo?: string;       // override symbol for Yahoo lookup (e.g. ^GSPC)
  coingeckoId?: string; // CoinGecko id for crypto
  label: string;
  basePrice: number;
  category: 'index' | 'equity' | 'crypto';
  decimals: number;
  prefix?: string;
  vol: number;
};

const universe: Asset[] = [
  { symbol: '^GSPC',   yahoo: '^GSPC',   label: 'S&P 500',     basePrice: 5240,  category: 'index',  decimals: 2, vol: 0.008 },
  { symbol: '^NDX',    yahoo: '^NDX',    label: 'Nasdaq 100',  basePrice: 18420, category: 'index',  decimals: 2, vol: 0.011 },
  { symbol: '^DJI',    yahoo: '^DJI',    label: 'Dow Jones',   basePrice: 39800, category: 'index',  decimals: 2, vol: 0.007 },
  { symbol: 'AAPL',    yahoo: 'AAPL',    label: 'Apple',       basePrice: 222,   category: 'equity', decimals: 2, prefix: '$', vol: 0.014 },
  { symbol: 'MSFT',    yahoo: 'MSFT',    label: 'Microsoft',   basePrice: 425,   category: 'equity', decimals: 2, prefix: '$', vol: 0.013 },
  { symbol: 'NVDA',    yahoo: 'NVDA',    label: 'Nvidia',      basePrice: 132,   category: 'equity', decimals: 2, prefix: '$', vol: 0.026 },
  { symbol: 'GOOGL',   yahoo: 'GOOGL',   label: 'Alphabet',    basePrice: 168,   category: 'equity', decimals: 2, prefix: '$', vol: 0.015 },
  { symbol: 'META',    yahoo: 'META',    label: 'Meta',        basePrice: 525,   category: 'equity', decimals: 2, prefix: '$', vol: 0.018 },
  { symbol: 'TSLA',    yahoo: 'TSLA',    label: 'Tesla',       basePrice: 248,   category: 'equity', decimals: 2, prefix: '$', vol: 0.030 },
  { symbol: 'AMZN',    yahoo: 'AMZN',    label: 'Amazon',      basePrice: 188,   category: 'equity', decimals: 2, prefix: '$', vol: 0.016 },
  { symbol: 'BTC-USD', coingeckoId: 'bitcoin',  label: 'Bitcoin',  basePrice: 67000, category: 'crypto', decimals: 0, prefix: '$', vol: 0.022 },
  { symbol: 'ETH-USD', coingeckoId: 'ethereum', label: 'Ethereum', basePrice: 3450,  category: 'crypto', decimals: 0, prefix: '$', vol: 0.025 },
];

function seedQuotes(): Quote[] {
  return universe.map((a) => {
    const driftSeed = (hash(a.symbol) % 200 - 100) / 100;
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
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function tickQuote(q: Quote): Quote {
  const a = universe.find((x) => x.symbol === q.symbol);
  if (!a) return q;
  // Tiny intraday step for visual liveness between real fetches.
  // Smaller than the 30s real refresh so it never drifts far from truth.
  const step = gauss() * a.vol * 0.04;
  const newPrice = Math.max(0.01, q.price * (1 + step));
  const change = newPrice - q.prevClose;
  return {
    ...q,
    price: newPrice,
    change,
    changePct: q.prevClose ? (change / q.prevClose) * 100 : q.changePct,
  };
}

type ApiQuote = {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  prevClose: number;
  currency?: string;
  isLive: boolean;
};

async function fetchQuotesFromApi(): Promise<ApiQuote[]> {
  const equitySymbols = universe
    .filter((a) => a.category !== 'crypto' && a.yahoo)
    .map((a) => a.yahoo!);
  const cryptoIds = universe
    .filter((a) => a.category === 'crypto' && a.coingeckoId)
    .map((a) => a.coingeckoId!);

  const [equities, crypto] = await Promise.allSettled([
    fetch(`/api/quotes?symbols=${encodeURIComponent(equitySymbols.join(','))}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('quotes ' + r.status)))),
    fetch(`/api/crypto?ids=${encodeURIComponent(cryptoIds.join(','))}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('crypto ' + r.status)))),
  ]);

  const out: ApiQuote[] = [];
  if (equities.status === 'fulfilled' && Array.isArray(equities.value?.quotes)) {
    out.push(...equities.value.quotes);
  }
  if (crypto.status === 'fulfilled' && Array.isArray(crypto.value?.quotes)) {
    out.push(...crypto.value.quotes);
  }
  return out;
}

export function useLivePrices() {
  const [quotes, setQuotes] = useState<Quote[]>(() => seedQuotes());
  const [hasReal, setHasReal] = useState(false);
  const lastRealAt = useRef<number>(0);

  // Fetch real prices on mount and every 30s thereafter.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const refresh = async () => {
      try {
        const incoming = await fetchQuotesFromApi();
        if (cancelled || incoming.length === 0) return;
        lastRealAt.current = Date.now();
        setHasReal(true);
        setQuotes((prev) =>
          prev.map((q) => {
            const upd = incoming.find((u) => u.symbol === q.symbol);
            if (!upd) return q;
            return {
              ...q,
              price: upd.price,
              change: upd.change,
              changePct: upd.changePct,
              prevClose: upd.prevClose,
              isLive: true,
            };
          })
        );
      } catch (e) {
        // swallow — simulator keeps the UI alive
        console.warn('[live] refresh failed:', e);
      }
    };

    refresh();
    timer = setInterval(refresh, 30_000);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, []);

  // Tick simulator every 2.5s for between-fetch micro-movement.
  useEffect(() => {
    const id = setInterval(() => {
      setQuotes((prev) => prev.map(tickQuote));
    }, 2500);
    return () => clearInterval(id);
  }, []);

  return { quotes, hasReal, lastRealAt: lastRealAt.current };
}

export function formatPrice(q: Quote): string {
  const opts: Intl.NumberFormatOptions = {
    minimumFractionDigits: q.decimals,
    maximumFractionDigits: q.decimals,
  };
  return `${q.prefix ?? ''}${new Intl.NumberFormat('en-US', opts).format(q.price)}`;
}

export function formatChange(q: Quote): string {
  const sign = q.changePct >= 0 ? '+' : '';
  return `${sign}${q.changePct.toFixed(2)}%`;
}
