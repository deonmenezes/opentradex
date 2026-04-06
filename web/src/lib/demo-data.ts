import type {
  AgentCycle,
  Market,
  NewsArticle,
  Portfolio,
  WorkspaceSummary,
  StreamLine,
  Trade,
} from "@/lib/types";

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function hoursFromNow(hours: number) {
  return new Date(Date.now() + hours * 60 * 60_000).toISOString();
}

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60_000).toISOString();
}

export function getDemoTrades(): Trade[] {
  return [
    {
      id: 101,
      timestamp: minutesAgo(18),
      ticker: "FED-SEP-CUT",
      title: "Will the Fed cut rates by September?",
      category: "Economics",
      side: "yes",
      action: "buy",
      contracts: 18,
      entry_price: 0.41,
      cost: 738,
      fee: 5.9,
      estimated_prob: 0.56,
      edge: 0.15,
      confidence: "high",
      reasoning:
        "Treasury yields softened after cooler labor data and the curve repriced toward an earlier easing window. The market was still lagging the shift in cuts probability.",
      news_trigger: "Cooling labor and inflation prints",
      sources: "Reuters, Fedwatch, Treasury yields",
      settled: 0,
      outcome: "open",
      pnl: 0,
      exit_price: null,
      exit_reasoning: "",
    },
    {
      id: 102,
      timestamp: minutesAgo(42),
      ticker: "BTC-EOY-120K",
      title: "Will Bitcoin finish the year above 120k?",
      category: "Crypto",
      side: "yes",
      action: "buy",
      contracts: 24,
      entry_price: 0.36,
      cost: 864,
      fee: 6.91,
      estimated_prob: 0.49,
      edge: 0.13,
      confidence: "medium",
      reasoning:
        "ETF inflows accelerated while implied volatility compressed. That combination usually tightens the path to breakout levels faster than the binary market reprices.",
      news_trigger: "ETF inflows and volatility compression",
      sources: "ETF flows, exchange data, macro correlation",
      settled: 0,
      outcome: "open",
      pnl: 0,
      exit_price: null,
      exit_reasoning: "",
    },
    {
      id: 103,
      timestamp: minutesAgo(105),
      ticker: "OIL-Q3-90",
      title: "Will WTI crude trade above 90 before Q3 ends?",
      category: "Energy",
      side: "yes",
      action: "buy",
      contracts: 10,
      entry_price: 0.29,
      cost: 290,
      fee: 2.32,
      estimated_prob: 0.44,
      edge: 0.15,
      confidence: "medium",
      reasoning:
        "Supply-risk headlines lifted the probability of a short squeeze in crude, and the pricing window was still discounting that tail too aggressively.",
      news_trigger: "Supply risk repricing",
      sources: "Energy headlines, futures curve, OPEC commentary",
      settled: 1,
      outcome: "win",
      pnl: 71,
      exit_price: 0.36,
      exit_reasoning: "Took profit after the edge compressed below the entry threshold.",
    },
    {
      id: 104,
      timestamp: minutesAgo(240),
      ticker: "CPI-NEXT-LOWER",
      title: "Will the next CPI print come in below consensus?",
      category: "Economics",
      side: "no",
      action: "buy",
      contracts: 8,
      entry_price: 0.47,
      cost: 376,
      fee: 3.01,
      estimated_prob: 0.39,
      edge: 0.08,
      confidence: "medium",
      reasoning:
        "Shelter lag and energy base effects still argued against an immediate downside surprise, but the edge deteriorated quickly after the release calendar tightened.",
      news_trigger: "Sticky shelter and energy base effects",
      sources: "BLS components, rate path, energy data",
      settled: 1,
      outcome: "loss",
      pnl: -34,
      exit_price: 0.52,
      exit_reasoning: "Exited when the inflation basket reaccelerated and the thesis no longer held.",
    },
  ];
}

export function getDemoMarkets(): Market[] {
  return [
    {
      id: 201,
      timestamp: minutesAgo(6),
      ticker: "FED-SEP-CUT",
      title: "Will the Fed cut rates by September?",
      category: "Economics",
      yes_bid: 42,
      yes_ask: 44,
      mid: 0.43,
      volume: 1_240_000,
      open_interest: 680_000,
      close_time: daysFromNow(19),
    },
    {
      id: 202,
      timestamp: minutesAgo(4),
      ticker: "BTC-EOY-120K",
      title: "Will Bitcoin finish the year above 120k?",
      category: "Crypto",
      yes_bid: 37,
      yes_ask: 39,
      mid: 0.38,
      volume: 920_000,
      open_interest: 510_000,
      close_time: daysFromNow(270),
    },
    {
      id: 203,
      timestamp: minutesAgo(9),
      ticker: "OIL-Q3-90",
      title: "Will WTI crude trade above 90 before Q3 ends?",
      category: "Energy",
      yes_bid: 33,
      yes_ask: 35,
      mid: 0.34,
      volume: 610_000,
      open_interest: 274_000,
      close_time: daysFromNow(88),
    },
    {
      id: 204,
      timestamp: minutesAgo(11),
      ticker: "JOBS-NEXT-STRONG",
      title: "Will the next payrolls print beat consensus?",
      category: "Economics",
      yes_bid: 48,
      yes_ask: 50,
      mid: 0.49,
      volume: 420_000,
      open_interest: 193_000,
      close_time: daysFromNow(26),
    },
  ];
}

