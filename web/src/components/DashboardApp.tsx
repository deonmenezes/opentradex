"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LiveStream } from "@/components/LiveStream";
import { MarketScanner } from "@/components/MarketScanner";
import { NewsFeed } from "@/components/NewsFeed";
import { PortfolioStrip } from "@/components/PortfolioStrip";
import { PositionsPanel } from "@/components/PositionsPanel";
import { TopBar } from "@/components/TopBar";
import type {
  Market,
  NewsArticle,
  Portfolio,
  PositionPrice,
  PromptEntry,
  SocialPost,
  StreamLine,
  Trade,
  WorkspaceSummary,
} from "@/lib/types";

const SHOW_PNL = false;

export function DashboardApp() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [liveNews, setLiveNews] = useState<NewsArticle[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [rationale, setRationale] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [agentStatus, setAgentStatus] = useState("");
  const [loopInterval, setLoopInterval] = useState(900);
  const [streamLines, setStreamLines] = useState<StreamLine[]>([]);
  const [liveStatus, setLiveStatus] = useState<string>("idle");
  const [prices, setPrices] = useState<PositionPrice[]>([]);
  const [tweets, setTweets] = useState<SocialPost[]>([]);
  const [truthPosts, setTruthPosts] = useState<SocialPost[]>([]);
  const [redditPosts, setRedditPosts] = useState<SocialPost[]>([]);
  const [tiktokPosts, setTiktokPosts] = useState<SocialPost[]>([]);
  const [loadingTweets, setLoadingTweets] = useState(true);
  const [loadingTruth, setLoadingTruth] = useState(true);
  const [loadingReddit, setLoadingReddit] = useState(true);
  const [loadingTiktok, setLoadingTiktok] = useState(true);
  const [promptHistory, setPromptHistory] = useState<PromptEntry[]>([]);
  const [queuedPrompts, setQueuedPrompts] = useState<PromptEntry[]>([]);
  const streamOffset = useRef(0);

  const fetchWorkspace = useCallback(async () => {
    try {
      const res = await fetch("/api/workspace");
      const data = await res.json();
      setWorkspace(data);
    } catch {
      // ignore
    }
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const [p, t, n, m] = await Promise.all([
        fetch("/api/portfolio").then((r) => r.json()),
        fetch("/api/trades").then((r) => r.json()),
        fetch("/api/news").then((r) => r.json()),
        fetch("/api/markets").then((r) => r.json()),
      ]);
      setPortfolio(p);
      setTrades(t);
      setNews(n);
      setMarkets(m);
    } catch {
      // DB might not exist yet
    }
  }, []);

  const fetchLiveNews = useCallback(async () => {
    try {
      const res = await fetch("/api/news/live");
      const data = await res.json();
      setLiveNews(
        data.map((item: Record<string, string | null>, i: number) => ({
          id: -(i + 1),
          timestamp: item.timestamp,
          source: item.source,
          keyword: "",
          title: item.title,
          url: item.url,
          snippet: item.snippet,
          image: item.image || null,
        }))
      );
    } catch {
      // ignore
    }
  }, []);

  const fetchPrices = useCallback(async () => {
    if (!SHOW_PNL) return;
    try {
      const res = await fetch("/api/prices");
      const data = await res.json();
      setPrices(data.positions || []);
    } catch {
      // ignore
    }
  }, []);

  const tweetRetries = useRef(0);
  const fetchTweets = useCallback(async () => {
    try {
      const res = await fetch("/api/news/twitter");
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setTweets(data);
        setLoadingTweets(false);
        tweetRetries.current = 0;
      } else {
        tweetRetries.current += 1;
        if (tweetRetries.current > 12) setLoadingTweets(false);
      }
    } catch {
      tweetRetries.current += 1;
      if (tweetRetries.current > 12) setLoadingTweets(false);
    }
  }, []);

  const fetchTruthPosts = useCallback(async () => {
    try {
      const res = await fetch("/api/news/truthsocial");
      const data = await res.json();
      if (Array.isArray(data)) setTruthPosts(data);
    } catch {
      // ignore
    } finally {
      setLoadingTruth(false);
    }
  }, []);

  const redditRetries = useRef(0);
  const fetchRedditPosts = useCallback(async () => {
    try {
      const res = await fetch("/api/news/reddit");
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setRedditPosts(data);
        setLoadingReddit(false);
        redditRetries.current = 0;
      } else {
        redditRetries.current += 1;
        if (redditRetries.current > 12) setLoadingReddit(false);
      }
    } catch {
      redditRetries.current += 1;
      if (redditRetries.current > 12) setLoadingReddit(false);
    }
  }, []);

  const tiktokRetries = useRef(0);
  const fetchTiktokPosts = useCallback(async () => {
    try {
      const res = await fetch("/api/news/tiktok");
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setTiktokPosts(data);
        setLoadingTiktok(false);
        tiktokRetries.current = 0;
      } else {
        tiktokRetries.current += 1;
        if (tiktokRetries.current > 12) setLoadingTiktok(false);
      }
    } catch {
      tiktokRetries.current += 1;
      if (tiktokRetries.current > 12) setLoadingTiktok(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkspace();
    fetchAll();
    fetchLiveNews();
    fetchPrices();
    fetchTruthPosts();
    const redditDelay = setTimeout(fetchRedditPosts, 5_000);
    const tweetDelay = setTimeout(fetchTweets, 15_000);
    const tiktokDelay = setTimeout(fetchTiktokPosts, 25_000);
    const dataId = setInterval(fetchAll, 5_000);
    const newsId = setInterval(fetchLiveNews, 120_000);
    const pricesId = setInterval(fetchPrices, 30_000);
    const workspaceId = setInterval(fetchWorkspace, 60_000);
    const tweetsId = setInterval(() => {
      if (tweetRetries.current > 0 && tweetRetries.current <= 12) {
        fetchTweets();
      }
    }, 5_000);
    const tweetsSlowId = setInterval(fetchTweets, 300_000);
    const truthId = setInterval(fetchTruthPosts, 180_000);
    const redditRetryId = setInterval(() => {
      if (redditRetries.current > 0 && redditRetries.current <= 12) {
        fetchRedditPosts();
      }
    }, 5_000);
    const redditSlowId = setInterval(fetchRedditPosts, 300_000);
    const tiktokRetryId = setInterval(() => {
      if (tiktokRetries.current > 0 && tiktokRetries.current <= 12) {
        fetchTiktokPosts();
      }
    }, 5_000);
    const tiktokSlowId = setInterval(fetchTiktokPosts, 300_000);

    return () => {
      clearInterval(dataId);
      clearInterval(newsId);
      clearInterval(pricesId);
      clearInterval(workspaceId);
      clearTimeout(tweetDelay);
      clearTimeout(redditDelay);
      clearTimeout(tiktokDelay);
      clearInterval(tweetsId);
      clearInterval(tweetsSlowId);
      clearInterval(truthId);
      clearInterval(redditRetryId);
      clearInterval(redditSlowId);
      clearInterval(tiktokRetryId);
      clearInterval(tiktokSlowId);
    };
  }, [
    fetchAll,
    fetchLiveNews,
    fetchPrices,
    fetchRedditPosts,
    fetchTiktokPosts,
    fetchTruthPosts,
    fetchTweets,
    fetchWorkspace,
  ]);

  useEffect(() => {
    const pollStream = async () => {
      try {
        const res = await fetch(`/api/agent/stream?offset=${streamOffset.current}`);
        const data = await res.json();
        setLiveStatus(data.status?.status || "idle");

        if (data.offset < streamOffset.current) {
          setStreamLines([]);
          streamOffset.current = 0;
        }

        if (data.lines.length > 0) {
          setStreamLines((prev) => {
            const next = [...prev, ...data.lines];
            return next.length > 500 ? next.slice(-500) : next;
          });
          streamOffset.current = data.offset;
        }
      } catch {
        // ignore
      }
    };

    pollStream();
    const id = setInterval(pollStream, 1_000);
    return () => clearInterval(id);
  }, []);

  const mergedNews = mergeNews(news, liveNews);

  const dispatchCycle = useCallback(async (prompt?: string, channel = "command") => {
    const cleanPrompt = prompt?.trim();
    setAgentStatus(cleanPrompt ? `Routing ${channel} request...` : "Starting cycle...");
    setStreamLines([]);
    streamOffset.current = 0;

    const res = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "run_cycle",
        prompt: cleanPrompt ? buildChannelPrompt(cleanPrompt, channel, workspace) : undefined,
      }),
    });
    const data = await res.json();
    setAgentStatus(data.message || data.status);
  }, [workspace]);

  const runCycle = useCallback(async (prompt?: string, channel = "command") => {
    const cleanPrompt = prompt?.trim();
    const entry: PromptEntry | null = cleanPrompt
      ? {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          text: cleanPrompt,
          channel,
          createdAt: new Date().toISOString(),
          state: liveStatus === "running" ? "queued" : "sent",
        }
      : null;

    if (entry) {
      setPromptHistory((prev) => [...prev.slice(-11), entry]);
    }

    if (liveStatus === "running") {
      if (entry) {
        setQueuedPrompts((prev) => [...prev.slice(-5), entry]);
        setAgentStatus(`Agent busy. Queued ${channel} request (${queuedPrompts.length + 1} waiting).`);
      } else {
        setAgentStatus("Agent already running. Let this pass finish before starting another full cycle.");
      }
      return;
    }

    await dispatchCycle(cleanPrompt, channel);
  }, [dispatchCycle, liveStatus, queuedPrompts.length]);

  useEffect(() => {
    if (liveStatus === "running" || queuedPrompts.length === 0) {
      return;
    }

    const [nextPrompt, ...remaining] = queuedPrompts;
    setQueuedPrompts(remaining);
    setPromptHistory((prev) =>
      prev.map((item) => (
        item.id === nextPrompt.id
          ? { ...item, state: "sent" }
          : item
      ))
    );
    void dispatchCycle(nextPrompt.text, nextPrompt.channel);
  }, [dispatchCycle, liveStatus, queuedPrompts]);

  const startLoop = async () => {
    setAgentStatus(`Starting loop (${loopInterval}s)...`);
    const res = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start_loop", interval: loopInterval }),
    });
    const data = await res.json();
    setAgentStatus(`Loop: ${data.interval}s interval`);
  };

  const submitRationale = async () => {
    if (!rationale.trim()) return;

    const thesis = rationale.trim();
    setPromptHistory((prev) => [
      ...prev.slice(-7),
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text: thesis,
        channel: "command",
        createdAt: new Date().toISOString(),
        state: "sent",
      },
    ]);
    setAgentStatus("Researching thesis...");

    const res = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "submit_rationale", rationale: thesis }),
    });
    const data = await res.json();
    setAgentStatus(data.message || data.status);
    setRationale("");
  };

  return (
    <div className="dashboard-shell h-screen w-screen max-w-full overflow-hidden bg-background">
      <div className="flex h-full min-h-0 flex-col">
        <TopBar
          workspace={workspace}
          liveStatus={liveStatus}
          agentStatus={agentStatus}
          queuedCount={queuedPrompts.length}
          rationale={rationale}
          loopInterval={loopInterval}
          onRationaleChange={setRationale}
          onSubmitRationale={submitRationale}
          onRunCycle={() => void runCycle()}
          onStartLoop={startLoop}
          onRefresh={() => {
            fetchWorkspace();
            fetchAll();
            fetchLiveNews();
          }}
          onLoopIntervalChange={setLoopInterval}
        />

        <PortfolioStrip
          portfolio={portfolio}
          unrealizedPnl={prices.reduce((sum, price) => sum + price.unrealized_pnl, 0)}
        />

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)_minmax(0,360px)]">
          <div className="hidden min-h-0 flex-col overflow-hidden border-r border-border/70 bg-white/40 backdrop-blur md:flex">
            <div className="flex-1 min-h-0 overflow-hidden">
              <PositionsPanel
                positions={portfolio?.open_positions ?? []}
                trades={trades}
                prices={prices}
              />
            </div>
            <div className="h-[40%] min-h-0 overflow-hidden border-t border-border/70">
              <MarketScanner markets={markets} />
            </div>
          </div>

          <div className="min-h-0 overflow-hidden">
            <LiveStream
              lines={streamLines}
              liveStatus={liveStatus}
              customPrompt={customPrompt}
              prompts={promptHistory}
              queuedPrompts={queuedPrompts}
              workspace={workspace}
              onCustomPromptChange={setCustomPrompt}
              onSendCommand={(prompt, channel) => {
                void runCycle(prompt, channel);
                setCustomPrompt("");
              }}
            />
          </div>

          <div className="hidden min-h-0 flex-col overflow-hidden border-l border-border/70 bg-white/40 backdrop-blur lg:flex">
            <NewsFeed
              news={mergedNews}
              tweets={tweets}
              truthPosts={truthPosts}
              redditPosts={redditPosts}
              tiktokPosts={tiktokPosts}
              loadingTweets={loadingTweets}
              loadingTruth={loadingTruth}
              loadingReddit={loadingReddit}
              loadingTiktok={loadingTiktok}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function mergeNews(dbNews: NewsArticle[], liveNews: NewsArticle[]): NewsArticle[] {
  const seen = new Set<string>();
  const merged: NewsArticle[] = [];

  for (const item of dbNews) {
    if (!seen.has(item.title)) {
      seen.add(item.title);
      merged.push(item);
    }
  }

  for (const item of liveNews) {
    if (!seen.has(item.title)) {
      seen.add(item.title);
      merged.push(item);
    }
  }

  merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return merged.slice(0, 60);
}

