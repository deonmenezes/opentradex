import { NextResponse } from "next/server";
import { tryGetDb } from "@/lib/db";
import { getDemoNews } from "@/lib/demo-data";

export async function GET() {
  const db = tryGetDb();
  if (!db) {
    return NextResponse.json(getDemoNews());
  }

  let news: unknown[] = [];
  try {
    news = db.prepare("SELECT * FROM news ORDER BY timestamp DESC LIMIT 100").all();
  } catch {
    news = getDemoNews();
  }

  return NextResponse.json(news);
}
