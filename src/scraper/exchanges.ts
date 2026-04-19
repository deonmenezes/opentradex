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

const PAGE_SIZE = 100;
const MAX_MARKETS = Number(process.env.SCRAPER_MAX_MARKETS ?? 500);

export async function scrapePolymarket(maxMarkets = MAX_MARKETS): Promise<ScrapedExchangeEvent[]> {
  const results: ScrapedExchangeEvent[] = [];
  let offset = 0;

  try {
    while (results.length < maxMarkets) {
      const url = `https://gamma-api.polymarket.com/events?closed=false&limit=${PAGE_SIZE}&offset=${offset}&order=volume24hr&ascending=false`;
      const res = await smartFetch(url);
      if (!res.ok) break;

      const events = res.json<PolymarketEvent[]>();
      if (!events?.length) break;

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
          if (results.length >= maxMarkets) break;
        }
        if (results.length >= maxMarkets) break;
      }

      if (events.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
    return results;
  } catch (err) {
    console.error('[Scraper] Polymarket error:', err instanceof Error ? err.message : err);
    return results;
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

export async function scrapeKalshi(maxMarkets = MAX_MARKETS): Promise<ScrapedExchangeEvent[]> {
  const results: ScrapedExchangeEvent[] = [];
  let cursor: string | undefined;

  try {
    while (results.length < maxMarkets) {
      const cursorParam = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
      const url = `https://api.elections.kalshi.com/trade-api/v2/events?limit=${PAGE_SIZE}&status=open&with_nested_markets=true${cursorParam}`;
      const res = await smartFetch(url);
      if (!res.ok) break;

      const data = res.json<{ events?: KalshiEvent[]; cursor?: string }>();
      const events = data?.events ?? [];
      if (!events.length) break;

      for (const event of events) {
        for (const market of event.markets) {
          const yesBid = kalshiPrice(market.yes_bid_dollars, market.yes_bid);
          const yesAsk = kalshiPrice(market.yes_ask_dollars, market.yes_ask);
          const noBid = kalshiPrice(market.no_bid_dollars, market.no_bid);
          const noAsk = kalshiPrice(market.no_ask_dollars, market.no_ask);
          const last = kalshiPrice(market.last_price_dollars, market.last_price);

          const yesPrice = yesBid && yesAsk ? (yesBid + yesAsk) / 2 : last || yesAsk || yesBid || 0;
          const noPrice = noBid && noAsk ? (noBid + noAsk) / 2 : (1 - yesPrice) || 0;

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
          if (results.length >= maxMarkets) break;
        }
        if (results.length >= maxMarkets) break;
      }

      if (!data?.cursor || data.cursor === cursor) break;
      cursor = data.cursor;
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

export async function scrapeBinanceTickers(topN = 50): Promise<ScrapedExchangeEvent[]> {
  // api.binance.com geo-blocks US (HTTP 451). The public data mirror works everywhere.
  const primary = 'https://data-api.binance.vision/api/v3/ticker/24hr';
  const fallback = 'https://api.binance.com/api/v3/ticker/24hr';

  try {
    let res = await smartFetch(primary);
    if (!res.ok) res = await smartFetch(fallback);
    if (!res.ok) return [];

    const tickers = res.json<BinanceTicker[]>();
    const usdt = tickers
      .filter((t) => t.symbol.endsWith('USDT') && !t.symbol.includes('UP') && !t.symbol.includes('DOWN'))
      .sort((a, b) => parseFloat(b.volume) * parseFloat(b.lastPrice) - parseFloat(a.volume) * parseFloat(a.lastPrice))
      .slice(0, topN);

    return usdt.map((t): ScrapedExchangeEvent => ({
      id: `binance-${t.symbol}`,
      exchange: 'binance',
      symbol: t.symbol.replace('USDT', ''),
      title: `${t.symbol} 24h Ticker`,
      price: parseFloat(t.lastPrice),
      volume: parseFloat(t.volume),
      category: 'crypto',
      url: `https://www.binance.com/en/trade/${t.symbol}`,
      timestamp: Date.now(),
    }));
  } catch (err) {
    console.error('[Scraper] Binance error:', err instanceof Error ? err.message : err);
    return [];
  }
}

// ── Coinbase (public spot tickers) ─────────────────────────────────

interface CoinbaseProduct {
  id: string;
  base_currency: string;
  quote_currency: string;
  status: string;
}

interface CoinbaseTicker {
  price?: string;
  volume?: string;
  time?: string;
}

interface CoinbaseStats {
  open?: string;
  high?: string;
  low?: string;
  volume?: string;
  last?: string;
}

export async function scrapeCoinbase(topN = 20): Promise<ScrapedExchangeEvent[]> {
  try {
    const productsRes = await smartFetch('https://api.exchange.coinbase.com/products');
    if (!productsRes.ok) return [];
    const products = productsRes.json<CoinbaseProduct[]>()
      .filter((p) => p.status === 'online' && p.quote_currency === 'USD')
      .slice(0, topN);

    const results: ScrapedExchangeEvent[] = [];
    for (const p of products) {
      try {
        const statsRes = await smartFetch(`https://api.exchange.coinbase.com/products/${p.id}/stats`);
        if (!statsRes.ok) continue;
        const s = statsRes.json<CoinbaseStats>();
        const price = parseFloat(s.last || '0');
        if (!price) continue;
        results.push({
          id: `coinbase-${p.id}`,
          exchange: 'coinbase',
          symbol: p.base_currency,
          title: `${p.id} 24h`,
          price,
          volume: parseFloat(s.volume || '0'),
          category: 'crypto',
          url: `https://www.coinbase.com/advanced-trade/${p.id}`,
          timestamp: Date.now(),
        });
      } catch { /* skip */ }
    }
    return results;
  } catch (err) {
    console.error('[Scraper] Coinbase error:', err instanceof Error ? err.message : err);
    return [];
  }
}

// ── PredictIt (public political event markets) ────────────────────

interface PredictItContract {
  id: number;
  name: string;
  shortName?: string;
  lastTradePrice?: number;
  bestBuyYesCost?: number;
  bestBuyNoCost?: number;
  bestSellYesCost?: number;
  bestSellNoCost?: number;
}

interface PredictItMarket {
  id: number;
  name: string;
  shortName?: string;
  status?: string;
  contracts: PredictItContract[];
  url?: string;
}

export async function scrapePredictIt(): Promise<ScrapedExchangeEvent[]> {
  try {
    const res = await smartFetch('https://www.predictit.org/api/marketdata/all/');
    if (!res.ok) return [];
    const data = res.json<{ markets?: PredictItMarket[] }>();
    const markets = data?.markets ?? [];
    const results: ScrapedExchangeEvent[] = [];

    for (const market of markets) {
      if (market.status && market.status !== 'Open') continue;
      for (const c of market.contracts) {
        const yesPrice = c.bestBuyYesCost ?? c.lastTradePrice ?? 0;
        const noPrice = c.bestBuyNoCost ?? (yesPrice ? 1 - yesPrice : 0);
        if (!yesPrice) continue;
        results.push({
          id: `predictit-${c.id}`,
          exchange: 'predictit',
          symbol: `PI-${c.id}`,
          title: `${market.shortName || market.name} — ${c.shortName || c.name}`,
          price: yesPrice,
          yesPrice,
          noPrice,
          volume: 0,
          category: 'prediction',
          url: market.url,
          timestamp: Date.now(),
        });
      }
    }
    return results;
  } catch (err) {
    console.error('[Scraper] PredictIt error:', err instanceof Error ? err.message : err);
    return [];
  }
}

// ── Manifold (prediction markets, play-money) ─────────────────────

interface ManifoldMarket {
  id: string;
  question: string;
  slug: string;
  outcomeType?: string;
  probability?: number;
  volume24Hours?: number;
  volume?: number;
  isResolved?: boolean;
  closeTime?: number;
  url?: string;
}

export async function scrapeManifold(limit = 500): Promise<ScrapedExchangeEvent[]> {
  try {
    const res = await smartFetch(`https://api.manifold.markets/v0/markets?limit=${limit}`);
    if (!res.ok) return [];
    const markets = res.json<ManifoldMarket[]>() ?? [];
    return markets
      .filter((m) => !m.isResolved && m.outcomeType === 'BINARY' && typeof m.probability === 'number')
      .map((m): ScrapedExchangeEvent => ({
        id: `manifold-${m.id}`,
        exchange: 'manifold',
        symbol: m.slug,
        title: m.question,
        price: m.probability ?? 0,
        yesPrice: m.probability ?? 0,
        noPrice: 1 - (m.probability ?? 0),
        volume: m.volume24Hours ?? m.volume ?? 0,
        endDate: m.closeTime ? new Date(m.closeTime).toISOString() : undefined,
        category: 'prediction',
        url: m.url ?? `https://manifold.markets/market/${m.slug}`,
        timestamp: Date.now(),
      }));
  } catch (err) {
    console.error('[Scraper] Manifold error:', err instanceof Error ? err.message : err);
    return [];
  }
}

/** Scrape all exchange data */
export async function scrapeAllExchanges(): Promise<ScrapedExchangeEvent[]> {
  const [poly, kalshi, binance, coinbase, predictit, manifold] = await Promise.allSettled([
    scrapePolymarket(),
    scrapeKalshi(),
    scrapeBinanceTickers(),
    scrapeCoinbase(),
    scrapePredictIt(),
    scrapeManifold(),
  ]);

  const all: ScrapedExchangeEvent[] = [];
  if (poly.status === 'fulfilled') all.push(...poly.value);
  if (kalshi.status === 'fulfilled') all.push(...kalshi.value);
  if (binance.status === 'fulfilled') all.push(...binance.value);
  if (coinbase.status === 'fulfilled') all.push(...coinbase.value);
  if (predictit.status === 'fulfilled') all.push(...predictit.value);
  if (manifold.status === 'fulfilled') all.push(...manifold.value);

  return all;
}
