import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  HarnessStatus,
  Position,
  Trade,
  Market,
  FeedItem,
  Message,
  WsMeta,
} from '../lib/types';

const API_BASE = '/api';
const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
const POLL_INTERVAL_MS = 5000;
// Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (cap). Reset on successful open.
const RECONNECT_BASE_MS = 1000;
const RECONNECT_CAP_MS = 30_000;
const RECONNECT_BANNER_MS = 2000;
const PING_INTERVAL_MS = 15_000;

function formatVolume(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '0';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

interface GatewayMarket {
  id: string;
  exchange: string;
  symbol: string;
  title: string;
  price?: number;
  mid?: number;
  bid?: number;
  ask?: number;
  bidAsk?: string;
  volume?: number | string;
}

function toMarket(m: GatewayMarket): Market {
  const mid = typeof m.mid === 'number' ? m.mid : typeof m.price === 'number' ? Math.round(m.price * 100) : 0;
  const bidAsk =
    m.bidAsk ??
    (typeof m.bid === 'number' && typeof m.ask === 'number'
      ? `${Math.round(m.bid * 100)}/${Math.round(m.ask * 100)}`
      : `${Math.max(0, mid - 1)}/${mid + 1}`);
  return {
    id: String(m.id),
    exchange: m.exchange,
    symbol: m.symbol,
    title: m.title,
    bidAsk,
    mid,
    volume: typeof m.volume === 'number' ? formatVolume(m.volume) : (m.volume ?? '0'),
  };
}

// Initial empty state — real data streams in from the gateway.
// No mock values: if the gateway is unreachable, the UI shows zeros + empty lists,
// which is the honest state rather than a fake portfolio.
const initialStatus: HarnessStatus = {
  mode: 'paper-only',
  connection: 'connecting',
  rails: {
    kalshi: false,
    polymarket: false,
    alpaca: false,
    tradingview: false,
    crypto: false,
  },
  capital: 0,
  dayPnL: 0,
  dayPnLPercent: 0,
  trades: 0,
  winRate: 0,
  openPositions: 0,
  cycles: 0,
  isAutoLoop: false,
  cycleInterval: 15,
};

export function useHarness() {
  const [status, setStatus] = useState<HarnessStatus>(initialStatus);
  const [positions, setPositions] = useState<Position[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [connectionType, setConnectionType] = useState<'ws' | 'sse' | 'none'>('none');
  const [wsMeta, setWsMeta] = useState<WsMeta>({ attempts: 0, latencyMs: -1, reconnectedAt: 0 });
  const wsRef = useRef<WebSocket | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const everConnectedRef = useRef(false);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPingAtRef = useRef(0);
  const loopTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectFnRef = useRef<() => void>(() => {});

  // Handle real-time message
  const handleRealtimeMessage = useCallback((data: { type: string; payload: unknown }) => {
    if (data.type === 'position') {
      setPositions((prev) => {
        const payload = data.payload as Position;
        const idx = prev.findIndex((p) => p.id === payload.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = payload;
          return updated;
        }
        return [payload, ...prev];
      });
    } else if (data.type === 'trade') {
      setTrades((prev) => [data.payload as Trade, ...prev.slice(0, 19)]);
    } else if (data.type === 'feed') {
      setFeed((prev) => [data.payload as FeedItem, ...prev.slice(0, 49)]);
    } else if (data.type === 'market') {
      setMarkets((prev) => {
        const payload = data.payload as Market;
        const idx = prev.findIndex((m) => m.id === payload.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = payload;
          return updated;
        }
        return [payload, ...prev];
      });
    }
  }, []);

  // Setup WebSocket connection with SSE fallback
  useEffect(() => {
    let mounted = true;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    async function fetchData() {
      try {
        const res = await fetch(`${API_BASE}/`);
        if (res.ok) {
          const data = await res.json();
          if (mounted) {
            setStatus((prev) => ({
              ...prev,
              mode: data.mode || prev.mode,
              connection: 'connected',
              rails: {
                kalshi: data.exchanges?.includes('kalshi') ?? true,
                polymarket: data.exchanges?.includes('polymarket') ?? true,
                alpaca: data.exchanges?.includes('alpaca') ?? false,
                tradingview: data.exchanges?.includes('tradingview') ?? true,
                crypto: data.exchanges?.includes('crypto') ?? true,
              },
            }));
          }
        }
      } catch {
        if (mounted) {
          setStatus((prev) => ({ ...prev, connection: 'disconnected' }));
        }
      }
    }

    // Pull live data from the gateway (real scraped markets, real risk state, live news)
    async function pollLive() {
      if (!mounted) return;
      try {
        const [scanRes, riskRes, scraperRes] = await Promise.all([
          fetch(`${API_BASE}/scan?limit=50`).catch(() => null),
          fetch(`${API_BASE}/risk`).catch(() => null),
          fetch(`${API_BASE}/scraper/snapshot`).catch(() => null),
        ]);

        if (scanRes?.ok && mounted) {
          const data = await scanRes.json();
          const live = Array.isArray(data?.markets) ? (data.markets as GatewayMarket[]).map(toMarket) : [];
          if (live.length > 0) setMarkets(live);
        }

        // Hydrate dashboard with live scraped data (news feed, exchange events)
        if (scraperRes?.ok && mounted) {
          try {
            const scraperData = await scraperRes.json();
            // Push scraped news into the feed
            if (Array.isArray(scraperData?.news) && scraperData.news.length > 0) {
              const scrapedFeed = (scraperData.news as Array<{
                id: string; title: string; summary?: string; source: string;
                url: string; age: string; category: string; tickers?: string[];
                sentiment?: string;
              }>).map((n): FeedItem => ({
                id: n.id,
                title: n.title,
                summary: n.summary,
                source: n.source as FeedItem['source'],
                url: n.url,
                age: n.age,
                timestamp: Date.now(),
                category: n.category as FeedItem['category'],
                tickers: n.tickers,
                sentiment: n.sentiment as FeedItem['sentiment'],
              }));
              setFeed(scrapedFeed);
            }
          } catch { /* ignore parse errors */ }
        }

        if (riskRes?.ok && mounted) {
          const data = await riskRes.json();
          const state = data?.state;
          if (state) {
            const livePositions = Array.isArray(state.openPositions)
              ? (state.openPositions as Array<Record<string, unknown>>).map((p, i): Position => ({
                  id: String(p.id ?? i),
                  exchange: String(p.exchange ?? 'kalshi'),
                  symbol: String(p.symbol ?? '—'),
                  title: String(p.title ?? p.symbol ?? ''),
                  side: (p.side as Position['side']) ?? 'yes',
                  size: Number(p.size ?? 0),
                  avgPrice: Number(p.avgPrice ?? p.entry ?? 0),
                  currentPrice: Number(p.currentPrice ?? p.mark ?? p.avgPrice ?? 0),
                  pnl: Number(p.pnl ?? 0),
                  pnlPercent: Number(p.pnlPercent ?? 0),
                  confidence: (p.confidence as Position['confidence']) ?? 'Medium',
                }))
              : [];
            setPositions(livePositions);
            setStatus((prev) => {
              const capital = Number(state.equity ?? state.startingCapital ?? 0);
              const dayPnL = Number(state.dailyPnL ?? 0);
              return {
                ...prev,
                capital,
                dayPnL,
                dayPnLPercent: capital > 0 ? (dayPnL / capital) * 100 : 0,
                trades: Number(state.dailyTrades ?? 0),
                winRate: Number(state.winRate ?? 0),
                openPositions: livePositions.length,
              };
            });
          }
        }
      } catch {
        /* swallow — next tick will retry */
      }
    }

    function startPingLoop(ws: WebSocket) {
      if (pingTimerRef.current) clearInterval(pingTimerRef.current);
      pingTimerRef.current = setInterval(() => {
        if (ws.readyState !== WebSocket.OPEN) return;
        try {
          lastPingAtRef.current = Date.now();
          ws.send(JSON.stringify({ type: 'ping', t: lastPingAtRef.current }));
        } catch {
          // next tick will retry; server heartbeat will evict if we stay silent
        }
      }, PING_INTERVAL_MS);
    }

    function stopPingLoop() {
      if (pingTimerRef.current) {
        clearInterval(pingTimerRef.current);
        pingTimerRef.current = null;
      }
    }

    function scheduleReconnect() {
      if (!mounted) return;
      const attempt = reconnectAttemptsRef.current;
      // 1s, 2s, 4s, 8s, 16s, 30s (cap)
      const delay = Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_CAP_MS);
      reconnectAttemptsRef.current = attempt + 1;
      setWsMeta((m) => ({ ...m, attempts: reconnectAttemptsRef.current }));
      setStatus((prev) => ({ ...prev, connection: 'reconnecting' }));

      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, delay);
    }

    function connectWebSocket() {
      if (!mounted) return;

      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!mounted) return;
          console.log('[WS] Connected');
          const wasPreviouslyConnected = everConnectedRef.current;
          everConnectedRef.current = true;
          reconnectAttemptsRef.current = 0;

          setConnectionType('ws');
          setStatus((prev) => ({ ...prev, connection: 'connected' }));
          setWsMeta((m) => ({
            ...m,
            attempts: 0,
            reconnectedAt: wasPreviouslyConnected ? Date.now() : m.reconnectedAt,
          }));

          // Auto-clear the reconnected banner after 2s
          if (wasPreviouslyConnected) {
            setTimeout(() => {
              setWsMeta((m) =>
                m.reconnectedAt && Date.now() - m.reconnectedAt >= RECONNECT_BANNER_MS
                  ? { ...m, reconnectedAt: 0 }
                  : m
              );
            }, RECONNECT_BANNER_MS + 50);
          }

          // Close SSE fallback (re-subscribe exclusively to WS)
          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }
          startPingLoop(ws);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data?.type === 'pong' && typeof data.timestamp === 'number' && lastPingAtRef.current > 0) {
              const latency = Date.now() - lastPingAtRef.current;
              setWsMeta((m) => ({ ...m, latencyMs: latency }));
              return;
            }
            handleRealtimeMessage(data);
          } catch {
            // Ignore invalid JSON
          }
        };

        ws.onerror = () => {
          console.log('[WS] Error, falling back to SSE');
          try { ws.close(); } catch { /* already closing */ }
        };

        ws.onclose = () => {
          if (!mounted) return;
          wsRef.current = null;
          stopPingLoop();
          // Fall back to SSE so the feed doesn't go silent while WS recovers
          connectSSE();
          scheduleReconnect();
        };
      } catch {
        connectSSE();
        scheduleReconnect();
      }
    }

    function connectSSE() {
      if (!mounted || eventSourceRef.current) return;

      try {
        const es = new EventSource(`${API_BASE}/events`);
        eventSourceRef.current = es;

        es.onopen = () => {
          if (mounted && !wsRef.current) {
            console.log('[SSE] Connected');
            setConnectionType('sse');
            setStatus((prev) => ({ ...prev, connection: 'connected' }));
          }
        };

        es.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            handleRealtimeMessage(data);
          } catch {
            // Ignore invalid JSON
          }
        };

        es.onerror = () => {
          if (mounted) {
            setStatus((prev) => ({ ...prev, connection: 'connecting' }));
          }
        };
      } catch {
        // SSE not available
        if (mounted) {
          setConnectionType('none');
        }
      }
    }

    reconnectFnRef.current = () => {
      if (!mounted) return;
      reconnectAttemptsRef.current = 0;
      setWsMeta((m) => ({ ...m, attempts: 0 }));
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      try { wsRef.current?.close(); } catch { /* ignore */ }
      wsRef.current = null;
      connectWebSocket();
    };

    fetchData();
    connectWebSocket();
    pollLive();
    pollTimer = setInterval(pollLive, POLL_INTERVAL_MS);

    return () => {
      mounted = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pingTimerRef.current) {
        clearInterval(pingTimerRef.current);
        pingTimerRef.current = null;
      }
      if (pollTimer) clearInterval(pollTimer);
      wsRef.current?.close();
      eventSourceRef.current?.close();
    };
  }, [handleRealtimeMessage]);

  // Send command to harness
  const sendCommand = useCallback(async (command: string): Promise<string> => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: command,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const res = await fetch(`${API_BASE}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });

      const data = await res.json();
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || JSON.stringify(data, null, 2),
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      return data.response;
    } catch (err) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Failed to send command'}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      return errorMessage.content;
    }
  }, []);

  // Run single cycle
  const runCycle = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/agent/scan`, { method: 'POST' });
      setStatus((prev) => ({ ...prev, cycles: prev.cycles + 1 }));
    } catch {
      // Fallback to command if agent endpoint fails
      setStatus((prev) => ({ ...prev, cycles: prev.cycles + 1 }));
      await sendCommand('scan all markets and propose best trade');
    }
  }, [sendCommand]);

  // Set loop interval (0 = off, N = run every N minutes)
  const setLoopInterval = useCallback(async (minutes: number) => {
    if (loopTimerRef.current) {
      clearInterval(loopTimerRef.current);
      loopTimerRef.current = null;
    }

    const enabled = minutes > 0;
    try {
      await fetch(`${API_BASE}/agent/autoloop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, intervalMinutes: minutes }),
      });
    } catch {
      // Non-fatal — client-side timer still runs
    }

    setStatus((prev) => ({ ...prev, isAutoLoop: enabled, cycleInterval: enabled ? minutes : prev.cycleInterval }));

    if (enabled) {
      loopTimerRef.current = setInterval(() => {
        runCycle();
      }, minutes * 60 * 1000);
    }
  }, [runCycle]);

  // Back-compat toggle (used by TopBar.onToggleAutoLoop)
  const toggleAutoLoop = useCallback(() => {
    if (status.isAutoLoop) {
      setLoopInterval(0);
    } else {
      setLoopInterval(status.cycleInterval || 5);
    }
  }, [status.isAutoLoop, status.cycleInterval, setLoopInterval]);

  // Clean up loop timer on unmount
  useEffect(() => {
    return () => {
      if (loopTimerRef.current) {
        clearInterval(loopTimerRef.current);
        loopTimerRef.current = null;
      }
    };
  }, []);

  // Panic - emergency stop
  const panic = useCallback(async () => {
    await fetch(`${API_BASE}/panic`, { method: 'POST' });
    setStatus((prev) => ({ ...prev, isAutoLoop: false }));
  }, []);

  // Force an immediate reconnect attempt (resets backoff counter).
  const reconnect = useCallback(() => {
    reconnectFnRef.current();
  }, []);

  return {
    status,
    positions,
    trades,
    markets,
    feed,
    messages,
    wsMeta,
    connectionType,
    sendCommand,
    toggleAutoLoop,
    setLoopInterval,
    runCycle,
    panic,
    reconnect,
  };
}
