import { NextResponse } from "next/server";
import { getDemoWorkspaceSummary } from "@/lib/demo-data";
import { readWorkspaceSummary, readEnvFile, writeEnvValue } from "@/lib/workspace";
import type { LiveReadinessCheck, WorkspaceStatus } from "@/lib/types";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";

const PROJECT_ROOT = path.join(process.cwd(), "..");

function runCommand(cmd: string, args: string[], cwd: string) {
  return new Promise<{ stdout: string; stderr: string; code: number | null }>((resolve) => {
    execFile(cmd, args, { cwd, timeout: 15000 }, (error, stdout, stderr) => {
      resolve({
        stdout: stdout || "",
        stderr: stderr || "",
        code: error && typeof (error as { code?: number }).code === "number" ? (error as { code: number }).code : 0,
      });
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

async function getWorkspaceStatus(): Promise<WorkspaceStatus> {
  const workspace = readWorkspaceSummary();
  if (!workspace) {
    return {
      workspace: getDemoWorkspaceSummary(),
      readiness: {
        canArmLive: false,
        checks: [],
        balance: null,
        authProbeOk: false,
        authProbeMessage: "No local workspace found.",
      },
    };
  }

  const { values: env } = readEnvFile();
  const executionRail = workspace.executionRail || workspace.primaryMarket || "kalshi";
  const keyPath = String(env.KALSHI_PRIVATE_KEY_PATH || "");
  const apiKey = String(env.KALSHI_API_KEY_ID || "");
  const liveMode = String(env.OPENTRADEX_EXECUTION_MODE || workspace.mode || "paper").toLowerCase() === "live";
  const demoDisabled = String(env.KALSHI_USE_DEMO || "").toLowerCase() === "false";
  const keyExists = !!keyPath && fs.existsSync(keyPath);

  const checks: LiveReadinessCheck[] = [
    {
      id: "execution_rail",
      label: "Execution rail",
      ok: executionRail === "kalshi",
      detail: executionRail === "kalshi" ? "Kalshi is the active execution rail." : `Execution rail is ${executionRail}.`,
    },
    {
      id: "api_key",
      label: "Kalshi API key",
      ok: Boolean(apiKey),
      detail: apiKey ? "Configured." : "Missing KALSHI_API_KEY_ID.",
    },
    {
      id: "private_key",
      label: "Private key path",
      ok: keyExists,
      detail: keyExists ? keyPath : "Missing or unreadable KALSHI_PRIVATE_KEY_PATH.",
    },
    {
      id: "demo_mode",
      label: "Demo mode disabled",
      ok: demoDisabled,
      detail: demoDisabled ? "Using production Kalshi API." : "KALSHI_USE_DEMO must be false for live trading.",
    },
  ];

  let authProbeOk = false;
  let authProbeMessage = "Auth probe skipped.";
  let balance: number | null = null;

  if (checks.every((check) => check.ok)) {
    const result = await runCommand("python3", ["gossip/kalshi.py", "balance"], PROJECT_ROOT);
    try {
      const parsed = JSON.parse(result.stdout);
      if (typeof parsed.balance === "number") {
        authProbeOk = true;
        balance = centsToDollars(parsed.balance);
        authProbeMessage = "Authenticated balance probe succeeded.";
      } else if (parsed.error) {
        authProbeMessage = String(parsed.error);
      } else {
        authProbeMessage = "Balance probe returned an unexpected payload.";
      }
    } catch {
      authProbeMessage = result.stderr.trim() || "Failed to parse balance probe response.";
    }
  } else {
    authProbeMessage = "Auth probe blocked until local Kalshi prerequisites pass.";
  }

  checks.push({
    id: "auth_probe",
    label: "Authenticated Kalshi probe",
    ok: authProbeOk,
    detail: authProbeMessage,
  });

  return {
    workspace: {
      ...workspace,
      mode: liveMode ? "live" : "paper",
    },
    readiness: {
      canArmLive: checks.every((check) => check.ok),
      checks,
      balance,
      authProbeOk,
      authProbeMessage,
    },
  };
}

export async function GET() {
  if (process.env.VERCEL) {
    return NextResponse.json({
      workspace: getDemoWorkspaceSummary(),
      readiness: {
        canArmLive: false,
        checks: [],
        balance: null,
        authProbeOk: false,
        authProbeMessage: "Hosted preview is read-only.",
      },
    });
  }

  return NextResponse.json(await getWorkspaceStatus());
}

export async function POST(request: Request) {
  if (process.env.VERCEL) {
    return NextResponse.json({ error: "Hosted preview is read-only." }, { status: 400 });
  }

  const body = await request.json();
  const action = String(body.action || "");

  if (action === "set_mode") {
    const mode = String(body.mode || "").toLowerCase();
    if (!["paper", "live"].includes(mode)) {
      return NextResponse.json({ error: "mode must be paper or live" }, { status: 400 });
    }

    if (mode === "live") {
      const status = await getWorkspaceStatus();
      if (!status.readiness.canArmLive) {
        return NextResponse.json(
          { error: "Live mode checks failed", readiness: status.readiness },
          { status: 400 }
        );
      }
      writeEnvValue("OPENTRADEX_EXECUTION_MODE", "live");
      writeEnvValue("LIVE_TRADING", "true");
    } else {
      writeEnvValue("OPENTRADEX_EXECUTION_MODE", "paper");
      writeEnvValue("LIVE_TRADING", "false");
    }

    return NextResponse.json(await getWorkspaceStatus());
  }

  if (action === "refresh_status") {
    return NextResponse.json(await getWorkspaceStatus());
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
