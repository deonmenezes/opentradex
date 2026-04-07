import { cpSync, copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { homedir } from "node:os";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import {
  CHANNEL_OPTIONS,
  DASHBOARD_SURFACE_OPTIONS,
  INTEGRATION_OPTIONS,
  MCP_TRANSPORT_OPTIONS,
  MARKET_OPTIONS,
  PACKAGE_MANAGER_OPTIONS,
  RUNTIME_OPTIONS,
  TRADINGVIEW_CONNECTOR_OPTIONS,
  formatOptionLines,
  getOptionById,
  keepKnownIds,
  labelsForIds,
  uniqueIds,
} from "./catalog.mjs";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_DIR = path.join(homedir(), ".opentradex");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");
const DEFAULT_WORKSPACE = path.join(homedir(), "opentradex");
const WORKSPACE_PROFILE_FILENAME = "opentradex.config.json";

const PROJECT_TEMPLATE_ENTRIES = [
  ".env.example",
  ".gitignore",
  "README.md",
  "CLAUDE.md",
  "SOUL.md",
  "SPEC.md",
  "SUBMISSION.md",
  "architecture.excalidraw",
  "architecture.png",
  "main.py",
  "requirements.txt",
  "gossip",
  "data",
  "web",
  "scripts",
];

const DEFAULT_ENV = {
  OPENTRADEX_RUNTIME: "claude-code",
  OPENTRADEX_PACKAGE_MANAGER: "npm",
  OPENTRADEX_EXECUTION_MODE: "paper",
  OPENTRADEX_PRIMARY_MARKET: "kalshi",
  OPENTRADEX_ENABLED_MARKETS: "kalshi",
  OPENTRADEX_ENABLED_INTEGRATIONS: "apify,rss",
  OPENTRADEX_LIVE_EXECUTION_MARKET: "kalshi",
  OPENTRADEX_DASHBOARD_SURFACE: "chat",
  OPENTRADEX_CHANNELS: "command,markets,feeds,risk,execution",
  KALSHI_API_KEY_ID: "",
  KALSHI_PRIVATE_KEY_PATH: "",
  KALSHI_USE_DEMO: "true",
  POLYMARKET_GAMMA_URL: "https://gamma-api.polymarket.com",
  POLYMARKET_WALLET_ADDRESS: "",
  POLYMARKET_PRIVATE_KEY: "",
  TRADINGVIEW_USERNAME: "",
  TRADINGVIEW_PASSWORD: "",
  TRADINGVIEW_WATCHLIST: "SPY,QQQ,BTCUSD,NQ1!",
  TRADINGVIEW_CONNECTOR_MODE: "watchlist",
  TRADINGVIEW_MCP_ENABLED: "false",
  TRADINGVIEW_MCP_TRANSPORT: "stdio",
  TRADINGVIEW_MCP_COMMAND: "",
  TRADINGVIEW_MCP_ARGS: "",
  TRADINGVIEW_MCP_URL: "",
  ROBINHOOD_USERNAME: "",
  ROBINHOOD_PASSWORD: "",
  ROBINHOOD_MFA_CODE: "",
  GROWW_ACCESS_TOKEN: "",
  OPENAI_API_KEY: "",
  GEMINI_API_KEY: "",
  OPENTRADEX_CODEX_MODEL: "",
  OPENTRADEX_CODEX_PROFILE: "",
  OPENTRADEX_CODEX_SANDBOX: "workspace-write",
  OPENTRADEX_CODEX_FULL_AUTO: "true",
  OPENTRADEX_CODEX_ENABLE_SEARCH: "false",
  APIFY_API_TOKEN: "",
  NEWS_PROVIDER: "apify,rss",
  BANKROLL: "30.00",
  MIN_EDGE: "0.10",
  MAX_POSITION_PCT: "0.30",
  CYCLE_INTERVAL: "900",
  LIVE_TRADING: "false",
};

export function getPackageRoot() {
  return PACKAGE_ROOT;
}

export function getDefaultWorkspace() {
  return DEFAULT_WORKSPACE;
}

export function readTradexConfig() {
  return normalizeConfig(readJson(CONFIG_PATH, {}));
}

export function writeTradexConfig(config) {
  ensureDir(path.dirname(CONFIG_PATH));
  writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export function resolveWorkspace(workspace) {
  const savedWorkspace = readTradexConfig().workspace;
  return path.resolve(workspace || savedWorkspace || DEFAULT_WORKSPACE);
}

export function readWorkspaceProfile(workspaceArg) {
  const workspace = resolveWorkspace(workspaceArg);
  const profilePath = path.join(workspace, WORKSPACE_PROFILE_FILENAME);
  return normalizeConfig(readJson(profilePath, { workspace }));
}

export function writeWorkspaceProfile(workspace, profile) {
  const profilePath = path.join(workspace, WORKSPACE_PROFILE_FILENAME);
  const payload = {
    workspace,
    runtime: profile.runtime,
    packageManager: profile.packageManager,
    mode: profile.mode,
    primaryMarket: profile.primaryMarket,
    enabledMarkets: uniqueIds(profile.enabledMarkets),
    integrations: uniqueIds(profile.integrations),
    dashboardSurface: profile.dashboardSurface,
    channels: uniqueIds(profile.channels),
    tradingviewConnectorMode: profile.tradingviewConnectorMode,
    tradingviewMcpEnabled: Boolean(profile.tradingviewMcpEnabled),
    tradingviewMcpTransport: profile.tradingviewMcpTransport,
    bankroll: Number(profile.bankroll).toFixed(2),
    interval: Number(profile.interval),
    installDeps: Boolean(profile.installDeps),
    notes: profile.notes || [],
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(profilePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export function parseEnv(text) {
  const values = {};

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

export function buildEnv(overrides = {}) {
  const env = { ...DEFAULT_ENV };

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined || value === null) {
      continue;
    }
    env[key] = String(value);
  }

  return env;
}

export function writeEnvFile(workspace, overrides = {}) {
  const envPath = path.join(workspace, ".env");
  const current = existsSync(envPath) ? parseEnv(readFileSync(envPath, "utf8")) : {};
  const env = buildEnv({ ...current, ...overrides });

  const sections = [
    {
      title: "Welcome to OpenTradex",
      lines: [
        "# Our implementation. Your strategy.",
        "# Generated by `opentradex onboard`.",
        "# Run `opentradex doctor` after editing any values here.",
      ],
    },
    {
      title: "Runtime profile",
      keys: [
        "OPENTRADEX_RUNTIME",
        "OPENTRADEX_PACKAGE_MANAGER",
        "OPENTRADEX_EXECUTION_MODE",
        "OPENTRADEX_PRIMARY_MARKET",
        "OPENTRADEX_ENABLED_MARKETS",
        "OPENTRADEX_ENABLED_INTEGRATIONS",
        "OPENTRADEX_LIVE_EXECUTION_MARKET",
        "OPENTRADEX_DASHBOARD_SURFACE",
        "OPENTRADEX_CHANNELS",
        "NEWS_PROVIDER",
      ],
    },
    {
      title: "Risk configuration",
      keys: [
        "BANKROLL",
        "MIN_EDGE",
        "MAX_POSITION_PCT",
        "CYCLE_INTERVAL",
        "LIVE_TRADING",
      ],
    },
    {
      title: "Kalshi",
      keys: [
        "KALSHI_API_KEY_ID",
        "KALSHI_PRIVATE_KEY_PATH",
        "KALSHI_USE_DEMO",
      ],
    },
    {
      title: "Polymarket",
      keys: [
        "POLYMARKET_GAMMA_URL",
        "POLYMARKET_WALLET_ADDRESS",
        "POLYMARKET_PRIVATE_KEY",
      ],
    },
    {
      title: "TradingView",
      keys: [
        "TRADINGVIEW_USERNAME",
        "TRADINGVIEW_PASSWORD",
        "TRADINGVIEW_WATCHLIST",
        "TRADINGVIEW_CONNECTOR_MODE",
        "TRADINGVIEW_MCP_ENABLED",
        "TRADINGVIEW_MCP_TRANSPORT",
        "TRADINGVIEW_MCP_COMMAND",
        "TRADINGVIEW_MCP_ARGS",
        "TRADINGVIEW_MCP_URL",
      ],
    },
    {
      title: "Robinhood and Groww",
      keys: [
        "ROBINHOOD_USERNAME",
        "ROBINHOOD_PASSWORD",
        "ROBINHOOD_MFA_CODE",
        "GROWW_ACCESS_TOKEN",
      ],
    },
    {
      title: "LLM provider secrets",
      keys: [
        "OPENAI_API_KEY",
        "GEMINI_API_KEY",
      ],
    },
    {
      title: "Codex CLI",
      keys: [
        "OPENTRADEX_CODEX_MODEL",
        "OPENTRADEX_CODEX_PROFILE",
        "OPENTRADEX_CODEX_SANDBOX",
        "OPENTRADEX_CODEX_FULL_AUTO",
        "OPENTRADEX_CODEX_ENABLE_SEARCH",
      ],
    },
    {
      title: "Data integrations",
      keys: [
        "APIFY_API_TOKEN",
      ],
    },
  ];

  const lines = [];
  for (const section of sections) {
    lines.push(`# ${section.title}`);
    if (section.lines) {
      lines.push(...section.lines);
    }
    if (section.keys) {
      lines.push(...section.keys.map((key) => `${key}=${env[key] ?? ""}`));
    }
    lines.push("");
  }

  writeFileSync(envPath, `${lines.join("\n")}\n`, "utf8");
  return env;
}

export function ensureWorkspaceFiles(workspace, options = {}) {
  ensureDir(workspace);

  for (const entry of PROJECT_TEMPLATE_ENTRIES) {
    const src = path.join(PACKAGE_ROOT, entry);
    const dest = path.join(workspace, entry);

    if (!existsSync(src)) {
      continue;
    }

    if (statSync(src).isDirectory()) {
      cpSync(src, dest, { recursive: true, force: Boolean(options.force) });
      continue;
    }

    if (!existsSync(dest) || options.force) {
      ensureDir(path.dirname(dest));
      copyFileSync(src, dest);
    }
  }

  ensureDir(path.join(workspace, "data"));
}

export function collectDoctor(workspaceArg) {
  const workspace = resolveWorkspace(workspaceArg);
  const envPath = path.join(workspace, ".env");
  const env = existsSync(envPath) ? parseEnv(readFileSync(envPath, "utf8")) : {};
  const config = normalizeConfig({
    ...readTradexConfig(),
    ...readWorkspaceProfile(workspace),
  });
  const liveTrading = String(env.LIVE_TRADING || "").toLowerCase() === "true";
  const runtime = config.runtime || env.OPENTRADEX_RUNTIME || "claude-code";
  const packageManager = config.packageManager || env.OPENTRADEX_PACKAGE_MANAGER || "npm";
  const primaryMarket = config.primaryMarket || env.OPENTRADEX_PRIMARY_MARKET || "kalshi";
  const dashboardSurface = config.dashboardSurface || env.OPENTRADEX_DASHBOARD_SURFACE || DEFAULT_ENV.OPENTRADEX_DASHBOARD_SURFACE;
  const channels = keepKnownIds(
    CHANNEL_OPTIONS,
    config.channels?.length ? config.channels : env.OPENTRADEX_CHANNELS || DEFAULT_ENV.OPENTRADEX_CHANNELS
  );
  const enabledMarkets = keepKnownIds(
    MARKET_OPTIONS,
    config.enabledMarkets?.length ? config.enabledMarkets : env.OPENTRADEX_ENABLED_MARKETS || primaryMarket
  );
  const integrations = keepKnownIds(
    INTEGRATION_OPTIONS,
    config.integrations?.length ? config.integrations : env.OPENTRADEX_ENABLED_INTEGRATIONS || "apify,rss"
  );
  const tradingviewConnectorMode =
    String(config.tradingviewConnectorMode || env.TRADINGVIEW_CONNECTOR_MODE || DEFAULT_ENV.TRADINGVIEW_CONNECTOR_MODE).toLowerCase() === "mcp"
      ? "mcp"
      : "watchlist";
  const tradingviewMcpEnabled =
    String(config.tradingviewMcpEnabled ?? env.TRADINGVIEW_MCP_ENABLED ?? DEFAULT_ENV.TRADINGVIEW_MCP_ENABLED).toLowerCase() === "true";
  const tradingviewMcpTransport =
    String(config.tradingviewMcpTransport || env.TRADINGVIEW_MCP_TRANSPORT || DEFAULT_ENV.TRADINGVIEW_MCP_TRANSPORT).toLowerCase() === "http"
      ? "http"
      : "stdio";

  const checks = [
    check("Node.js", commandWorks("node", ["-v"]), "Install Node.js 22+."),
    check("npm", commandWorks("npm", ["-v"]), "Install npm or use the Node.js installer."),
    check("curl", commandWorks(process.platform === "win32" ? "curl.exe" : "curl", ["--version"]), "Install curl so the bootstrap path works."),
    check("Python", commandWorks("python", ["--version"]), "Install Python 3.11+."),
    check("Workspace", existsSync(path.join(workspace, "main.py")), "Run `opentradex onboard` to create a workspace."),
    check(".env", existsSync(envPath), "Run `opentradex onboard` to generate `.env`."),
    check("Saved workspace", Boolean(config.workspace), "Run `opentradex onboard` once so the CLI remembers your workspace."),
  ];

  if (packageManager === "bun") {
    checks.push(check("Bun", commandWorks("bun", ["--version"]), "Install Bun or switch back to npm in your OpenTradex profile."));
  }

  if (runtime === "claude-code") {
    checks.push(check("Claude CLI", commandWorks("claude", ["--version"]), "Install and sign in to Claude Code."));
  }
  if (runtime === "codex-cli") {
    checks.push(check("Codex CLI", commandWorks("codex", ["--version"]), "Install and sign in to Codex CLI."));
  }
  if (runtime === "openai-api") {
    checks.push(check("OPENAI_API_KEY", Boolean(env.OPENAI_API_KEY), "Add OPENAI_API_KEY if you want to extend the OpenAI runtime profile."));
  }
  if (runtime === "gemini-cli") {
    checks.push(check("GEMINI_API_KEY", Boolean(env.GEMINI_API_KEY), "Add GEMINI_API_KEY if you want to extend the Gemini runtime profile."));
  }

  if (enabledMarkets.includes("kalshi")) {
    checks.push(
      check(
        "Kalshi creds",
        !liveTrading || (Boolean(env.KALSHI_API_KEY_ID) && Boolean(env.KALSHI_PRIVATE_KEY_PATH)),
        "Set KALSHI_API_KEY_ID and KALSHI_PRIVATE_KEY_PATH for live Kalshi execution."
      )
    );
  }

  if (enabledMarkets.includes("polymarket")) {
    checks.push(
      check(
        "Polymarket discovery rail",
        Boolean(env.POLYMARKET_GAMMA_URL),
        "Set POLYMARKET_GAMMA_URL if you want to override the default Gamma endpoint."
      )
    );
  }

  if (enabledMarkets.includes("tradingview")) {
    checks.push(
      check(
        "TradingView watchlist",
        Boolean(env.TRADINGVIEW_WATCHLIST),
        "Add TRADINGVIEW_WATCHLIST so the agent has symbols to monitor."
      )
    );
    if (tradingviewConnectorMode === "mcp" || tradingviewMcpEnabled) {
      checks.push(
        check(
          "TradingView MCP",
          tradingviewMcpTransport === "http" ? Boolean(env.TRADINGVIEW_MCP_URL) : Boolean(env.TRADINGVIEW_MCP_COMMAND),
          tradingviewMcpTransport === "http"
            ? "Set TRADINGVIEW_MCP_URL to your TradingView MCP endpoint."
            : "Set TRADINGVIEW_MCP_COMMAND and optional TRADINGVIEW_MCP_ARGS for your local TradingView MCP server."
        )
      );
    }
  }

  if (integrations.includes("apify") || integrations.includes("twitter") || integrations.includes("tiktok")) {
    checks.push(check("APIFY_API_TOKEN", Boolean(env.APIFY_API_TOKEN), "Add your Apify token for news and social scraping."));
  }

  return {
    workspace,
    profile: {
      runtime,
      packageManager,
      dashboardSurface,
      channels,
      mode: liveTrading ? "live" : config.mode || env.OPENTRADEX_EXECUTION_MODE || "paper",
      primaryMarket,
      enabledMarkets,
      integrations,
      tradingviewConnectorMode,
      tradingviewMcpEnabled,
      tradingviewMcpTransport,
    },
    checks,
    notes: buildDoctorNotes({
      runtime,
      primaryMarket,
      enabledMarkets,
      liveTrading,
      dashboardSurface,
      channels,
      tradingviewConnectorMode,
      tradingviewMcpEnabled,
      tradingviewMcpTransport,
    }),
  };
}

export async function onboard(options = {}) {
  const saved = readTradexConfig();
  const interactive = process.stdin.isTTY && !options.yes;
  const rl = interactive ? createInterface({ input: process.stdin, output: process.stdout }) : null;
  const notes = [];

  try {
    printWelcomeBanner();

    if (interactive) {
      printSecurityNotice();
      const accepted = await confirm(rl, "I understand this is powerful and inherently risky. Continue?", false);
      if (!accepted) {
        return null;
      }
      printSection("1/7", "workspace", "Choose where OpenTradex should create or reuse the local harness.");
    }

    const workspace = path.resolve(
      options.workspace ||
        (interactive
          ? await ask(rl, "Workspace directory", saved.workspace || DEFAULT_WORKSPACE)
          : saved.workspace || DEFAULT_WORKSPACE)
    );
    const currentEnvPath = path.join(workspace, ".env");
    const currentEnv = existsSync(currentEnvPath) ? parseEnv(readFileSync(currentEnvPath, "utf8")) : {};
    const savedProfile = normalizeConfig({
      ...saved,
      ...readWorkspaceProfile(workspace),
    });
    const workspaceExists = existsSync(path.join(workspace, "main.py"));

    if (interactive && workspaceExists && !(await confirm(rl, `Reuse existing workspace at ${workspace}`, true))) {
      return null;
    }

    if (interactive) {
      printSection("2/7", "runtime", "Pick the operator runtime and package flow for this machine.");
    }

    const runtime = interactive
      ? await chooseOption(
          rl,
          "Select operator runtime",
          RUNTIME_OPTIONS,
          options.llm || options.runtime || savedProfile.runtime || currentEnv.OPENTRADEX_RUNTIME || "claude-code"
        )
      : getOptionById(RUNTIME_OPTIONS, options.llm || options.runtime || savedProfile.runtime || currentEnv.OPENTRADEX_RUNTIME, "claude-code").id;

    const packageManager = interactive
      ? await chooseOption(
          rl,
          "Select package manager",
          PACKAGE_MANAGER_OPTIONS,
          options.packageManager || savedProfile.packageManager || currentEnv.OPENTRADEX_PACKAGE_MANAGER || "npm"
        )
      : getOptionById(
          PACKAGE_MANAGER_OPTIONS,
          options.packageManager || savedProfile.packageManager || currentEnv.OPENTRADEX_PACKAGE_MANAGER,
          "npm"
        ).id;

    if (interactive) {
      printSection("3/7", "market rails", "Pick the execution rail first, then enable any additional discovery or watchlist rails.");
    }

    const primaryMarket = interactive
      ? await chooseOption(
          rl,
          "Select primary market",
          MARKET_OPTIONS,
          options.primaryMarket || options.market || savedProfile.primaryMarket || currentEnv.OPENTRADEX_PRIMARY_MARKET || "kalshi"
        )
      : getOptionById(
          MARKET_OPTIONS,
          options.primaryMarket || options.market || savedProfile.primaryMarket || currentEnv.OPENTRADEX_PRIMARY_MARKET,
          "kalshi"
        ).id;

    const defaultMarkets = uniqueIds(
      options.markets ||
        savedProfile.enabledMarkets ||
        currentEnv.OPENTRADEX_ENABLED_MARKETS ||
        [primaryMarket]
    ).filter((item) => item !== primaryMarket);

    const extraMarkets = interactive
      ? await chooseMany(
          rl,
          "Enable additional market rails",
          MARKET_OPTIONS.filter((item) => item.id !== primaryMarket),
          defaultMarkets
        )
      : keepKnownIds(MARKET_OPTIONS, options.markets || defaultMarkets).filter((item) => item !== primaryMarket);

    const enabledMarkets = uniqueIds([primaryMarket, ...extraMarkets]);

    const availableChannels = enabledMarkets.includes("tradingview")
      ? CHANNEL_OPTIONS
      : CHANNEL_OPTIONS.filter((item) => item.id !== "tradingview");

    if (interactive) {
      printSection("4/7", "operator channels", "Choose the dashboard surface and the messaging lanes your operator cockpit should keep online.");
    }

    const dashboardSurface = interactive
      ? await chooseOption(
          rl,
          "Select dashboard surface",
          DASHBOARD_SURFACE_OPTIONS,
          options.dashboardSurface || savedProfile.dashboardSurface || currentEnv.OPENTRADEX_DASHBOARD_SURFACE || DEFAULT_ENV.OPENTRADEX_DASHBOARD_SURFACE
        )
      : getOptionById(
          DASHBOARD_SURFACE_OPTIONS,
          options.dashboardSurface || savedProfile.dashboardSurface || currentEnv.OPENTRADEX_DASHBOARD_SURFACE,
          DEFAULT_ENV.OPENTRADEX_DASHBOARD_SURFACE
        ).id;

    const defaultChannels = keepKnownIds(
      availableChannels,
      options.channels || savedProfile.channels || currentEnv.OPENTRADEX_CHANNELS || DEFAULT_ENV.OPENTRADEX_CHANNELS
    );

    const channels = interactive
      ? await chooseMany(rl, "Enable operator channels", availableChannels, defaultChannels)
      : defaultChannels;

    const defaultIntegrations = keepKnownIds(
      INTEGRATION_OPTIONS,
      options.integrations || savedProfile.integrations || currentEnv.OPENTRADEX_ENABLED_INTEGRATIONS || "apify,rss"
    );

    if (interactive) {
      printSection("5/7", "data feeds", "Enable only the context feeds you want. Optional integrations stay optional.");
    }

    const integrations = interactive
      ? await chooseMany(rl, "Enable optional data integrations", INTEGRATION_OPTIONS, defaultIntegrations)
      : defaultIntegrations;

    if (interactive) {
      printSection("6/7", "guardrails", "Set trading mode, bankroll, and loop interval before anything gets close to execution.");
    }

    const mode =
      options.live ? "live" : options.paper ? "paper" : interactive ? await chooseMode(rl, savedProfile.mode || "paper") : savedProfile.mode || "paper";

    const bankroll =
      options.bankroll ??
      (interactive ? await ask(rl, "Starting bankroll (USD)", String(savedProfile.bankroll || DEFAULT_ENV.BANKROLL)) : savedProfile.bankroll || DEFAULT_ENV.BANKROLL);

    const interval =
      options.interval ??
      (interactive
        ? await ask(rl, "Loop interval in seconds", String(savedProfile.interval || DEFAULT_ENV.CYCLE_INTERVAL))
        : savedProfile.interval || DEFAULT_ENV.CYCLE_INTERVAL);

    if (interactive) {
      printSection("7/7", "credentials", "Enter only the keys and watchlists you need. Blank values stay blank unless you enable live Kalshi.");
    }

    const apifyToken =
      options.apifyToken ??
      (interactive && integrations.includes("apify")
        ? await ask(rl, "Apify API token", currentEnv.APIFY_API_TOKEN || "")
        : currentEnv.APIFY_API_TOKEN || "");

    const kalshiKeyId =
      enabledMarkets.includes("kalshi") && mode === "live"
        ? options.kalshiKeyId ??
          (interactive ? await ask(rl, "Kalshi API key id", currentEnv.KALSHI_API_KEY_ID || "") : currentEnv.KALSHI_API_KEY_ID || "")
        : currentEnv.KALSHI_API_KEY_ID || "";

    const kalshiPrivateKeyPath =
      enabledMarkets.includes("kalshi") && mode === "live"
        ? options.kalshiPrivateKeyPath ??
          (interactive
            ? await ask(rl, "Kalshi private key path", currentEnv.KALSHI_PRIVATE_KEY_PATH || "")
            : currentEnv.KALSHI_PRIVATE_KEY_PATH || "")
        : currentEnv.KALSHI_PRIVATE_KEY_PATH || "";

    const polymarketWalletAddress =
      enabledMarkets.includes("polymarket")
        ? options.polymarketWalletAddress ??
          (interactive
            ? await ask(rl, "Polymarket wallet address (optional)", currentEnv.POLYMARKET_WALLET_ADDRESS || "")
            : currentEnv.POLYMARKET_WALLET_ADDRESS || "")
        : currentEnv.POLYMARKET_WALLET_ADDRESS || "";

    const polymarketPrivateKey =
      enabledMarkets.includes("polymarket")
        ? options.polymarketPrivateKey ??
          (interactive
            ? await ask(rl, "Polymarket private key (optional)", currentEnv.POLYMARKET_PRIVATE_KEY || "")
            : currentEnv.POLYMARKET_PRIVATE_KEY || "")
        : currentEnv.POLYMARKET_PRIVATE_KEY || "";

    const tradingviewWatchlist =
      enabledMarkets.includes("tradingview")
        ? options.tradingviewWatchlist ??
          (interactive
            ? await ask(rl, "TradingView watchlist", currentEnv.TRADINGVIEW_WATCHLIST || DEFAULT_ENV.TRADINGVIEW_WATCHLIST)
            : currentEnv.TRADINGVIEW_WATCHLIST || DEFAULT_ENV.TRADINGVIEW_WATCHLIST)
        : currentEnv.TRADINGVIEW_WATCHLIST || DEFAULT_ENV.TRADINGVIEW_WATCHLIST;

    const tradingviewConnectorMode =
      enabledMarkets.includes("tradingview")
        ? interactive
          ? await chooseOption(
              rl,
              "TradingView connector mode",
              TRADINGVIEW_CONNECTOR_OPTIONS,
              options.tradingviewConnectorMode ||
                savedProfile.tradingviewConnectorMode ||
                currentEnv.TRADINGVIEW_CONNECTOR_MODE ||
                DEFAULT_ENV.TRADINGVIEW_CONNECTOR_MODE
            )
          : getOptionById(
              TRADINGVIEW_CONNECTOR_OPTIONS,
              options.tradingviewConnectorMode ||
                savedProfile.tradingviewConnectorMode ||
                currentEnv.TRADINGVIEW_CONNECTOR_MODE,
              DEFAULT_ENV.TRADINGVIEW_CONNECTOR_MODE
            ).id
        : currentEnv.TRADINGVIEW_CONNECTOR_MODE || DEFAULT_ENV.TRADINGVIEW_CONNECTOR_MODE;

    const tradingviewMcpTransport =
      enabledMarkets.includes("tradingview") && tradingviewConnectorMode === "mcp"
        ? interactive
          ? await chooseOption(
              rl,
              "TradingView MCP transport",
              MCP_TRANSPORT_OPTIONS,
              options.tradingviewMcpTransport ||
                savedProfile.tradingviewMcpTransport ||
                currentEnv.TRADINGVIEW_MCP_TRANSPORT ||
                DEFAULT_ENV.TRADINGVIEW_MCP_TRANSPORT
            )
          : getOptionById(
              MCP_TRANSPORT_OPTIONS,
              options.tradingviewMcpTransport ||
                savedProfile.tradingviewMcpTransport ||
                currentEnv.TRADINGVIEW_MCP_TRANSPORT,
              DEFAULT_ENV.TRADINGVIEW_MCP_TRANSPORT
            ).id
        : currentEnv.TRADINGVIEW_MCP_TRANSPORT || DEFAULT_ENV.TRADINGVIEW_MCP_TRANSPORT;

    const tradingviewMcpEnabled =
      enabledMarkets.includes("tradingview") && tradingviewConnectorMode === "mcp"
        ? options.tradingviewMcpEnabled ??
          (interactive
            ? await confirm(rl, "Enable TradingView MCP for this workspace", true)
            : String(savedProfile.tradingviewMcpEnabled ?? currentEnv.TRADINGVIEW_MCP_ENABLED ?? "true").toLowerCase() === "true")
        : false;

    const tradingviewMcpCommand =
      tradingviewMcpEnabled && tradingviewMcpTransport === "stdio"
        ? options.tradingviewMcpCommand ??
          (interactive
            ? await ask(rl, "TradingView MCP command", currentEnv.TRADINGVIEW_MCP_COMMAND || "")
            : currentEnv.TRADINGVIEW_MCP_COMMAND || "")
        : currentEnv.TRADINGVIEW_MCP_COMMAND || "";

    const tradingviewMcpArgs =
      tradingviewMcpEnabled && tradingviewMcpTransport === "stdio"
        ? options.tradingviewMcpArgs ??
          (interactive
            ? await ask(rl, "TradingView MCP args (optional)", currentEnv.TRADINGVIEW_MCP_ARGS || "")
            : currentEnv.TRADINGVIEW_MCP_ARGS || "")
        : currentEnv.TRADINGVIEW_MCP_ARGS || "";

    const tradingviewMcpUrl =
      tradingviewMcpEnabled && tradingviewMcpTransport === "http"
        ? options.tradingviewMcpUrl ??
          (interactive
            ? await ask(rl, "TradingView MCP URL", currentEnv.TRADINGVIEW_MCP_URL || "")
            : currentEnv.TRADINGVIEW_MCP_URL || "")
        : currentEnv.TRADINGVIEW_MCP_URL || "";

    const robinhoodUsername =
      enabledMarkets.includes("robinhood")
        ? options.robinhoodUsername ??
          (interactive
            ? await ask(rl, "Robinhood username (optional)", currentEnv.ROBINHOOD_USERNAME || "")
            : currentEnv.ROBINHOOD_USERNAME || "")
        : currentEnv.ROBINHOOD_USERNAME || "";

    const robinhoodPassword =
      enabledMarkets.includes("robinhood")
        ? options.robinhoodPassword ??
          (interactive
            ? await ask(rl, "Robinhood password (optional)", currentEnv.ROBINHOOD_PASSWORD || "")
            : currentEnv.ROBINHOOD_PASSWORD || "")
        : currentEnv.ROBINHOOD_PASSWORD || "";

    const growwAccessToken =
      enabledMarkets.includes("groww")
        ? options.growwAccessToken ??
          (interactive
            ? await ask(rl, "Groww access token (optional)", currentEnv.GROWW_ACCESS_TOKEN || "")
            : currentEnv.GROWW_ACCESS_TOKEN || "")
        : currentEnv.GROWW_ACCESS_TOKEN || "";

    if (mode === "live" && primaryMarket !== "kalshi") {
      notes.push("Live execution is currently wired through Kalshi. This workspace has been kept in paper mode while the extra rails stay enabled.");
    }

    if (dashboardSurface === "chat") {
      notes.push("Dashboard chat cockpit is enabled with operator channels for command, markets, feeds, risk, and execution.");
    }

    if (enabledMarkets.includes("tradingview") && tradingviewConnectorMode !== "mcp") {
      notes.push("TradingView is configured in watchlist mode. Add an MCP connector later if you want richer chart and symbol context.");
    }

    if (tradingviewMcpEnabled && tradingviewMcpTransport === "stdio" && !tradingviewMcpCommand) {
      notes.push("TradingView MCP was enabled without a command. The dashboard will show the connector as incomplete until you fill it in.");
    }

    if (tradingviewMcpEnabled && tradingviewMcpTransport === "http" && !tradingviewMcpUrl) {
      notes.push("TradingView MCP was enabled without a URL. The dashboard will show the connector as incomplete until you fill it in.");
    }

    const effectiveMode = mode === "live" && primaryMarket === "kalshi" ? "live" : "paper";
    const installDeps =
      options.install ?? (options.skipInstall ? false : interactive ? await confirm(rl, "Install Python and web dependencies now", true) : true);

    ensureWorkspaceFiles(workspace, { force: Boolean(options.force) });

    const env = writeEnvFile(workspace, {
      OPENTRADEX_RUNTIME: runtime,
      OPENTRADEX_PACKAGE_MANAGER: packageManager,
      OPENTRADEX_EXECUTION_MODE: effectiveMode,
      OPENTRADEX_PRIMARY_MARKET: primaryMarket,
      OPENTRADEX_ENABLED_MARKETS: enabledMarkets.join(","),
      OPENTRADEX_ENABLED_INTEGRATIONS: integrations.join(","),
      OPENTRADEX_LIVE_EXECUTION_MARKET: "kalshi",
      OPENTRADEX_DASHBOARD_SURFACE: dashboardSurface,
      OPENTRADEX_CHANNELS: channels.join(","),
      NEWS_PROVIDER: integrations.join(","),
      APIFY_API_TOKEN: apifyToken,
      BANKROLL: Number(bankroll).toFixed(2),
      CYCLE_INTERVAL: String(interval),
      KALSHI_USE_DEMO: effectiveMode === "live" ? "false" : "true",
      LIVE_TRADING: effectiveMode === "live" ? "true" : "false",
      KALSHI_API_KEY_ID: kalshiKeyId,
      KALSHI_PRIVATE_KEY_PATH: kalshiPrivateKeyPath,
      POLYMARKET_WALLET_ADDRESS: polymarketWalletAddress,
      POLYMARKET_PRIVATE_KEY: polymarketPrivateKey,
      TRADINGVIEW_WATCHLIST: tradingviewWatchlist,
      TRADINGVIEW_CONNECTOR_MODE: tradingviewConnectorMode,
      TRADINGVIEW_MCP_ENABLED: tradingviewMcpEnabled ? "true" : "false",
      TRADINGVIEW_MCP_TRANSPORT: tradingviewMcpTransport,
      TRADINGVIEW_MCP_COMMAND: tradingviewMcpCommand,
      TRADINGVIEW_MCP_ARGS: tradingviewMcpArgs,
      TRADINGVIEW_MCP_URL: tradingviewMcpUrl,
      ROBINHOOD_USERNAME: robinhoodUsername,
      ROBINHOOD_PASSWORD: robinhoodPassword,
      GROWW_ACCESS_TOKEN: growwAccessToken,
    });

    const profile = {
      workspace,
      runtime,
      packageManager,
      mode: effectiveMode,
      primaryMarket,
      enabledMarkets,
      integrations,
      dashboardSurface,
      channels,
      tradingviewConnectorMode,
      tradingviewMcpEnabled,
      tradingviewMcpTransport,
      bankroll,
      interval,
      installDeps,
      notes,
    };

    writeWorkspaceProfile(workspace, profile);
    writeTradexConfig({
      workspace,
      runtime,
      packageManager,
      mode: effectiveMode,
      primaryMarket,
      enabledMarkets,
      integrations,
      dashboardSurface,
      channels,
      tradingviewConnectorMode,
      tradingviewMcpEnabled,
      tradingviewMcpTransport,
      bankroll: Number(bankroll).toFixed(2),
      interval: Number(interval),
      installedAt: new Date().toISOString(),
    });

    if (installDeps) {
      if (interactive) {
        printSection("BOOT", "local launch", "Installing the requested Python and dashboard dependencies.");
      }
      await runCommand("python", ["-m", "pip", "install", "-r", "requirements.txt"], { cwd: workspace });
      await runPackageInstall(packageManager, path.join(workspace, "web"));
      notes.push("Local dependencies were installed for Python and the dashboard.");
    } else {
      notes.push("Dependency install was skipped. You can still boot later with `pip install -r requirements.txt` and a dashboard package install.");
    }

    return {
      workspace,
      mode: effectiveMode,
      env,
      interval: Number(interval),
      installDeps,
      profile,
      notes,
    };
  } finally {
    rl?.close();
  }
}

export async function runTradingLoop(options = {}) {
  const workspace = resolveWorkspace(options.workspace);
  const config = readTradexConfig();
  const args = ["main.py", "--loop"];

  if (options.interval || config.interval) {
    args.push("--interval", String(options.interval || config.interval));
  }

  if (options.rationale) {
    args.push("--rationale", options.rationale);
  }

  await runCommand("python", args, { cwd: workspace });
}

export async function runSingleCycle(options = {}) {
  const workspace = resolveWorkspace(options.workspace);
  const args = ["main.py"];

  if (options.rationale) {
    args.push("--rationale", options.rationale);
  }

  if (options.prompt) {
    args.push("--prompt", options.prompt);
  }

  await runCommand("python", args, { cwd: workspace });
}

export async function runDashboard(options = {}) {
  const workspace = resolveWorkspace(options.workspace);
  const webDir = path.join(workspace, "web");
  const profile = normalizeConfig({
    ...readTradexConfig(),
    ...readWorkspaceProfile(workspace),
  });
  const packageManager = options.packageManager || profile.packageManager || "npm";

  if (options.install) {
    await runPackageInstall(packageManager, webDir);
  }

  printDashboardBoot({ workspace, packageManager, profile });

  await runPackageScript(packageManager, "dev", webDir);
}

export function formatDoctorReport(report) {
  const lines = [
    "OpenTradex doctor",
    `workspace: ${report.workspace}`,
    `runtime: ${report.profile.runtime}`,
    `package manager: ${report.profile.packageManager}`,
    `dashboard: ${report.profile.dashboardSurface}`,
    `channels: ${labelsForIds(CHANNEL_OPTIONS, report.profile.channels).join(", ") || "none"}`,
    `mode: ${report.profile.mode}`,
    `primary market: ${labelsForIds(MARKET_OPTIONS, [report.profile.primaryMarket]).join(", ")}`,
    `market rails: ${labelsForIds(MARKET_OPTIONS, report.profile.enabledMarkets).join(", ") || "none"}`,
    `integrations: ${labelsForIds(INTEGRATION_OPTIONS, report.profile.integrations).join(", ") || "none"}`,
    "",
  ];

  for (const item of report.checks) {
    lines.push(`${item.ok ? "[ok]" : "[warn]"} ${item.name}`);
    if (!item.ok) {
      lines.push(`  ${item.help}`);
    }
  }

  if (report.notes.length > 0) {
    lines.push("", "Notes:");
    for (const note of report.notes) {
      lines.push(`- ${note}`);
    }
  }

  return lines.join("\n");
}

export function formatProviderMatrix() {
  const lines = [
    "OpenTradex provider rails",
    "",
    "Agent runtimes:",
    ...formatOptionLines(RUNTIME_OPTIONS).map((line) => `  ${line}`),
    "",
    "Dashboard surfaces:",
    ...formatOptionLines(DASHBOARD_SURFACE_OPTIONS).map((line) => `  ${line}`),
    "",
    "Market rails:",
    ...formatOptionLines(MARKET_OPTIONS).map((line) => `  ${line}`),
    "",
    "Data integrations:",
    ...formatOptionLines(INTEGRATION_OPTIONS).map((line) => `  ${line}`),
    "",
    "Operator channels:",
    ...formatOptionLines(CHANNEL_OPTIONS).map((line) => `  ${line}`),
    "",
    "Package managers:",
    ...formatOptionLines(PACKAGE_MANAGER_OPTIONS).map((line) => `  ${line}`),
  ];
  return lines.join("\n");
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function ensureDir(dirPath) {
  mkdirSync(dirPath, { recursive: true });
}

function check(name, ok, help) {
  return { name, ok, help };
}

function commandWorks(command, args) {
  if (process.platform === "win32") {
    const result = spawnSync("where.exe", [command], { stdio: "ignore" });
    return !result.error && result.status === 0;
  }

  for (const candidate of getCommandCandidates(command)) {
    const result = spawnSync(candidate, args, { stdio: "ignore" });
    if (!result.error && result.status === 0) {
      return true;
    }
  }
  return false;
}

async function runCommand(command, args, options = {}) {
  await new Promise((resolve, reject) => {
    const spec = getSpawnSpec(command, args);
    const child = spawn(spec.command, spec.args, {
      cwd: options.cwd,
      stdio: "inherit",
      env: { ...process.env, ...(options.env || {}) },
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function runPackageInstall(packageManager, cwd) {
  if (packageManager === "bun") {
    await runCommand("bun", ["install"], { cwd });
    return;
  }

  await runCommand("npm", ["install"], { cwd });
}

async function runPackageScript(packageManager, scriptName, cwd) {
  if (packageManager === "bun") {
    await runCommand("bun", ["run", scriptName], { cwd });
    return;
  }

  await runCommand("npm", ["run", scriptName], { cwd });
}

async function ask(rl, label, fallback = "") {
  const prompt = fallback ? `${label} [${fallback}]: ` : `${label}: `;
  const answer = (await rl.question(prompt)).trim();
  return answer || fallback;
}

async function confirm(rl, label, defaultYes = true) {
  const hint = defaultYes ? "[Y/n]" : "[y/N]";
  const answer = (await rl.question(`${label} ${hint}: `)).trim().toLowerCase();
  if (!answer) {
    return defaultYes;
  }
  return answer === "y" || answer === "yes";
}

async function chooseMode(rl, fallback) {
  const answer = (await rl.question(`Trading mode [paper/live] (${fallback}): `)).trim().toLowerCase();
  if (!answer) {
    return fallback;
  }
  return answer === "live" ? "live" : "paper";
}

async function chooseOption(rl, label, options, fallbackId) {
  const fallback = getOptionById(options, fallbackId, options[0].id);
  printOptionList(label);
  for (const line of formatOptionLines(options)) {
    console.log(`  ${line}`);
  }

  const answer = (await rl.question(`  Enter number or id [${fallback.id}]: `)).trim().toLowerCase();
  if (!answer) {
    return fallback.id;
  }

  const asNumber = Number(answer);
  if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= options.length) {
    return options[asNumber - 1].id;
  }

  return getOptionById(options, answer, fallback.id).id;
}

async function chooseMany(rl, label, options, fallbackIds = []) {
  const fallback = keepKnownIds(options, fallbackIds);
  printOptionList(label);
  for (const line of formatOptionLines(options)) {
    console.log(`  ${line}`);
  }

  const fallbackText = fallback.join(",") || "none";
  const answer = (await rl.question(`  Enter comma-separated ids or numbers [${fallbackText}]: `)).trim().toLowerCase();
  if (!answer) {
    return fallback;
  }

  const rawSelections = answer.split(",").map((item) => item.trim()).filter(Boolean);
  const resolved = [];

  for (const item of rawSelections) {
    const asNumber = Number(item);
    if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= options.length) {
      resolved.push(options[asNumber - 1].id);
      continue;
    }
    resolved.push(item);
  }

  return keepKnownIds(options, resolved);
}

function printWelcomeBanner() {
  console.log([
    "",
    "  ___  ____  _____ _   _ _____ ____    _    ____  _______  __",
    " / _ \\|  _ \\| ____| \\ | |_   _|  _ \\  / \\  |  _ \\| ____\\ \\/ /",
    "| | | | |_) |  _| |  \\| | | | | |_) |/ _ \\ | | | |  _|  \\  / ",
    "| |_| |  __/| |___| |\\  | | | |  _ </ ___ \\| |_| | |___ /  \\ ",
    " \\___/|_|   |_____|_| \\_| |_| |_| \\_\\_/   \\_\\____/|_____/_/\\_\\",
    "",
    " OpenTradex onboarding",
    " Our implementation. Your strategy.",
    "",
  ].join("\n"));
}

function printSecurityNotice() {
  printPanel("Security", [
    "OpenTradex can read local files, install dependencies, and route trading workflows.",
    "Treat it like a capable local operator. Use least-privilege credentials and keep secrets out of the repo.",
    "Do not enable live trading until your paper workflow is stable and your risk limits are set.",
    "Live execution is currently supported on Kalshi. Other rails stay in research, discovery, watchlist, or paper mode.",
    "",
    "Recommended routine:",
    "opentradex doctor",
    "opentradex providers",
  ]);
}

function printSection(step, title, description) {
  console.log([
    "",
    `[${step}] ${title.toUpperCase()}`,
    "-".repeat(72),
    description,
    "",
  ].join("\n"));
}

function printOptionList(label) {
  console.log([
    "",
    label,
    "-".repeat(72),
  ].join("\n"));
}

function printDashboardBoot({ workspace, packageManager, profile }) {
  printPanel("Local harness", [
    `workspace: ${workspace}`,
    `runtime: ${profile.runtime}`,
    `package flow: ${packageManager}`,
    `dashboard: ${profile.dashboardSurface || DEFAULT_ENV.OPENTRADEX_DASHBOARD_SURFACE}`,
    `primary rail: ${profile.primaryMarket}`,
    `additional rails: ${profile.enabledMarkets.join(", ") || "none"}`,
    `channels: ${profile.channels?.join(", ") || "none"}`,
    "",
    "When the dev server is ready, OpenTradex now lands on the dashboard first.",
    "Suggested local URL: http://localhost:3000/",
  ]);
}

function printPanel(title, lines, width = 76) {
  const innerWidth = Math.max(32, width - 4);
  const border = `+${"-".repeat(innerWidth + 2)}+`;
  const output = [border];

  for (const line of wrapText(title, innerWidth)) {
    output.push(`| ${padRight(line, innerWidth)} |`);
  }

  output.push(`| ${"-".repeat(innerWidth)} |`);

  for (const sourceLine of lines) {
    if (!sourceLine) {
      output.push(`| ${" ".repeat(innerWidth)} |`);
      continue;
    }

    for (const line of wrapText(sourceLine, innerWidth)) {
      output.push(`| ${padRight(line, innerWidth)} |`);
    }
  }

  output.push(border);
  console.log(`\n${output.join("\n")}\n`);
}

function wrapText(text, width) {
  const normalized = String(text);
  if (normalized.length <= width) {
    return [normalized];
  }

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [""];
  }

  const lines = [];
  let current = "";

  const flush = () => {
    if (current) {
      lines.push(current);
      current = "";
    }
  };

  for (const word of words) {
    if (word.length > width) {
      flush();
      for (let index = 0; index < word.length; index += width) {
        lines.push(word.slice(index, index + width));
      }
      continue;
    }

    if (!current) {
      current = word;
      continue;
    }

    if (`${current} ${word}`.length <= width) {
      current = `${current} ${word}`;
      continue;
    }

    flush();
    current = word;
  }

  flush();
  return lines;
}

function padRight(value, width) {
  return String(value).padEnd(width, " ");
}

function normalizeConfig(config = {}) {
  return {
    workspace: config.workspace,
    runtime: config.runtime || config.profile?.runtime || DEFAULT_ENV.OPENTRADEX_RUNTIME,
    packageManager: config.packageManager || config.profile?.packageManager || DEFAULT_ENV.OPENTRADEX_PACKAGE_MANAGER,
    dashboardSurface: config.dashboardSurface || config.profile?.dashboardSurface || DEFAULT_ENV.OPENTRADEX_DASHBOARD_SURFACE,
    channels: keepKnownIds(CHANNEL_OPTIONS, config.channels || config.profile?.channels || DEFAULT_ENV.OPENTRADEX_CHANNELS),
    mode: config.mode || config.profile?.mode || DEFAULT_ENV.OPENTRADEX_EXECUTION_MODE,
    primaryMarket: config.primaryMarket || config.profile?.primaryMarket || DEFAULT_ENV.OPENTRADEX_PRIMARY_MARKET,
    enabledMarkets: keepKnownIds(MARKET_OPTIONS, config.enabledMarkets || config.profile?.enabledMarkets || DEFAULT_ENV.OPENTRADEX_ENABLED_MARKETS),
    integrations: keepKnownIds(INTEGRATION_OPTIONS, config.integrations || config.profile?.integrations || DEFAULT_ENV.OPENTRADEX_ENABLED_INTEGRATIONS),
    tradingviewConnectorMode:
      String(config.tradingviewConnectorMode || config.profile?.tradingviewConnectorMode || DEFAULT_ENV.TRADINGVIEW_CONNECTOR_MODE).toLowerCase() === "mcp"
        ? "mcp"
        : "watchlist",
    tradingviewMcpEnabled:
      String(config.tradingviewMcpEnabled ?? config.profile?.tradingviewMcpEnabled ?? DEFAULT_ENV.TRADINGVIEW_MCP_ENABLED).toLowerCase() === "true",
    tradingviewMcpTransport:
      String(config.tradingviewMcpTransport || config.profile?.tradingviewMcpTransport || DEFAULT_ENV.TRADINGVIEW_MCP_TRANSPORT).toLowerCase() === "http"
        ? "http"
        : "stdio",
    bankroll: config.bankroll || config.profile?.bankroll || DEFAULT_ENV.BANKROLL,
    interval: config.interval || config.profile?.interval || DEFAULT_ENV.CYCLE_INTERVAL,
    installDeps: config.installDeps ?? config.profile?.installDeps ?? false,
  };
}

function buildDoctorNotes({
  runtime,
  primaryMarket,
  enabledMarkets,
  liveTrading,
  dashboardSurface,
  channels,
  tradingviewConnectorMode,
  tradingviewMcpEnabled,
  tradingviewMcpTransport,
}) {
  const notes = [];

  if (runtime === "codex-cli") {
    notes.push("Codex CLI is configured as the active runner. Dashboard chat requests can now route straight into `codex exec --json` for direct operator answers.");
  } else if (runtime !== "claude-code") {
    notes.push("The current orchestrator still launches Claude Code for end-to-end execution. Other runtime profiles are stored cleanly in config so you can extend the runner later.");
  }

  if (liveTrading && primaryMarket !== "kalshi") {
    notes.push("Live execution is only implemented for Kalshi right now. Other market rails are configured for discovery, research, and paper workflows.");
  }

  if (enabledMarkets.includes("polymarket")) {
    notes.push("Polymarket discovery uses the public Gamma API. Wallet-based live order routing is intentionally optional.");
  }

  if (enabledMarkets.includes("tradingview") || enabledMarkets.includes("robinhood") || enabledMarkets.includes("groww")) {
    notes.push("TradingView, Robinhood, and Groww are configured as watchlist/profile rails so you can add credentials only when you really need them.");
  }

  if (dashboardSurface === "chat") {
    notes.push(`Dashboard chat cockpit is enabled with channels: ${channels.join(", ") || "none"}.`);
  }

  if (enabledMarkets.includes("tradingview") && tradingviewConnectorMode === "mcp") {
    notes.push(`TradingView is set to MCP mode over ${tradingviewMcpTransport}. The dashboard will surface connector status, but Claude Code still needs the MCP server available locally.`);
  } else if (enabledMarkets.includes("tradingview")) {
    notes.push("TradingView is currently a watchlist/context rail. Enable MCP later if you want richer chart tooling.");
  }

  if (tradingviewMcpEnabled && tradingviewConnectorMode === "mcp") {
    notes.push("TradingView MCP is marked enabled in the workspace profile. Fill in the command or URL if the doctor still shows it as incomplete.");
  }

  return notes;
}

function getCommandCandidates(command) {
  if (process.platform !== "win32") {
    return [command];
  }

  if (command.includes(".")) {
    return [command];
  }

  return [command, `${command}.cmd`, `${command}.exe`, `${command}.bat`];
}

function getSpawnCommand(command) {
  if (process.platform === "win32" && command === "npm") {
    return "npm.cmd";
  }
  return command;
}

function getSpawnSpec(command, args) {
  if (process.platform === "win32" && (command === "npm" || command === "bun")) {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", command, ...args],
    };
  }

  return {
    command: getSpawnCommand(command),
    args,
  };
}
