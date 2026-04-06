import { NextResponse } from "next/server";
import { tryGetDb } from "@/lib/db";
import { getDemoTrades } from "@/lib/demo-data";

export async function GET() {
  const db = tryGetDb();
  if (!db) {
    return NextResponse.json(getDemoTrades());
  }

  let trades: unknown[] = [];
  try {
    trades = db.prepare("SELECT * FROM trades ORDER BY timestamp DESC LIMIT 50").all();
  } catch {
    trades = getDemoTrades();
  }

  return NextResponse.json(trades);
}
