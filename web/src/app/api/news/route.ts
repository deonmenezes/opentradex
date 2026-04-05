import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const news = db
    .prepare("SELECT * FROM news ORDER BY timestamp DESC LIMIT 100")
    .all();
  return NextResponse.json(news);
}
