/** Crypto market connector via CoinGecko + Kraken */

import type { Market, MarketConnector, Quote, OrderBook } from '../types.js';
import { httpGet, retry } from './base.js';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const KRAKEN_BASE = 'https://api.kraken.com/0/public';

// Symbol -> CoinGecko ID
const SYMBOL_MAP: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', XRP: 'ripple',
  BNB: 'binancecoin', ADA: 'cardano', DOGE: 'dogecoin', DOT: 'polkadot',
  AVAX: 'avalanche-2', LINK: 'chainlink', MATIC: 'matic-network',
  UNI: 'uniswap', ATOM: 'cosmos', LTC: 'litecoin', NEAR: 'near',
};

// CoinGecko ID -> Kraken pair
const KRAKEN_PAIRS: Record<string, string> = {
  bitcoin: 'XBTUSD', ethereum: 'ETHUSD', solana: 'SOLUSD',
  ripple: 'XRPUSD', cardano: 'ADAUSD', dogecoin: 'DOGEUSD',
  polkadot: 'DOTUSD', chainlink: 'LINKUSD', litecoin: 'LTCUSD',
};

interface CoinGeckoCoin {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  total_volume: number;
  market_cap: number;
}

interface KrakenOrderBook {
  result: Record<string, { bids: string[][]; asks: string[][] }>;
}

function resolveId(ticker: string): string {
  const upper = ticker.toUpperCase();
  return SYMBOL_MAP[upper] || ticker.toLowerCase();
}

export function createCryptoConnector(): MarketConnector {
  return {
    name: 'crypto',

    async scan(limit = 40): Promise<Market[]> {
      const data = await retry(() =>
        httpGet<CoinGeckoCoin[]>(
          `${COINGECKO_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}`
        )
      );

      return (data || []).map(c => ({
        id: c.id,
        exchange: 'crypto',
        symbol: c.symbol.toUpperCase(),
        title: c.name,
        price: c.current_price,
        volume: c.total_volume,
        url: `https://www.coingecko.com/en/coins/${c.id}`,
        meta: { marketCap: c.market_cap },
      }));
    },

    async search(query: string): Promise<Market[]> {
      const data = await retry(() =>
        httpGet<{ coins: Array<{ id: string; name: string; symbol: string }> }>(
          `${COINGECKO_BASE}/search?query=${encodeURIComponent(query)}`
        )
      );

      const ids = (data.coins || []).slice(0, 10).map(c => c.id).join(',');
      if (!ids) return [];

      const markets = await retry(() =>
        httpGet<CoinGeckoCoin[]>(
          `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${ids}`
        )
      );

      return (markets || []).map(c => ({
        id: c.id,
        exchange: 'crypto',
        symbol: c.symbol.toUpperCase(),
        title: c.name,
        price: c.current_price,
        volume: c.total_volume,
        url: `https://www.coingecko.com/en/coins/${c.id}`,
      }));
    },

    async quote(symbol: string): Promise<Quote> {
      const id = resolveId(symbol);
      const data = await retry(() =>
        httpGet<CoinGeckoCoin[]>(
          `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${id}`
        )
      );

      const c = data?.[0];
      if (!c) throw new Error(`Coin not found: ${symbol}`);

      let ob: OrderBook | undefined;
      const krakenPair = KRAKEN_PAIRS[id];
      if (krakenPair) {
        try {
          ob = await this.orderbook!(krakenPair);
        } catch { /* orderbook optional */ }
      }

      return {
        market: {
          id: c.id,
          exchange: 'crypto',
          symbol: c.symbol.toUpperCase(),
          title: c.name,
          price: c.current_price,
          volume: c.total_volume,
          url: `https://www.coingecko.com/en/coins/${c.id}`,
        },
        orderbook: ob,
        timestamp: Date.now(),
      };
    },

    async orderbook(pair: string): Promise<OrderBook> {
      const data = await retry(() =>
        httpGet<KrakenOrderBook>(`${KRAKEN_BASE}/Depth?pair=${pair}&count=10`)
      );

      const book = Object.values(data.result || {})[0];
      if (!book) throw new Error(`Orderbook not found: ${pair}`);

      const bids = (book.bids || []).map(([price, size]) => ({
        price: parseFloat(price),
        size: parseFloat(size),
      }));
      const asks = (book.asks || []).map(([price, size]) => ({
        price: parseFloat(price),
        size: parseFloat(size),
      }));

      const bestBid = bids[0]?.price || 0;
      const bestAsk = asks[0]?.price || Infinity;

      return {
        bids,
        asks,
        spread: bestAsk - bestBid,
        midPrice: (bestBid + bestAsk) / 2,
      };
    },
  };
}
