import { NextResponse } from "next/server";
import { getDb, tryGetDb } from "@/lib/db";
import { getDemoPortfolio } from "@/lib/demo-data";
import { readWorkspaceSummary } from "@/lib/workspace";
import { execFile } from "child_process";
import path from "path";

function tableExists(db: ReturnType<typeof getDb>, name: string): boolean {
  const row = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name) as Record<string, unknown> | undefined;
  return !!row;
}

const PROJECT_DIR = path.join(process.cwd(), "..");

function runCommand(args: string[]) {
  return new Promise<string>((resolve, reject) => {
    execFile("python3", args, { cwd: PROJECT_DIR, timeout: 15000, env: { ...process.env, PYTHONPATH: PROJECT_DIR } }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
}

function centsToDollars(value: unknown): number | null {
  const cents = Number(value);
  if (!Number.isFinite(cents)) {
    return null;
  }
  return cents / 100;
}

export async function GET() {
  const workspace = readWorkspaceSummary();
  const isLiveMode = workspace?.mode === "live";
  const db = tryGetDb();
  if (!db) {
    return NextResponse.json(getDemoPortfolio());
  }

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
    bankroll: 30,
    total_pnl: 0,
    total_trades: 0,
    wins: 0,
    losses: 0,
    data_source: isLiveMode ? "kalshi_live" : "paper_local",
  };

  if (isLiveMode) {
    try {
      const [balanceRaw, positionsRaw] = await Promise.all([
        runCommand(["gossip/kalshi.py", "balance"]),
        runCommand(["gossip/kalshi.py", "positions"]),
      ]);
      const balancePayload = JSON.parse(balanceRaw);
      const positionsPayload = JSON.parse(positionsRaw);

      const marketPositions = Array.isArray(positionsPayload.market_positions)
        ? positionsPayload.market_positions
        : [];

      const openPositions = marketPositions.map((position: Record<string, unknown>, index: number) => {
        const ticker = String(position.ticker || position.market_ticker || position.market_id || `live-${index}`);
        const side = String(position.side || position.position_side || "yes").toLowerCase();
        const contracts = Number(position.position || position.contract_count || position.contracts || position.count || 0);
        const entryPrice = Number(position.avg_price || position.average_price || position.entry_price || 0);
        const title = String(position.title || position.market_title || ticker);

        return {
          id: -1000 - index,
          timestamp: new Date().toISOString(),
          ticker,
          title,
          category: String(position.category || "live"),
          side,
          action: "buy",
          contracts,
          entry_price: entryPrice,
          cost: Number(position.cost || contracts * entryPrice || 0),
          fee: Number(position.fee || 0),
          estimated_prob: Number(position.estimated_prob || 0),
          edge: Number(position.edge || 0),
          confidence: String(position.confidence || "live"),
          reasoning: "Live Kalshi position",
          news_trigger: "",
          sources: "[]",
          settled: 0,
          outcome: "",
          pnl: Number(position.realized_pnl || 0),
          exit_price: null,
          exit_reasoning: "",
        };
      });

      return NextResponse.json({
        ...defaults,
        bankroll: centsToDollars(balancePayload.balance) ?? Number(portfolio?.bankroll ?? defaults.bankroll),
        total_pnl: 0,
        total_trades: 0,
        wins: 0,
        losses: 0,
        open_positions: openPositions,
        total_news: totalNews,
        total_snapshots: totalSnapshots,
        total_cycles: totalCycles,
        data_source: "kalshi_live",
      });
    } catch {
      return NextResponse.json({
        ...defaults,
        ...(portfolio ?? {}),
        open_positions: [],
        total_news: totalNews,
        total_snapshots: totalSnapshots,
        total_cycles: totalCycles,
        data_source: "paper_fallback",
      });
    }
  }

  return NextResponse.json({
    ...defaults,
    ...(portfolio ?? {}),
    open_positions: openPositions,
    total_news: totalNews,
    total_snapshots: totalSnapshots,
    total_cycles: totalCycles,
    data_source: "paper_local",
  });
}