function buildChannelPrompt(
  prompt: string,
  channel: string,
  workspace: WorkspaceSummary | null
) {
  const rails = workspace?.enabledMarkets.join(", ") || "kalshi";
  const feeds = workspace?.integrations.join(", ") || "apify, rss";
  const watchlist = workspace?.tradingview.watchlist.join(", ") || "SPY, QQQ, BTCUSD, NQ1!";

  if (channel === "markets") {
    return `Channel: markets.\nFocus on the enabled market rails (${rails}). Compare prices, scan only liquid contracts, and explain the best surviving setup.\n\nUser request: ${prompt}`;
  }

  if (channel === "feeds") {
    return `Channel: feeds.\nFocus on the enabled news and social feeds (${feeds}). Summarize what changed recently, what is already priced in, and what deserves a market follow-up.\n\nUser request: ${prompt}`;
  }

  if (channel === "risk") {
    return `Channel: risk.\nReview open exposure first. Prioritize thesis validation, exit conditions, bankroll preservation, and hard passes over new trades.\n\nUser request: ${prompt}`;
  }

  if (channel === "execution") {
    return `Channel: execution.\nFocus on the most executable idea only. Confirm supported rails, size, entry level, and why the trade should or should not actually fire.\n\nUser request: ${prompt}`;
  }

  if (channel === "tradingview") {
    const connectorLine =
      workspace?.tradingview.connectorMode === "mcp" && workspace.tradingview.mcpEnabled
        ? workspace.tradingview.configured
          ? "A TradingView MCP connector is configured for this workspace. Use it if the local Claude session has the server available."
          : "TradingView MCP is enabled in the workspace profile but still incomplete. Fall back to the watchlist unless the connector becomes available."
        : "TradingView is running in watchlist-only mode for this workspace.";

    return `Channel: tradingview.\nFocus on the TradingView watchlist (${watchlist}). ${connectorLine}\nUse this lane for symbol triage, cross-asset context, and chart-aware market research.\n\nUser request: ${prompt}`;
  }

  return prompt;
}
