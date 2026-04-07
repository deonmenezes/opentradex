import process from "node:process";
import {
  CHANNEL_OPTIONS,
  DASHBOARD_SURFACE_OPTIONS,
  INTEGRATION_OPTIONS,
  MARKET_OPTIONS,
  PACKAGE_MANAGER_OPTIONS,
  RUNTIME_OPTIONS,
  labelsForIds,
} from "./catalog.mjs";
import {
  collectDoctor,
  formatDoctorReport,
  formatProviderMatrix,
  onboard,
  resolveWorkspace,
  runDashboard,
  runSingleCycle,
  runTradingLoop,
} from "./index.mjs";

export async function runCli(argv = process.argv.slice(2)) {
  const [command = "help", ...rest] = argv;
  const options = parseArgs(rest);

  switch (command) {
    case "help":
    case "--help":
    case "-h":
      printHelp();
      return;
    case "onboard": {
      const result = await onboard(options);
      if (!result) {
        printLines(["OpenTradex onboarding cancelled."]);
        return;
      }

      printLines([
        "OpenTradex profile written.",
        "Our implementation. Your strategy.",
        "",
        "Local harness configured:",
        `  workspace: ${result.workspace}`,
        `  mode: ${result.mode}`,
        `  runtime: ${labelsForIds(RUNTIME_OPTIONS, [result.profile.runtime]).join(", ")}`,
        `  primary market: ${labelsForIds(MARKET_OPTIONS, [result.profile.primaryMarket]).join(", ")}`,
        `  market rails: ${labelsForIds(MARKET_OPTIONS, result.profile.enabledMarkets).join(", ") || "none"}`,
        `  integrations: ${labelsForIds(INTEGRATION_OPTIONS, result.profile.integrations).join(", ") || "none"}`,
        `  dashboard: ${labelsForIds(DASHBOARD_SURFACE_OPTIONS, [result.profile.dashboardSurface]).join(", ")}`,
        `  channels: ${labelsForIds(CHANNEL_OPTIONS, result.profile.channels).join(", ") || "none"}`,
        `  package manager: ${labelsForIds(PACKAGE_MANAGER_OPTIONS, [result.profile.packageManager]).join(", ")}`,
        ...(result.notes.length > 0 ? ["", "Notes:", ...result.notes.map((note) => `  - ${note}`)] : []),
        "",
        "Next:",
        "  1. opentradex doctor",
        "  2. opentradex web",
        "  3. opentradex start",
        "  4. opentradex providers",
      ]);
      return;
    }
    case "doctor": {
      const report = collectDoctor(options.workspace);
      console.log(formatDoctorReport(report));
      return;
    }
    case "providers":
      console.log(formatProviderMatrix());
      return;
    case "start":
      await runTradingLoop(options);
      return;
    case "cycle":
      await runSingleCycle(options);
      return;
    case "web":
      await runDashboard(options);
      return;
    case "where":
      console.log(resolveWorkspace(options.workspace));
      return;
    default:
      throw new Error(`Unknown opentradex command: ${command}`);
  }
}

function parseArgs(argv) {
  const options = {};
  const booleanFlags = new Set(["skip-install", "yes", "install", "force", "paper", "live"]);
  const dashValueKeys = new Set(["tradingview-mcp-args"]);

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      if (!options._) {
        options._ = [];
      }
      options._.push(token);
      continue;
    }

    const normalized = token.slice(2);
    const [key, explicitValue] = normalized.split("=", 2);
    if (explicitValue !== undefined) {
      options[toCamel(key)] = explicitValue;
      continue;
    }

    if (booleanFlags.has(key)) {
      options[toCamel(key)] = true;
      continue;
    }

    const next = argv[index + 1];
    if (dashValueKeys.has(key) && next) {
      options[toCamel(key)] = next;
      index += 1;
      continue;
    }

    if (!next || next.startsWith("--")) {
      options[toCamel(key)] = true;
      continue;
    }

    options[toCamel(key)] = next;
    index += 1;
  }

  return options;
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function printHelp() {
  printLines([
    "opentradex",
    "",
    "OpenTradex CLI",
    "Our implementation. Your strategy.",
    "",
    "Commands:",
    "  opentradex onboard [--workspace <dir>] [--paper|--live] [--llm <id>] [--primary-market <id>] [--dashboard-surface <id>]",
    "  opentradex doctor [--workspace <dir>]",
    "  opentradex providers",
    "  opentradex start [--workspace <dir>] [--interval <seconds>] [--rationale <text>]",
    "  opentradex cycle [--workspace <dir>] [--rationale <text>]",
    "  opentradex web [--workspace <dir>] [--install] [--package-manager npm|bun]",
    "  opentradex where [--workspace <dir>]",
    "",
    "Examples:",
    "  npm install -g opentradex@latest",
    "  bunx opentradex@latest onboard",
    "  opentradex web",
    "  opentradex onboard --llm claude-code --primary-market kalshi --markets polymarket,tradingview --dashboard-surface chat",
    "  opentradex onboard --llm codex-cli --primary-market kalshi --dashboard-surface chat",
    "  opentradex doctor",
    "  opentradex providers",
    "  opentradex cycle --rationale \"Tariffs will escalate next week\"",
  ]);
}

function printLines(lines) {
  console.log(lines.join("\n"));
}
