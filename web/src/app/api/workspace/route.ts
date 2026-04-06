import { NextResponse } from "next/server";
import { getDemoWorkspaceSummary } from "@/lib/demo-data";
import { readWorkspaceSummary } from "@/lib/workspace";

export async function GET() {
  if (process.env.VERCEL) {
    return NextResponse.json(getDemoWorkspaceSummary());
  }

  const summary = readWorkspaceSummary();
  return NextResponse.json(summary || getDemoWorkspaceSummary());
}
