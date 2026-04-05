import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

function tableExists(db: ReturnType<typeof getDb>, name: string): boolean {
  const row = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name) as Record<string, unknown> | undefined;
  return !!row;
}

export async function GET() {
  const db = getDb();

  const hasPortfolio = tableExists(db, "portfolio");
  const hasTrades = tableExists(db, "trades");
  const hasNews = tableExists(db, "news");
  const hasSnapshots = tableExists(db, "market_snapshots");
  const hasLogs = tableExists(db, "agent_logs");

  const portfolio = hasPortfolio
    ? db.prepare("SELECT * FROM portfolio WHERE id=1").get() as Record<string, unknown> | undefined
    : undefined;
  const openPositions = hasTrades
    ? db.prepare("SELECT * FROM trades WHERE settled=0 AND action='buy' ORDER BY timestamp DESC").all()
    : [];
  const totalNews = hasNews
    ? (db.prepare("SELECT COUNT(*) as count FROM news").get() as { count: number })?.count ?? 0
    : 0;
  const totalSnapshots = hasSnapshots
    ? (db.prepare("SELECT COUNT(*) as count FROM market_snapshots").get() as { count: number })?.count ?? 0
    : 0;
  const totalCycles = hasLogs
    ? (db.prepare("SELECT COUNT(*) as count FROM agent_logs").get() as { count: number })?.count ?? 0
    : 0;

  const defaults = {
    bankroll: 15,
    total_pnl: 0,
    total_trades: 0,
    wins: 0,
    losses: 0,
  };

  return NextResponse.json({
    ...defaults,
    ...(portfolio ?? {}),
    open_positions: openPositions,
    total_news: totalNews,
    total_snapshots: totalSnapshots,
    total_cycles: totalCycles,
  });
}
