/** Dashboard types */

export type TradingMode = 'paper-only' | 'paper-default' | 'live-allowed';
export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'reconnecting';

export interface WsMeta {
  /** Number of consecutive failed WS connect attempts (resets to 0 on open) */
  attempts: number;
  /** Last measured round-trip latency in ms (-1 if not measured yet) */
  latencyMs: number;
  /** Timestamp of the most recent successful reconnection (0 if never); used to show a banner */
  reconnectedAt: number;
}

export interface HarnessStatus {
  mode: TradingMode;
  connection: ConnectionStatus;
  rails: {
    kalshi: boolean;
    polymarket: boolean;
    alpaca: boolean;
    tradingview: boolean;
    crypto: boolean;
  };
  capital: number;
  dayPnL: number;
  dayPnLPercent: number;
  trades: number;
  winRate: number;
  openPositions: number;
  cycles: number;
  isAutoLoop: boolean;
  cycleInterval: number;
}

export interface Position {
  id: string;
  exchange: string;
  symbol: string;
  title: string;
  side: 'yes' | 'no' | 'long' | 'short';
  size: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  confidence: 'High' | 'Medium' | 'Low';
}

export interface Trade {
  id: string;
  exchange: string;
  symbol: string;
  side: 'yes' | 'no' | 'long' | 'short';
  size: number;
  price: number;
  pnl?: number;
  status: 'open' | 'closed' | 'pending';
  timestamp: number;
  age: string;
}

export interface Market {
  id: string;
  exchange: string;
  symbol: string;
  title: string;
  bidAsk: string;
  mid: number;
  volume: string;
}

export type FeedSource =
  | 'reuters' | 'bloomberg' | 'ft' | 'wsj' | 'cnbc' | 'marketwatch'
  | 'coindesk' | 'theblock' | 'benzinga' | 'seekingalpha'
  | 'x' | 'reddit' | 'truth' | 'tiktok';

export type FeedCategory = 'macro' | 'equities' | 'crypto' | 'forex' | 'prediction' | 'commodities' | 'social';

export interface FeedItem {
  id: string;
  source: FeedSource;
  category?: FeedCategory;
  title: string;
  summary?: string;
  url?: string;
  timestamp: number;
  age: string;
  sentiment?: 'bullish' | 'bearish' | 'neutral';
  tickers?: string[];
}

export type ConnectorCategory = 'prediction' | 'equities' | 'crypto' | 'forex' | 'charts' | 'sportsbook';
export type ConnectorStatus = 'connected' | 'disconnected' | 'available' | 'beta';

export interface Connector {
  id: string;
  name: string;
  tagline: string;
  category: ConnectorCategory;
  status: ConnectorStatus;
  logo: {
    mark: string;
    bg: string;
    fg: string;
  };
  capabilities: string[];
  docsUrl?: string;
}

export interface Channel {
  id: string;
  name: string;
  icon: string;
  description: string;
  messageCount: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  channel?: string;
}

export interface MissionCard {
  id: string;
  title: string;
  description: string;
  status: 'ready' | 'running' | 'completed' | 'failed';
}
