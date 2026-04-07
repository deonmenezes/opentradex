export const PACKAGE_MANAGER_OPTIONS = [
  {
    id: "npm",
    label: "npm",
    description: "Default Node workflow for installs, scripts, and the local harness.",
    installHint: "npm install -g opentradex@latest",
  },
  {
    id: "bun",
    label: "bun",
    description: "Fast Bun workflow for the dashboard and package scripts.",
    installHint: "bunx opentradex@latest onboard",
  },
];

export const RUNTIME_OPTIONS = [
  {
    id: "claude-code",
    label: "Claude Code",
    description: "Production-ready local tool-using runtime for the current harness.",
    support: "working",
  },
  {
    id: "codex-cli",
    label: "Codex CLI",
    description: "OpenAI Codex agent runner for dashboard-first chat, questions, and local tool use.",
    support: "working",
  },
  {
    id: "openai-api",
    label: "OpenAI API",
    description: "Profile scaffold for a future Responses API runner.",
    support: "profile",
  },
  {
    id: "gemini-cli",
    label: "Gemini CLI",
    description: "Profile scaffold for a future Gemini-backed runner.",
    support: "profile",
  },
];

export const MARKET_OPTIONS = [
  {
    id: "kalshi",
    label: "Kalshi",
    description: "Prediction-market rail with the strongest live execution path.",
    support: "live",
  },
  {
    id: "polymarket",
    label: "Polymarket",
    description: "Prediction-market discovery rail with wallet placeholders.",
    support: "discovery",
  },
  {
    id: "tradingview",
    label: "TradingView",
    description: "Watchlist and chart context rail for market discovery.",
    support: "watchlist",
  },
  {
    id: "robinhood",
    label: "Robinhood",
    description: "US broker profile placeholder for future adapter work.",
    support: "profile",
  },
  {
    id: "groww",
    label: "Groww",
    description: "India-focused broker profile placeholder for future adapter work.",
    support: "profile",
  },
];

export const INTEGRATION_OPTIONS = [
  {
    id: "apify",
    label: "Apify",
    description: "News and social scraping.",
  },
  {
    id: "rss",
    label: "RSS",
    description: "Fallback live-news feeds with no extra auth.",
  },
  {
    id: "reddit",
    label: "Reddit",
    description: "Social/news context stream.",
  },
  {
    id: "twitter",
    label: "X/Twitter",
    description: "Social signal scraping via Apify.",
  },
  {
    id: "truthsocial",
    label: "Truth Social",
    description: "Optional political/news context feed.",
  },
  {
    id: "tiktok",
    label: "TikTok",
    description: "Optional trend-monitoring feed.",
  },
];

export const CHANNEL_OPTIONS = [
  {
    id: "command",
    label: "Command",
    description: "Primary operator chat lane for direct prompts and mission launches.",
  },
  {
    id: "markets",
    label: "Markets",
    description: "Cross-market scanning across Kalshi, Polymarket, and active rails.",
  },
  {
    id: "feeds",
    label: "Feeds",
    description: "News, social, and alert ingestion for live context.",
  },
  {
    id: "risk",
    label: "Risk",
    description: "Position review, exposure control, and exit discipline.",
  },
  {
    id: "execution",
    label: "Execution",
    description: "Trade routing, fills, and cycle outcomes.",
  },
  {
    id: "tradingview",
    label: "TradingView",
    description: "Watchlist and chart-context lane for symbols and macro instruments.",
  },
];

export const DASHBOARD_SURFACE_OPTIONS = [
  {
    id: "chat",
    label: "Chat cockpit",
    description: "Channel-based operator chat inside the local dashboard.",
  },
  {
    id: "stream",
    label: "Stream log",
    description: "Lean terminal-style stream without the full chat cockpit framing.",
  },
];

export const TRADINGVIEW_CONNECTOR_OPTIONS = [
  {
    id: "watchlist",
    label: "Watchlist only",
    description: "Use TradingView symbols as context without an MCP connector.",
  },
  {
    id: "mcp",
    label: "TradingView MCP",
    description: "Route TradingView context through your local MCP server when available.",
  },
];

export const MCP_TRANSPORT_OPTIONS = [
  {
    id: "stdio",
    label: "stdio",
    description: "Spawn a local MCP command such as a node, bun, or python process.",
  },
  {
    id: "http",
    label: "http",
    description: "Connect to an MCP endpoint exposed over HTTP.",
  },
];

export function getOptionById(options, id, fallbackId) {
  const fallback = options.find((item) => item.id === fallbackId) || options[0];
  if (!id) {
    return fallback;
  }

  return options.find((item) => item.id === id) || fallback;
}

export function parseIdList(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => parseIdList(item));
  }

  return String(value)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function uniqueIds(ids) {
  return [...new Set(parseIdList(ids))];
}

export function keepKnownIds(options, ids) {
  const known = new Set(options.map((item) => item.id));
  return uniqueIds(ids).filter((item) => known.has(item));
}

export function formatOptionLines(options) {
  return options.map((item, index) => {
    const suffix = item.support ? ` [${item.support}]` : "";
    return `${index + 1}. ${item.label}${suffix} - ${item.description}`;
  });
}

export function labelsForIds(options, ids) {
  const byId = new Map(options.map((item) => [item.id, item.label]));
  return uniqueIds(ids).map((id) => byId.get(id) || id);
}
