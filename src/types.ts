/** Core types for OpenTradex harness */

export type Exchange = 'kalshi' | 'polymarket' | 'tradingview' | 'crypto' | 'alpaca';
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

export type TradeSide = 'buy' | 'sell';

export interface Order {
  id: string;
  symbol: string;
  side: TradeSide;
  quantity: number;
  type: 'market' | 'limit';
  price?: number;
  exchange?: string;
  status: 'pending' | 'filled' | 'cancelled' | 'rejected';
  filledPrice?: number;
  filledAt?: Date;
}

export interface TradeResult {
  success: boolean;
  orderId?: string;
  symbol: string;
  exchange?: string;
  side: TradeSide;
  quantity: number;
  price: number;
  pnl?: number;
  error?: string;
  timestamp: Date;
  mode: string;
}

export interface MarketConnector {
  name: Exchange;
  scan(limit?: number): Promise<Market[]>;
  search(query: string): Promise<Market[]>;
  quote(symbol: string): Promise<Quote>;
  orderbook?(symbol: string): Promise<OrderBook>;
  execute?(order: Order): Promise<TradeResult>;
}

export interface HarnessConfig {
  kalshi?: { apiKey?: string; privateKey?: string; demo?: boolean };
  polymarket?: { baseUrl?: string };
  tradingview?: { apiKey?: string };
  crypto?: { provider?: 'coingecko' | 'kraken' };
  alpaca?: { apiKey?: string; secretKey?: string; paper?: boolean };
}
