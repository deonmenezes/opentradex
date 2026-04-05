import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "..", "data", "gossip.db");

export function getDb(): Database.Database {
  // Fresh connection each request so we always see the latest writes from the Python agent
  const db = new Database(DB_PATH, { readonly: true });
  db.pragma("journal_mode = WAL");
  return db;
}

export interface Trade {
  id: number;
  timestamp: string;
  ticker: string;
  title: string;
  category: string;
  side: string;
  action: string;
  contracts: number;
  entry_price: number;
  cost: number;
  fee: number;
  estimated_prob: number;
  edge: number;
  confidence: string;
  reasoning: string;
  news_trigger: string;
  sources: string;
  settled: number;
  outcome: string;
  pnl: number;
  exit_price: number | null;
  exit_reasoning: string;
}

export interface Portfolio {
  bankroll: number;
  total_pnl: number;
  total_trades: number;
  wins: number;
  losses: number;
  updated_at: string;
}

export interface NewsArticle {
  id: number;
  timestamp: string;
  source: string;
  keyword: string;
  title: string;
  url: string;
  snippet: string;
}

export interface MarketSnapshot {
  id: number;
  timestamp: string;
  ticker: string;
  title: string;
  category: string;
  yes_bid: number;
  yes_ask: number;
  mid: number;
  volume: number;
  open_interest: number;
  close_time: string;
}

export interface AgentCycle {
  id: number;
  timestamp: string;
  session_id: string;
  duration_s: number;
  status: string;
  markets_scanned: number;
  news_scraped: number;
  trades_made: number;
  output_summary: string;
}
