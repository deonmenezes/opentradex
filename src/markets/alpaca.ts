/** Alpaca connector for stocks/ETFs with paper trading support */

import type { Market, MarketConnector, Quote, OrderBook, Order, TradeResult } from '../types.js';
import { httpGet, retry } from './base.js';

const PAPER_BASE = 'https://paper-api.alpaca.markets';
const LIVE_BASE = 'https://api.alpaca.markets';
const DATA_BASE = 'https://data.alpaca.markets';

interface AlpacaConfig {
  apiKey?: string;
  secretKey?: string;
  paper?: boolean; // Default true
}

interface AlpacaAsset {
  id: string;
  symbol: string;
  name: string;
  exchange: string;
  tradable: boolean;
}

interface AlpacaBar {
  t: string; // timestamp
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
  v: number; // volume
}

interface AlpacaQuote {
  ap: number; // ask price
  as: number; // ask size
  bp: number; // bid price
  bs: number; // bid size
  t: string;  // timestamp
}

interface AlpacaSnapshot {
  latestTrade: { p: number; s: number; t: string };
  latestQuote: AlpacaQuote;
  minuteBar: AlpacaBar;
  dailyBar: AlpacaBar;
}

// Popular tickers to scan
const POPULAR_TICKERS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B',
  'JPM', 'V', 'UNH', 'XOM', 'MA', 'HD', 'PG', 'JNJ',
  'SPY', 'QQQ', 'IWM', 'DIA', 'VTI', 'VOO', 'ARKK', 'XLF',
];

export function createAlpacaConnector(config: AlpacaConfig = {}): MarketConnector {
  const paper = config.paper !== false; // Default to paper
  const baseUrl = paper ? PAPER_BASE : LIVE_BASE;

  const headers: Record<string, string> = config.apiKey && config.secretKey
    ? {
        'APCA-API-KEY-ID': config.apiKey,
        'APCA-API-SECRET-KEY': config.secretKey,
      }
    : {};

  // Helper for authenticated requests
  async function alpacaGet<T>(url: string): Promise<T> {
    return httpGet<T>(url, headers);
  }

  return {
    name: 'alpaca' as const,

    async scan(limit = 40): Promise<Market[]> {
      // If we have API keys, get account assets
      if (config.apiKey) {
        try {
          const assets = await retry(() =>
            alpacaGet<AlpacaAsset[]>(`${baseUrl}/v2/assets?status=active&asset_class=us_equity`)
          );

          const tradable = assets
            .filter(a => a.tradable)
            .slice(0, limit);

          // Get snapshots for price data
          const symbols = tradable.map(a => a.symbol).join(',');
          const snapshots = await retry(() =>
            alpacaGet<Record<string, AlpacaSnapshot>>(
              `${DATA_BASE}/v2/stocks/snapshots?symbols=${symbols}`
            )
          );

          return tradable.map(a => {
            const snap = snapshots[a.symbol];
            return {
              id: a.id,
              exchange: 'alpaca' as const,
              symbol: a.symbol,
              title: a.name,
              price: snap?.latestTrade?.p ?? 0,
              volume: snap?.dailyBar?.v ?? 0,
              url: `https://alpaca.markets/stocks/${a.symbol}`,
              meta: { exchange: a.exchange, paper },
            };
          });
        } catch {
          // Fall through to public data
        }
      }

      // Without API keys, use public data endpoint for popular tickers
      const symbols = POPULAR_TICKERS.slice(0, limit);
      const markets: Market[] = [];

      for (const symbol of symbols) {
        try {
          const snap = await retry(() =>
            httpGet<{ bars: Record<string, AlpacaBar[]> }>(
              `${DATA_BASE}/v2/stocks/${symbol}/bars?timeframe=1Day&limit=1`
            )
          );
          const bar = snap.bars?.[symbol]?.[0];
          if (bar) {
            markets.push({
              id: symbol,
              exchange: 'alpaca',
              symbol,
              title: symbol,
              price: bar.c,
              volume: bar.v,
              url: `https://alpaca.markets/stocks/${symbol}`,
              meta: { paper },
            });
          }
        } catch {
          // Skip failed symbols
        }
      }

      return markets;
    },

    async search(query: string): Promise<Market[]> {
      const q = query.toUpperCase();

      // Check if query matches any popular tickers
      const matches = POPULAR_TICKERS.filter(
        t => t.includes(q) || q.includes(t)
      );

      if (matches.length === 0) {
        // Try exact symbol lookup
        matches.push(q);
      }

      const markets: Market[] = [];
      for (const symbol of matches.slice(0, 10)) {
        try {
          const snap = await retry(() =>
            httpGet<Record<string, AlpacaSnapshot>>(
              `${DATA_BASE}/v2/stocks/snapshots?symbols=${symbol}`
            )
          );
          const data = snap[symbol];
          if (data) {
            markets.push({
              id: symbol,
              exchange: 'alpaca',
              symbol,
              title: symbol,
              price: data.latestTrade?.p ?? 0,
              volume: data.dailyBar?.v ?? 0,
              url: `https://alpaca.markets/stocks/${symbol}`,
              meta: { paper },
            });
          }
        } catch {
          // Skip failed symbols
        }
      }

      return markets;
    },

    async quote(symbol: string): Promise<Quote> {
      const snap = await retry(() =>
        httpGet<Record<string, AlpacaSnapshot>>(
          `${DATA_BASE}/v2/stocks/snapshots?symbols=${symbol.toUpperCase()}`
        )
      );

      const data = snap[symbol.toUpperCase()];
      if (!data) throw new Error(`Quote not found: ${symbol}`);

      const ob: OrderBook | undefined = data.latestQuote
        ? {
            bids: [{ price: data.latestQuote.bp, size: data.latestQuote.bs }],
            asks: [{ price: data.latestQuote.ap, size: data.latestQuote.as }],
            spread: data.latestQuote.ap - data.latestQuote.bp,
            midPrice: (data.latestQuote.ap + data.latestQuote.bp) / 2,
          }
        : undefined;

      return {
        market: {
          id: symbol.toUpperCase(),
          exchange: 'alpaca',
          symbol: symbol.toUpperCase(),
          title: symbol.toUpperCase(),
          price: data.latestTrade?.p ?? 0,
          volume: data.dailyBar?.v ?? 0,
          url: `https://alpaca.markets/stocks/${symbol}`,
          meta: {
            paper,
            dailyHigh: data.dailyBar?.h,
            dailyLow: data.dailyBar?.l,
            dailyOpen: data.dailyBar?.o,
          },
        },
        orderbook: ob,
        timestamp: Date.now(),
      };
    },

    async orderbook(symbol: string): Promise<OrderBook> {
      const snap = await retry(() =>
        httpGet<Record<string, AlpacaSnapshot>>(
          `${DATA_BASE}/v2/stocks/snapshots?symbols=${symbol.toUpperCase()}`
        )
      );

      const data = snap[symbol.toUpperCase()];
      if (!data?.latestQuote) throw new Error(`Orderbook not found: ${symbol}`);

      const q = data.latestQuote;
      return {
        bids: [{ price: q.bp, size: q.bs }],
        asks: [{ price: q.ap, size: q.as }],
        spread: q.ap - q.bp,
        midPrice: (q.ap + q.bp) / 2,
      };
    },

    async execute(order: Order): Promise<TradeResult> {
      // TODO: Implement Alpaca V2 order placement
      throw new Error('Live execution not implemented for Alpaca');
    },
  };
}
