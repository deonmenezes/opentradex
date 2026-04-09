export interface Portfolio {
  bankroll: number;
  total_pnl: number;
  total_trades: number;
  wins: number;
  losses: number;
  open_positions: Trade[];
  total_news: number;
  total_snapshots: number;
  total_cycles: number;
  data_source?: string;
}

export interface Trade {
  id: number;
  timestamp: string;
  ticker: string;
  title: string;
  category: string;
  side: string;
  action: string;
  contracts: number;
  entry_price: number;
  cost: number;
  fee: number;
  estimated_prob: number;
  edge: number;
  confidence: string;
  reasoning: string;
  news_trigger: string;
  sources: string;
  settled: number;
  outcome: string;
  pnl: number;
  exit_price: number | null;
  exit_reasoning: string;
}

export interface NewsArticle {
  id: number;
  timestamp: string;
  source: string;
  keyword: string;
  title: string;
  url: string;
  snippet: string;
  image?: string | null;
}

export interface Market {
  id: number;
  timestamp: string;
  ticker: string;
  title: string;
  category: string;
  yes_bid: number;
  yes_ask: number;
  mid: number;
  volume: number;
  open_interest: number;
  close_time: string;
}

export interface AgentCycle {
  id: number;
  timestamp: string;
  session_id: string;
  duration_s: number;
  status: string;
  markets_scanned: number;
  news_scraped: number;
  trades_made: number;
  output_summary: string;
}

export interface PositionPrice {
  ticker: string;
  title: string;
  side: string;
  contracts: number;
  entry_price: number;
  mark_price: number;
  mid: number;
  cost: number;
  current_value: number;
  unrealized_pnl: number;
  pnl_pct: number;
  status: string;
  result: string;
}

export interface SocialPost {
  id: string;
  text: string;
  author: string;
  authorName: string;
  authorImage?: string;
  likes: number;
  reposts: number;
  replies?: number;
  url: string;
  timestamp: string;
  platform: "twitter" | "truthsocial" | "reddit" | "tiktok";
  images?: string[];
  videoCover?: string;
  videoDuration?: number;
}

export interface StreamLine {
  type: string;
  text?: string;
  tool?: string;
  input?: string;
  result?: string;
}

export interface WorkspaceSummary {
  isDemo: boolean;
  runtime: string;
  packageManager: string;
  mode: string;
  primaryMarket: string;
  enabledMarkets: string[];
  integrations: string[];
  dashboardSurface: string;
  channels: string[];
  executionRail?: string;
  researchRails?: string[];
  tradingview: {
    enabled: boolean;
    watchlist: string[];
    connectorMode: "watchlist" | "mcp";
    mcpEnabled: boolean;
    transport: "stdio" | "http";
    command?: string;
    args?: string;
    url?: string;
    configured: boolean;
  };
}

export interface LiveReadinessCheck {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

export interface WorkspaceStatus {
  workspace: WorkspaceSummary | null;
  readiness: {
    canArmLive: boolean;
    checks: LiveReadinessCheck[];
    balance?: number | null;
    authProbeOk: boolean;
    authProbeMessage: string;
  };
}

export interface PromptEntry {
  id: string;
  text: string;
  channel: string;
  createdAt: string;
}

export function kalshiUrl(ticker: string, title?: string): string {
  const parts = ticker.split("-");
  const event = parts[0].toLowerCase();
  const full = ticker.toLowerCase();
  const slug = title
    ? title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60)
    : event;
  return `https://kalshi.com/markets/${event}/${slug}/${full}`;
}