export function getDemoNews(): NewsArticle[] {
  return [
    {
      id: 301,
      timestamp: minutesAgo(14),
      source: "Reuters",
      keyword: "rates",
      title: "Rates markets lean toward an earlier cut as Treasury yields cool",
      url: "https://www.reuters.com/markets/",
      snippet:
        "Bond traders pushed yields lower after softer macro data, keeping rate-cut timing in focus and creating a repricing window across event contracts.",
      image: null,
    },
    {
      id: 302,
      timestamp: minutesAgo(28),
      source: "Bloomberg",
      keyword: "bitcoin",
      title: "Bitcoin demand firms as ETF flows recover and volatility settles",
      url: "https://www.bloomberg.com/markets",
      snippet:
        "A calmer volatility backdrop and a steadier ETF tape reopened upside scenarios that binary pricing was still underweighting.",
      image: null,
    },
    {
      id: 303,
      timestamp: minutesAgo(55),
      source: "Financial Times",
      keyword: "oil",
      title: "Crude risk premium rises as traders assess fresh supply concerns",
      url: "https://www.ft.com/markets",
      snippet:
        "Energy desks added premium back into the curve as geopolitical supply chatter returned, widening the gap between spot headlines and event pricing.",
      image: null,
    },
  ];
}

export function getDemoAgentCycles(): AgentCycle[] {
  return [
    {
      id: 401,
      timestamp: minutesAgo(12),
      session_id: "demo-session-otx",
      duration_s: 37,
      status: "completed",
      markets_scanned: 18,
      news_scraped: 9,
      trades_made: 1,
      output_summary:
        "Scanned macro and crypto markets, validated softer-rate thesis, and kept the Fed cut position live while adding one Bitcoin upside ticket.",
    },
    {
      id: 402,
      timestamp: minutesAgo(53),
      session_id: "demo-session-otx",
      duration_s: 31,
      status: "completed",
      markets_scanned: 14,
      news_scraped: 7,
      trades_made: 0,
      output_summary:
        "No new execution. Energy and payroll setups were reviewed, but the available edge did not clear the confidence threshold.",
    },
  ];
}

export function getDemoPortfolio(): Portfolio {
  const trades = getDemoTrades();
  const wins = trades.filter((trade) => trade.outcome === "win").length;
  const losses = trades.filter((trade) => trade.outcome === "loss").length;
  const openPositions = trades.filter(
    (trade) => trade.settled === 0 && trade.action === "buy"
  );

  return {
    bankroll: 15_237.74,
    total_pnl: 184.27,
    total_trades: trades.length,
    wins,
    losses,
    open_positions: openPositions,
    total_news: getDemoNews().length,
    total_snapshots: getDemoMarkets().length,
    total_cycles: getDemoAgentCycles().length,
  };
}

export function getDemoStreamLines(): StreamLine[] {
  return [
    {
      type: "text",
      text:
        "Hosted preview mode is active. This dashboard is serving bundled demo data because no local `data/gossip.db` or background Python worker is attached to the deployment.",
    },
    {
      type: "text",
      text:
        "Use `opentradex onboard` or run `python main.py` locally to connect real market data, your own news sources, and live agent cycles.",
    },
    {
      type: "result",
      result:
        "Preview is healthy: landing page works, dashboard renders, news can load, and the live controls now return clear demo-mode responses instead of failing with 500s.",
    },
  ];
}

export function getDemoAgentStatus() {
  return {
    status: "idle",
    mode: "demo",
    updated_at: minutesAgo(2),
    next_check_at: hoursFromNow(1),
  };
}

export function getDemoWorkspaceSummary(): WorkspaceSummary {
  return {
    isDemo: true,
    runtime: "claude-code",
    packageManager: "npm",
    mode: "paper",
    primaryMarket: "kalshi",
    enabledMarkets: ["kalshi", "polymarket", "tradingview"],
    integrations: ["apify", "rss", "reddit", "twitter"],
    dashboardSurface: "chat",
    channels: ["command", "markets", "feeds", "risk", "execution", "tradingview"],
    tradingview: {
      enabled: true,
      watchlist: ["SPY", "QQQ", "BTCUSD", "NQ1!"],
      connectorMode: "mcp",
      mcpEnabled: true,
      transport: "stdio",
      command: "npx tradingview-mcp",
      args: "--demo",
      configured: true,
    },
  };
}
