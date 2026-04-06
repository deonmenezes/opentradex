import { NextResponse } from "next/server";
import { tryGetDb } from "@/lib/db";
import { getDemoMarkets } from "@/lib/demo-data";

export async function GET() {
  const db = tryGetDb();
  if (!db) {
    return NextResponse.json(getDemoMarkets());
  }

  let markets: unknown[] = [];
  try {
    markets = db
      .prepare(
        `SELECT ms.* FROM market_snapshots ms
         INNER JOIN (SELECT ticker, MAX(timestamp) as max_ts FROM market_snapshots GROUP BY ticker) latest
         ON ms.ticker = latest.ticker AND ms.timestamp = latest.max_ts
         ORDER BY ms.volume DESC LIMIT 50`
      )
      .all();
  } catch {
    markets = getDemoMarkets();
  }

  return NextResponse.json(markets);
}
