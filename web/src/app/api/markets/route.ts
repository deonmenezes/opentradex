import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const markets = db
    .prepare(
      `SELECT ms.* FROM market_snapshots ms
       INNER JOIN (SELECT ticker, MAX(timestamp) as max_ts FROM market_snapshots GROUP BY ticker) latest
       ON ms.ticker = latest.ticker AND ms.timestamp = latest.max_ts
       ORDER BY ms.volume DESC LIMIT 50`
    )
    .all();
  return NextResponse.json(markets);
}
