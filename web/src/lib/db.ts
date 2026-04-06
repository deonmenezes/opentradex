import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), "..", "data", "gossip.db");

export function hasDbFile() {
  try {
    return fs.existsSync(DB_PATH) && fs.statSync(DB_PATH).size > 0;
  } catch {
    return false;
  }
}

export function tryGetDb(): Database.Database | null {
  if (!hasDbFile()) {
    return null;
  }

  try {
    return new Database(DB_PATH, {
      readonly: true,
      fileMustExist: true,
    });
  } catch {
    return null;
  }
}

export function getDb(): Database.Database {
  const db = tryGetDb();
  if (!db) {
    throw new Error(`Could not open SQLite database at ${DB_PATH}`);
  }

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
