"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { TopBar } from "@/components/TopBar";
import { PortfolioStrip } from "@/components/PortfolioStrip";
import { PositionsPanel } from "@/components/PositionsPanel";
import { MarketScanner } from "@/components/MarketScanner";
import { LiveStream } from "@/components/LiveStream";
import { NewsFeed } from "@/components/NewsFeed";
import type {
  Portfolio,
  Trade,
  NewsArticle,
  Market,
  StreamLine,
  PositionPrice,
  SocialPost,
} from "@/lib/types";

export default function Dashboard() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [liveNews, setLiveNews] = useState<NewsArticle[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
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
  const streamOffset = useRef(0);

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

  const SHOW_PNL = false;

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
        tweetRetries.current++;
        if (tweetRetries.current > 12) setLoadingTweets(false);
      }
    } catch {
      tweetRetries.current++;
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
        redditRetries.current++;
        if (redditRetries.current > 12) setLoadingReddit(false);
      }
    } catch {
      redditRetries.current++;
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
        tiktokRetries.current++;
        if (tiktokRetries.current > 12) setLoadingTiktok(false);
      }
    } catch {
      tiktokRetries.current++;
      if (tiktokRetries.current > 12) setLoadingTiktok(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    fetchLiveNews();
    fetchPrices();
    // Stagger Apify fetches to avoid concurrent run limit on free tier
    fetchTruthPosts();
    const redditDelay = setTimeout(fetchRedditPosts, 5_000);
    const tweetDelay = setTimeout(fetchTweets, 15_000);
    const tiktokDelay = setTimeout(fetchTiktokPosts, 25_000);
    const id = setInterval(fetchAll, 5000);
    const newsId = setInterval(fetchLiveNews, 120_000);
    const pricesId = setInterval(fetchPrices, 30_000);
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
      clearInterval(id);
      clearInterval(newsId);
      clearInterval(pricesId);
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
  }, [fetchAll, fetchLiveNews, fetchPrices, fetchTweets, fetchTruthPosts, fetchRedditPosts, fetchTiktokPosts]);

  useEffect(() => {
    const pollStream = async () => {
      try {
        const res = await fetch(
          `/api/agent/stream?offset=${streamOffset.current}`
        );
        const data = await res.json();
        setLiveStatus(data.status?.status || "idle");
        if (data.lines.length > 0) {
          setStreamLines((prev) => {
            const next = [...prev, ...data.lines];
            return next.length > 500 ? next.slice(-500) : next;
          });
          streamOffset.current = data.offset;
        }
        if (data.offset < streamOffset.current) {
          setStreamLines([]);
          streamOffset.current = 0;
        }
      } catch {
        // ignore
      }
    };
    const id = setInterval(pollStream, 1000);
    return () => clearInterval(id);
  }, []);

  const mergedNews = mergeNews(news, liveNews);

  const runCycle = async (prompt?: string) => {
    setAgentStatus("Starting cycle...");
    setStreamLines([]);
    streamOffset.current = 0;
    const res = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "run_cycle", prompt }),
    });
    const data = await res.json();
    setAgentStatus(data.message || data.status);
  };

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
    setAgentStatus("Researching thesis...");
    const res = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "submit_rationale", rationale }),
    });
    const data = await res.json();
    setAgentStatus(data.message || data.status);
    setRationale("");
  };

  return (
    <div className="h-screen w-screen max-w-full flex flex-col overflow-hidden bg-background">
      <TopBar
        liveStatus={liveStatus}
        agentStatus={agentStatus}
        rationale={rationale}
        loopInterval={loopInterval}
        onRationaleChange={setRationale}
        onSubmitRationale={submitRationale}
        onRunCycle={() => runCycle()}
        onStartLoop={startLoop}
        onRefresh={() => {
          fetchAll();
          fetchLiveNews();
        }}
        onLoopIntervalChange={setLoopInterval}
      />

      <PortfolioStrip portfolio={portfolio} unrealizedPnl={prices.reduce((s, p) => s + p.unrealized_pnl, 0)} />

      <div className="flex-1 grid grid-cols-1 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)_minmax(0,340px)] min-h-0 overflow-hidden">
        {/* Left column: Positions + Markets */}
        <div className="hidden md:flex flex-col border-r border-border min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-hidden">
            <PositionsPanel
              positions={portfolio?.open_positions ?? []}
              trades={trades}
              prices={prices}
            />
          </div>
          <div className="h-[40%] min-h-0 overflow-hidden border-t border-border">
            <MarketScanner markets={markets} />
          </div>
        </div>

        {/* Center column: Live Stream */}
        <div className="flex flex-col min-h-0">
          <LiveStream
            lines={streamLines}
            liveStatus={liveStatus}
            customPrompt={customPrompt}
            onCustomPromptChange={setCustomPrompt}
            onSendCommand={(prompt) => {
              runCycle(prompt);
              setCustomPrompt("");
            }}
          />
        </div>

        {/* Right column: News Feed (full height) */}
        <div className="hidden lg:flex flex-col border-l border-border min-h-0 overflow-hidden">
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

  merged.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  return merged.slice(0, 60);
}
