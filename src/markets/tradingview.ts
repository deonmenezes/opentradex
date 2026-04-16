/** TradingView / Yahoo Finance connector for stocks */

import type { Market, MarketConnector, Quote, OrderBook } from '../types.js';
import { httpGet, retry } from './base.js';

// Using Yahoo Finance API (free, no auth required)
const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance';
const YAHOO_SEARCH = 'https://query2.finance.yahoo.com/v1/finance';

interface YahooQuote {
  symbol: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice: number;
  regularMarketVolume: number;
  bid?: number;
  ask?: number;
  bidSize?: number;
  askSize?: number;
}

interface YahooSearchResult {
  symbol: string;
  shortname?: string;
  longname?: string;
  exchDisp?: string;
}

const POPULAR_TICKERS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK-B',
  'JPM', 'V', 'UNH', 'XOM', 'MA', 'HD', 'PG', 'JNJ',
  'SPY', 'QQQ', 'IWM', 'DIA', 'VTI', 'VOO',
];

export function createTradingViewConnector(): MarketConnector {
  return {
    name: 'tradingview',

    async scan(limit = 40): Promise<Market[]> {
      const symbols = POPULAR_TICKERS.slice(0, limit).join(',');
      const data = await retry(() =>
        httpGet<{ quoteResponse: { result: YahooQuote[] } }>(
          `${YAHOO_BASE}/quote?symbols=${symbols}`
        )
      );

      return (data.quoteResponse?.result || []).map(q => ({
        id: q.symbol,
        exchange: 'tradingview',
        symbol: q.symbol,
        title: q.longName || q.shortName || q.symbol,
        price: q.regularMarketPrice,
        volume: q.regularMarketVolume,
        url: `https://finance.yahoo.com/quote/${q.symbol}`,
      }));
    },

    async search(query: string): Promise<Market[]> {
      const encoded = encodeURIComponent(query);
      const data = await retry(() =>
        httpGet<{ quotes: YahooSearchResult[] }>(
          `${YAHOO_SEARCH}/search?q=${encoded}&quotesCount=20`
        )
      );

      const symbols = (data.quotes || [])
        .filter(q => q.exchDisp && !q.exchDisp.includes('Crypto'))
        .map(q => q.symbol)
        .join(',');

      if (!symbols) return [];

      const quotes = await retry(() =>
        httpGet<{ quoteResponse: { result: YahooQuote[] } }>(
          `${YAHOO_BASE}/quote?symbols=${symbols}`
        )
      );

      return (quotes.quoteResponse?.result || []).map(q => ({
        id: q.symbol,
        exchange: 'tradingview',
        symbol: q.symbol,
        title: q.longName || q.shortName || q.symbol,
        price: q.regularMarketPrice,
        volume: q.regularMarketVolume,
        url: `https://finance.yahoo.com/quote/${q.symbol}`,
      }));
    },

    async quote(symbol: string): Promise<Quote> {
      const data = await retry(() =>
        httpGet<{ quoteResponse: { result: YahooQuote[] } }>(
          `${YAHOO_BASE}/quote?symbols=${symbol}`
        )
      );

      const q = data.quoteResponse?.result?.[0];
      if (!q) throw new Error(`Quote not found: ${symbol}`);

      const ob: OrderBook | undefined = q.bid && q.ask
        ? {
            bids: [{ price: q.bid, size: q.bidSize || 0 }],
            asks: [{ price: q.ask, size: q.askSize || 0 }],
            spread: q.ask - q.bid,
            midPrice: (q.bid + q.ask) / 2,
          }
        : undefined;

      return {
        market: {
          id: q.symbol,
          exchange: 'tradingview',
          symbol: q.symbol,
          title: q.longName || q.shortName || q.symbol,
          price: q.regularMarketPrice,
          volume: q.regularMarketVolume,
          url: `https://finance.yahoo.com/quote/${q.symbol}`,
        },
        orderbook: ob,
        timestamp: Date.now(),
      };
    },
  };
}
