import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const trades = db
    .prepare("SELECT * FROM trades ORDER BY timestamp DESC LIMIT 50")
    .all();
  return NextResponse.json(trades);
}
