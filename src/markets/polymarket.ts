/** Polymarket prediction market connector */

import type { Market, MarketConnector, Quote, OrderBook } from '../types.js';
import { httpGet, retry } from './base.js';

const GAMMA_BASE = 'https://gamma-api.polymarket.com';
const CLOB_BASE = 'https://clob.polymarket.com';

interface PolyConfig {
  baseUrl?: string;
}

interface PolyMarket {
  id: string;
  slug: string;
  question: string;
  outcomePrices?: string;
  volumeNum?: number;
  volume?: number;
  endDate?: string;
  active?: boolean;
  closed?: boolean;
  clobTokenIds?: string;
}

interface ClobBook {
  bids: Array<{ price: string; size: string }>;
  asks: Array<{ price: string; size: string }>;
}

function parseOutcomePrices(raw?: string): [number, number] {
  if (!raw) return [0.5, 0.5];
  try {
    const prices = JSON.parse(raw);
    return [parseFloat(prices[0]) || 0.5, parseFloat(prices[1]) || 0.5];
  } catch {
    return [0.5, 0.5];
  }
}

export function createPolymarketConnector(config: PolyConfig = {}): MarketConnector {
  const gammaBase = config.baseUrl || GAMMA_BASE;

  return {
    name: 'polymarket',

    async scan(limit = 40): Promise<Market[]> {
      const data = await retry(() =>
        httpGet<PolyMarket[]>(
          `${gammaBase}/markets?closed=false&active=true&order=volume&ascending=false&limit=${limit}`
        )
      );

      return (data || []).map(m => {
        const [yesPrice] = parseOutcomePrices(m.outcomePrices);
        return {
          id: m.id,
          exchange: 'polymarket',
          symbol: m.slug || m.id,
          title: m.question,
          price: yesPrice,
          volume: m.volumeNum || m.volume,
          endDate: m.endDate,
          url: `https://polymarket.com/event/${m.slug}`,
          meta: { clobTokenIds: m.clobTokenIds },
        };
      });
    },

    async search(query: string): Promise<Market[]> {
      const encoded = encodeURIComponent(query);
      const data = await retry(() =>
        httpGet<PolyMarket[]>(`${gammaBase}/markets?closed=false&_q=${encoded}&limit=20`)
      );

      return (data || []).map(m => {
        const [yesPrice] = parseOutcomePrices(m.outcomePrices);
        return {
          id: m.id,
          exchange: 'polymarket',
          symbol: m.slug || m.id,
          title: m.question,
          price: yesPrice,
          volume: m.volumeNum || m.volume,
          endDate: m.endDate,
          url: `https://polymarket.com/event/${m.slug}`,
        };
      });
    },

    async quote(symbol: string): Promise<Quote> {
      const data = await retry(() =>
        httpGet<PolyMarket[]>(`${gammaBase}/markets?slug=${symbol}`)
      );
      const m = data?.[0];
      if (!m) throw new Error(`Market not found: ${symbol}`);

      const [yesPrice] = parseOutcomePrices(m.outcomePrices);
      let ob: OrderBook | undefined;

      if (m.clobTokenIds) {
        try {
          const tokenId = JSON.parse(m.clobTokenIds)[0];
          ob = await this.orderbook!(tokenId);
        } catch { /* orderbook optional */ }
      }

      return {
        market: {
          id: m.id,
          exchange: 'polymarket',
          symbol: m.slug || m.id,
          title: m.question,
          price: yesPrice,
          volume: m.volumeNum || m.volume,
          endDate: m.endDate,
          url: `https://polymarket.com/event/${m.slug}`,
        },
        orderbook: ob,
        timestamp: Date.now(),
      };
    },

    async orderbook(tokenId: string): Promise<OrderBook> {
      const data = await retry(() =>
        httpGet<ClobBook>(`${CLOB_BASE}/book?token_id=${tokenId}`)
      );

      const bids = (data.bids || []).map(b => ({
        price: parseFloat(b.price),
        size: parseFloat(b.size),
      }));
      const asks = (data.asks || []).map(a => ({
        price: parseFloat(a.price),
        size: parseFloat(a.size),
      }));

      const bestBid = bids[0]?.price || 0;
      const bestAsk = asks[0]?.price || 1;

      return {
        bids,
        asks,
        spread: bestAsk - bestBid,
        midPrice: (bestBid + bestAsk) / 2,
      };
    },
  };
}
