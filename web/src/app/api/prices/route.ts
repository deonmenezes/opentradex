import { NextResponse } from "next/server";
import { execSync } from "child_process";
import path from "path";

const PROJECT_DIR = path.join(process.cwd(), "..");

export async function GET() {
  try {
    const output = execSync("python3 gossip/trader.py prices", {
      cwd: PROJECT_DIR,
      timeout: 15000,
      env: { ...process.env, PYTHONPATH: PROJECT_DIR },
    }).toString();
    return NextResponse.json(JSON.parse(output));
  } catch {
    return NextResponse.json({ positions: [], total_unrealized_pnl: 0 });
  }
}
