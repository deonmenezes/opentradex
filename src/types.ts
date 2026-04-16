/** Core types for OpenTradex harness */

export type Exchange = 'kalshi' | 'polymarket' | 'tradingview' | 'crypto';
export type Side = 'yes' | 'no' | 'long' | 'short';

export interface Market {
  id: string;
  exchange: Exchange;
  symbol: string;
  title: string;
  price: number;
  volume?: number;
  endDate?: string;
  url?: string;
  meta?: Record<string, unknown>;
}

export interface OrderBook {
  bids: Array<{ price: number; size: number }>;
  asks: Array<{ price: number; size: number }>;
  spread: number;
  midPrice: number;
}

export interface Quote {
  market: Market;
  orderbook?: OrderBook;
  timestamp: number;
}

export interface Trade {
  id: string;
  exchange: Exchange;
  symbol: string;
  side: Side;
  price: number;
  size: number;
  timestamp: number;
  reasoning?: string;
}

export interface Position {
  exchange: Exchange;
  symbol: string;
  side: Side;
  size: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
}

export interface MarketConnector {
  name: Exchange;
  scan(limit?: number): Promise<Market[]>;
  search(query: string): Promise<Market[]>;
  quote(symbol: string): Promise<Quote>;
  orderbook?(symbol: string): Promise<OrderBook>;
}

export interface HarnessConfig {
  kalshi?: { apiKey?: string; privateKey?: string; demo?: boolean };
  polymarket?: { baseUrl?: string };
  tradingview?: { apiKey?: string };
  crypto?: { provider?: 'coingecko' | 'kraken' };
}
