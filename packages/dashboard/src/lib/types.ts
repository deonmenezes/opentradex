/** Dashboard types */

export type TradingMode = 'paper-only' | 'paper-default' | 'live-allowed';
export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';

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

export interface FeedItem {
  id: string;
  source: 'reuters' | 'bloomberg' | 'ft' | 'x' | 'reddit' | 'truth' | 'tiktok';
  title: string;
  summary?: string;
  timestamp: number;
  age: string;
  sentiment?: 'bullish' | 'bearish' | 'neutral';
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
