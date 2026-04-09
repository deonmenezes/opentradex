import fs from "fs";
import path from "path";
import type { WorkspaceSummary } from "@/lib/types";

const PROJECT_ROOT = path.join(process.cwd(), "..");
const ENV_PATH = path.join(PROJECT_ROOT, ".env");
const PROFILE_PATH = path.join(PROJECT_ROOT, "opentradex.config.json");

const DEFAULT_CHANNELS = ["command", "markets", "feeds", "risk", "execution"];
const DEFAULT_WATCHLIST = ["SPY", "QQQ", "BTCUSD", "NQ1!"];

function parseEnv(text: string) {
  const values: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    values[key] = value.replace(/^"(.*)"$/, "$1");
  }
  return values;
}

export function readEnvFile() {
  if (!fs.existsSync(ENV_PATH)) {
    return { values: {}, raw: "" };
  }
  const raw = fs.readFileSync(ENV_PATH, "utf8");
  return { values: parseEnv(raw), raw };
}

export function writeEnvValue(key: string, value: string) {
  const { raw } = readEnvFile();
  const lines = raw.split(/\r?\n/);
  let updated = false;
  const next = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return line;
    }
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      return line;
    }
    const existingKey = line.slice(0, separatorIndex).trim();
    if (existingKey !== key) {
      return line;
    }
    updated = true;
    return `${key}=${value}`;
  });
  if (!updated) {
    next.push(`${key}=${value}`);
  }
  fs.writeFileSync(ENV_PATH, `${next.join("\n").replace(/\n+$/, "")}\n`, "utf8");
}

function readJson(filePath: string) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

function parseCsv(value: unknown, fallback: string[] = []) {
  if (!value) {
    return fallback;
  }

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function readWorkspaceSummary(): WorkspaceSummary | null {
  const hasEnv = fs.existsSync(ENV_PATH);
  const hasProfile = fs.existsSync(PROFILE_PATH);

  if (!hasEnv && !hasProfile) {
    return null;
  }

  const env = hasEnv ? parseEnv(fs.readFileSync(ENV_PATH, "utf8")) : {};
  const profile = hasProfile ? readJson(PROFILE_PATH) : {};

  const enabledMarkets = parseCsv(
    env.OPENTRADEX_ENABLED_MARKETS || profile.enabledMarkets,
    [env.OPENTRADEX_PRIMARY_MARKET || profile.primaryMarket || "kalshi"]
  );
  const integrations = parseCsv(
    env.OPENTRADEX_ENABLED_INTEGRATIONS || profile.integrations,
    ["apify", "rss"]
  );
  const channels = parseCsv(
    env.OPENTRADEX_CHANNELS || profile.channels,
    enabledMarkets.includes("tradingview")
      ? [...DEFAULT_CHANNELS, "tradingview"]
      : DEFAULT_CHANNELS
  );

  const tradingviewEnabled = enabledMarkets.includes("tradingview");
  const connectorMode =
    String(env.TRADINGVIEW_CONNECTOR_MODE || profile.tradingviewConnectorMode || "watchlist").toLowerCase() === "mcp"
      ? "mcp"
      : "watchlist";
  const mcpEnabled =
    String(env.TRADINGVIEW_MCP_ENABLED || profile.tradingviewMcpEnabled || "false").toLowerCase() === "true";
  const transport =
    String(env.TRADINGVIEW_MCP_TRANSPORT || profile.tradingviewMcpTransport || "stdio").toLowerCase() === "http"
      ? "http"
      : "stdio";
  const command = env.TRADINGVIEW_MCP_COMMAND || "";
  const args = env.TRADINGVIEW_MCP_ARGS || "";
  const url = env.TRADINGVIEW_MCP_URL || "";
  const configured = connectorMode === "mcp" && mcpEnabled
    ? transport === "http"
      ? Boolean(url)
      : Boolean(command)
    : false;

  return {
    isDemo: false,
    runtime: String(env.OPENTRADEX_RUNTIME || profile.runtime || "codex-cli"),
    packageManager: String(env.OPENTRADEX_PACKAGE_MANAGER || profile.packageManager || "npm"),
    mode: String(env.OPENTRADEX_EXECUTION_MODE || profile.mode || "paper"),
    primaryMarket: String(env.OPENTRADEX_PRIMARY_MARKET || profile.primaryMarket || "kalshi"),
    enabledMarkets,
    integrations,
    dashboardSurface: String(env.OPENTRADEX_DASHBOARD_SURFACE || profile.dashboardSurface || "chat"),
    channels,
    executionRail: String(env.OPENTRADEX_LIVE_EXECUTION_MARKET || profile.primaryMarket || env.OPENTRADEX_PRIMARY_MARKET || "kalshi"),
    researchRails: enabledMarkets.filter((market) => market !== String(env.OPENTRADEX_LIVE_EXECUTION_MARKET || profile.primaryMarket || env.OPENTRADEX_PRIMARY_MARKET || "kalshi")),
    tradingview: {
      enabled: tradingviewEnabled,
      watchlist: parseCsv(env.TRADINGVIEW_WATCHLIST, DEFAULT_WATCHLIST),
      connectorMode,
      mcpEnabled,
      transport,
      command,
      args,
      url,
      configured,
    },
  };
}
