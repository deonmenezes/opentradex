/** Kalshi prediction market connector */

import type { Market, MarketConnector, Quote, OrderBook } from '../types.js';
import { httpGet, retry } from './base.js';

const PROD_BASE = 'https://api.elections.kalshi.com/trade-api/v2';
const DEMO_BASE = 'https://demo-api.kalshi.co/trade-api/v2';

interface KalshiConfig {
  apiKey?: string;
  privateKey?: string;
  demo?: boolean;
}

interface KalshiEvent {
  event_ticker: string;
  title: string;
  category: string;
  markets: KalshiMarket[];
}

interface KalshiMarket {
  ticker: string;
  title: string;
  yes_bid: number;
  yes_ask: number;
  volume: number;
  close_time: string;
}

interface KalshiOrderBook {
  orderbook: {
    yes: Array<[number, number]>;
    no: Array<[number, number]>;
  };
}

export function createKalshiConnector(config: KalshiConfig = {}): MarketConnector {
  const baseUrl = config.demo ? DEMO_BASE : PROD_BASE;

  return {
    name: 'kalshi',

    async scan(limit = 40): Promise<Market[]> {
      const data = await retry(() =>
        httpGet<{ events: KalshiEvent[] }>(`${baseUrl}/events?status=open&limit=${limit}`)
      );

      const markets: Market[] = [];
      for (const event of data.events || []) {
        for (const m of event.markets || []) {
          markets.push({
            id: m.ticker,
            exchange: 'kalshi',
            symbol: m.ticker,
            title: m.title || event.title,
            price: (m.yes_bid + m.yes_ask) / 2 / 100,
            volume: m.volume,
            endDate: m.close_time,
            url: `https://kalshi.com/markets/${m.ticker}`,
            meta: { category: event.category },
          });
        }
      }
      return markets.slice(0, limit);
    },

    async search(query: string): Promise<Market[]> {
      const data = await retry(() =>
        httpGet<{ events: KalshiEvent[] }>(`${baseUrl}/events?status=open`)
      );

      const q = query.toLowerCase();
      const markets: Market[] = [];
      for (const event of data.events || []) {
        if (!event.title.toLowerCase().includes(q)) continue;
        for (const m of event.markets || []) {
          markets.push({
            id: m.ticker,
            exchange: 'kalshi',
            symbol: m.ticker,
            title: m.title || event.title,
            price: (m.yes_bid + m.yes_ask) / 2 / 100,
            volume: m.volume,
            endDate: m.close_time,
            url: `https://kalshi.com/markets/${m.ticker}`,
          });
        }
      }
      return markets;
    },

    async quote(symbol: string): Promise<Quote> {
      const data = await retry(() =>
        httpGet<{ market: KalshiMarket }>(`${baseUrl}/markets/${symbol}`)
      );
      const m = data.market;
      const ob = await this.orderbook!(symbol);

      return {
        market: {
          id: m.ticker,
          exchange: 'kalshi',
          symbol: m.ticker,
          title: m.title,
          price: (m.yes_bid + m.yes_ask) / 2 / 100,
          volume: m.volume,
          endDate: m.close_time,
        },
        orderbook: ob,
        timestamp: Date.now(),
      };
    },

    async orderbook(symbol: string): Promise<OrderBook> {
      const data = await retry(() =>
        httpGet<KalshiOrderBook>(`${baseUrl}/markets/${symbol}/orderbook`)
      );

      const bids = (data.orderbook?.yes || []).map(([price, size]) => ({
        price: price / 100,
        size,
      }));
      const asks = (data.orderbook?.no || []).map(([price, size]) => ({
        price: price / 100,
        size,
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
