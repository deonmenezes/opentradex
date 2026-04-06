import { NextResponse } from "next/server";
import { tryGetDb } from "@/lib/db";
import { spawn } from "child_process";
import { getDemoAgentCycles } from "@/lib/demo-data";
import path from "path";
import fs from "fs";

export async function GET() {
  const db = tryGetDb();
  if (!db) {
    return NextResponse.json(getDemoAgentCycles());
  }

  let cycles: unknown[] = [];
  try {
    cycles = db.prepare("SELECT * FROM agent_logs ORDER BY timestamp DESC LIMIT 20").all();
  } catch {
    cycles = getDemoAgentCycles();
  }

  return NextResponse.json(cycles);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { action, prompt, rationale, interval } = body;

  const projectDir = path.join(process.cwd(), "..");
  const isHostedPreview = Boolean(process.env.VERCEL);
  const hasMainScript = fs.existsSync(path.join(projectDir, "main.py"));

  if (isHostedPreview || !hasMainScript) {
    return NextResponse.json({
      status: "demo_mode",
      message:
        "Hosted preview mode is read-only. Run `opentradex onboard` or `python main.py` locally to start real agent cycles.",
    });
  }

  if (action === "run_cycle") {
    const args = ["main.py"];
    if (prompt) args.push("--prompt", prompt);
    if (rationale) args.push("--rationale", rationale);

    const child = spawn("python3", args, {
      cwd: projectDir,
      detached: true,
      stdio: "ignore",
    });
    child.unref();

    return NextResponse.json({
      status: "spawned",
      pid: child.pid,
      message: "Agent cycle started in background",
    });
  }

  if (action === "start_loop") {
    const args = ["main.py", "--loop"];
    if (interval) args.push("--interval", String(interval));

    const child = spawn("python3", args, {
      cwd: projectDir,
      detached: true,
      stdio: "ignore",
    });
    child.unref();

    return NextResponse.json({
      status: "loop_started",
      pid: child.pid,
      interval: interval || 900,
    });
  }

  if (action === "submit_rationale") {
    if (!rationale) {
      return NextResponse.json({ error: "rationale required" }, { status: 400 });
    }

    const child = spawn("python3", ["main.py", "--rationale", rationale], {
      cwd: projectDir,
      detached: true,
      stdio: "ignore",
    });
    child.unref();

    return NextResponse.json({
      status: "rationale_submitted",
      thesis: rationale,
      message: "Agent is researching your thesis",
    });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
