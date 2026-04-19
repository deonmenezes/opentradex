/**
 * Exchange Scraper — pulls live event/market data from Kalshi, Polymarket, and crypto exchanges.
 *
 * Sources (public APIs, no auth required for reads):
 *  - Polymarket CLOB API
 *  - Kalshi public API
 *  - Binance public ticker
 */

import { smartFetch } from './fetcher.js';
import type { ScrapedExchangeEvent } from './types.js';

// ── Polymarket ─────────────────────────────────────────────────────

interface PolymarketEvent {
  id: string;
  slug: string;
  title: string;
  end_date_iso?: string;
  markets: Array<{
    id: string;
    question: string;
    outcomePrices: string;
    volume: string;
    clobTokenIds?: string;
  }>;
}

export async function scrapePolymarket(limit = 20): Promise<ScrapedExchangeEvent[]> {
  const url = `https://gamma-api.polymarket.com/events?closed=false&limit=${limit}&order=volume24hr&ascending=false`;

  try {
    const res = await smartFetch(url);
    if (!res.ok) return [];

    const events = res.json<PolymarketEvent[]>();
    const results: ScrapedExchangeEvent[] = [];

    for (const event of events) {
      for (const market of event.markets) {
        let yesPrice = 0.5;
        let noPrice = 0.5;
        try {
          const prices = JSON.parse(market.outcomePrices || '[]');
          yesPrice = parseFloat(prices[0]) || 0.5;
          noPrice = parseFloat(prices[1]) || 1 - yesPrice;
        } catch { /* use defaults */ }

        results.push({
          id: `poly-${market.id}`,
          exchange: 'polymarket',
          symbol: event.slug || market.id,
          title: market.question || event.title,
          price: yesPrice,
          yesPrice,
          noPrice,
          volume: parseFloat(market.volume) || 0,
          endDate: event.end_date_iso,
          category: 'prediction',
          url: `https://polymarket.com/event/${event.slug}`,
          timestamp: Date.now(),
        });
      }
    }

    return results;
  } catch (err) {
    console.error('[Scraper] Polymarket error:', err instanceof Error ? err.message : err);
    return [];
  }
}

// ── Kalshi ──────────────────────────────────────────────────────────

interface KalshiMarket {
  ticker: string;
  title: string;
  status?: string;
  // New schema (2025+): prices are decimal-dollar strings.
  yes_bid_dollars?: string;
  yes_ask_dollars?: string;
  no_bid_dollars?: string;
  no_ask_dollars?: string;
  last_price_dollars?: string;
  liquidity_dollars?: string;
  notional_value_dollars?: string;
  volume_fp?: number | string;
  volume_24h_fp?: number | string;
  open_interest_fp?: number | string;
  // Legacy fallback (cents, integer) — kept in case older endpoints still respond that way.
  yes_bid?: number;
  yes_ask?: number;
  no_bid?: number;
  no_ask?: number;
  last_price?: number;
  volume?: number;
  close_time?: string;
}

interface KalshiEvent {
  event_ticker: string;
  title: string;
  category: string;
  markets: KalshiMarket[];
}

/** Coerce a Kalshi price field to a 0–1 probability. Handles dollar-string, cent-int, or missing. */
function kalshiPrice(dollars: string | undefined, cents: number | undefined): number {
  if (dollars != null && dollars !== '') {
    const n = parseFloat(dollars);
    if (Number.isFinite(n)) return n;
  }
  if (typeof cents === 'number' && Number.isFinite(cents)) return cents / 100;
  return 0;
}

function kalshiNumber(...candidates: Array<number | string | undefined>): number {
  for (const c of candidates) {
    if (c == null || c === '') continue;
    const n = typeof c === 'string' ? parseFloat(c) : c;
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

export async function scrapeKalshi(limit = 20): Promise<ScrapedExchangeEvent[]> {
  const url = `https://api.elections.kalshi.com/trade-api/v2/events?limit=${limit}&status=open&with_nested_markets=true`;

  try {
    const res = await smartFetch(url);
    if (!res.ok) return [];

    const data = res.json<{ events?: KalshiEvent[] }>();
    const events = data?.events ?? [];
    const results: ScrapedExchangeEvent[] = [];

    for (const event of events) {
      for (const market of event.markets) {
        const yesBid = kalshiPrice(market.yes_bid_dollars, market.yes_bid);
        const yesAsk = kalshiPrice(market.yes_ask_dollars, market.yes_ask);
        const noBid = kalshiPrice(market.no_bid_dollars, market.no_bid);
        const noAsk = kalshiPrice(market.no_ask_dollars, market.no_ask);
        const last = kalshiPrice(market.last_price_dollars, market.last_price);

        // Midpoint quotes — fall back to last trade if the book is one-sided or empty.
        const yesPrice = yesBid && yesAsk ? (yesBid + yesAsk) / 2 : last || yesAsk || yesBid || 0;
        const noPrice = noBid && noAsk ? (noBid + noAsk) / 2 : (1 - yesPrice) || 0;

        // Prefer 24h rolling volume; fall back to lifetime volume, then liquidity, then notional.
        const volume = kalshiNumber(
          market.volume_24h_fp,
          market.volume_fp,
          market.volume,
          market.liquidity_dollars,
          market.notional_value_dollars
        );

        results.push({
          id: `kalshi-${market.ticker}`,
          exchange: 'kalshi',
          symbol: market.ticker,
          title: market.title || event.title,
          price: last || yesPrice,
          yesPrice,
          noPrice,
          volume,
          endDate: market.close_time,
          category: event.category,
          url: `https://kalshi.com/markets/${event.event_ticker}`,
          timestamp: Date.now(),
        });
      }
    }

    return results;
  } catch (err) {
    console.error('[Scraper] Kalshi error:', err instanceof Error ? err.message : err);
    return [];
  }
}

// ── Binance (crypto order books / extra data) ──────────────────────

interface BinanceTicker {
  symbol: string;
  lastPrice: string;
  priceChange: string;
  priceChangePercent: string;
  volume: string;
  highPrice: string;
  lowPrice: string;
}

export async function scrapeBinanceTickers(): Promise<ScrapedExchangeEvent[]> {
  const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'DOGEUSDT', 'XRPUSDT'];
  const symbolParam = JSON.stringify(symbols);
  const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(symbolParam)}`;

  try {
    const res = await smartFetch(url);
    if (!res.ok) return [];

    const tickers = res.json<BinanceTicker[]>();
    return tickers.map((t): ScrapedExchangeEvent => ({
      id: `binance-${t.symbol}`,
      exchange: 'binance',
      symbol: t.symbol.replace('USDT', ''),
      title: `${t.symbol} 24h Ticker`,
      price: parseFloat(t.lastPrice),
      volume: parseFloat(t.volume),
      url: `https://www.binance.com/en/trade/${t.symbol}`,
      timestamp: Date.now(),
    }));
  } catch (err) {
    console.error('[Scraper] Binance error:', err instanceof Error ? err.message : err);
    return [];
  }
}

/** Scrape all exchange data */
export async function scrapeAllExchanges(): Promise<ScrapedExchangeEvent[]> {
  const [poly, kalshi, binance] = await Promise.allSettled([
    scrapePolymarket(),
    scrapeKalshi(),
    scrapeBinanceTickers(),
  ]);

  const all: ScrapedExchangeEvent[] = [];
  if (poly.status === 'fulfilled') all.push(...poly.value);
  if (kalshi.status === 'fulfilled') all.push(...kalshi.value);
  if (binance.status === 'fulfilled') all.push(...binance.value);

  return all;
}
