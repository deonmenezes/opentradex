import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  HarnessStatus,
  Position,
  Trade,
  Market,
  FeedItem,
  Message,
} from '../lib/types';

const API_BASE = '/api';
const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
const POLL_INTERVAL_MS = 5000;

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

// Mock data for demo
const mockStatus: HarnessStatus = {
  mode: 'paper-only',
  connection: 'connected',
  rails: {
    kalshi: true,
    polymarket: true,
    alpaca: false,
    tradingview: true,
    crypto: true,
  },
  capital: 15237.74,
  dayPnL: 184.27,
  dayPnLPercent: 1.22,
  trades: 4,
  winRate: 50,
  openPositions: 2,
  cycles: 2,
  isAutoLoop: false,
  cycleInterval: 15,
};

const mockPositions: Position[] = [
  {
    id: '1',
    exchange: 'kalshi',
    symbol: 'FED-SEP-CUT',
    title: 'Will the Fed cut rates by September?',
    side: 'yes',
    size: 18,
    avgPrice: 0.41,
    currentPrice: 0.56,
    pnl: 2.70,
    pnlPercent: 36.6,
    confidence: 'High',
  },
  {
    id: '2',
    exchange: 'kalshi',
    symbol: 'BTC-EOY-120K',
    title: 'Will Bitcoin finish the year above 120k?',
    side: 'yes',
    size: 24,
    avgPrice: 0.36,
    currentPrice: 0.49,
    pnl: 3.12,
    pnlPercent: 36.1,
    confidence: 'Medium',
  },
];

const mockTrades: Trade[] = [
  { id: '1', exchange: 'kalshi', symbol: 'FED-SEP-CUT', side: 'yes', size: 18, price: 0.41, status: 'open', timestamp: Date.now() - 18 * 60000, age: '18m' },
  { id: '2', exchange: 'kalshi', symbol: 'BTC-EOY-120K', side: 'yes', size: 24, price: 0.36, status: 'open', timestamp: Date.now() - 42 * 60000, age: '42m' },
  { id: '3', exchange: 'kalshi', symbol: 'OIL-Q3-90', side: 'yes', size: 15, price: 0.33, pnl: 71.00, status: 'closed', timestamp: Date.now() - 3600000, age: '1h' },
  { id: '4', exchange: 'polymarket', symbol: 'GDP-NEXT-LOWER', side: 'no', size: 30, price: 0.52, pnl: -24.00, status: 'closed', timestamp: Date.now() - 7200000, age: '2h' },
];

const mockMarkets: Market[] = [
  { id: '1', exchange: 'kalshi', symbol: 'FED-SEP-CUT', title: 'Will the Fed cut rates by Sept...', bidAsk: '42/44', mid: 43, volume: '1.2M' },
  { id: '2', exchange: 'kalshi', symbol: 'BTC-EOY-120K', title: 'Will Bitcoin finish the year above...', bidAsk: '37/39', mid: 38, volume: '920.0K' },
  { id: '3', exchange: 'kalshi', symbol: 'OIL-Q3-90', title: 'Will WTI crude trade above 90 be...', bidAsk: '33/35', mid: 34, volume: '610.0K' },
  { id: '4', exchange: 'polymarket', symbol: 'JOBS-NEXT-STRONG', title: 'Will jobs report beat expectations...', bidAsk: '48/50', mid: 49, volume: '420.0K' },
];

const mockFeed: FeedItem[] = [
  { id: '1', source: 'reuters', category: 'macro', title: 'Rates markets lean toward an earlier cut as Treasury yields cool', summary: 'Bond traders pushed yields lower after softer macro data nudged expectations for the first cut into September.', timestamp: Date.now() - 14 * 60000, age: '14m', tickers: ['TLT', 'ZN'] },
  { id: '2', source: 'bloomberg', category: 'crypto', title: 'Bitcoin demand firms as ETF flows recover and volatility settles', summary: 'IBIT and FBTC saw $312M of combined net inflows yesterday, the strongest day in three weeks.', timestamp: Date.now() - 28 * 60000, age: '28m', tickers: ['BTC', 'IBIT'] },
  { id: '3', source: 'ft', category: 'commodities', title: 'Crude risk premium rises as traders assess fresh supply concerns', timestamp: Date.now() - 45 * 60000, age: '45m', tickers: ['CL', 'USO'] },
  { id: '4', source: 'cnbc', category: 'equities', title: 'Nvidia leads chip rally as hyperscaler capex guidance surprises to the upside', summary: 'Microsoft and Meta both lifted FY26 capex targets, pointing to sustained AI infrastructure demand.', timestamp: Date.now() - 33 * 60000, age: '33m', tickers: ['NVDA', 'MSFT', 'META'] },
  { id: '5', source: 'wsj', category: 'macro', title: 'Fed staff memo flags cooling labor market, tees up September pivot debate', timestamp: Date.now() - 48 * 60000, age: '48m', tickers: ['SPY', 'TLT'] },
  { id: '6', source: 'marketwatch', category: 'equities', title: 'SPX closes at fresh high as breadth finally catches up to the mega-caps', timestamp: Date.now() - 55 * 60000, age: '55m', tickers: ['SPY', 'RSP'] },
  { id: '7', source: 'coindesk', category: 'crypto', title: 'Ether options skew flips bullish ahead of the Pectra upgrade', timestamp: Date.now() - 62 * 60000, age: '1h', tickers: ['ETH'] },
  { id: '8', source: 'theblock', category: 'crypto', title: 'Polymarket volume crosses $1.1B on US election week contracts', timestamp: Date.now() - 72 * 60000, age: '1h', tickers: ['POLY'] },
  { id: '9', source: 'benzinga', category: 'equities', title: 'Unusual options flow: $18M of SPY Nov 600c hit the tape before the close', timestamp: Date.now() - 82 * 60000, age: '1h', tickers: ['SPY'] },
  { id: '10', source: 'seekingalpha', category: 'forex', title: 'DXY slides to fresh 6-month low as carry trades unwind into BoJ meeting', timestamp: Date.now() - 95 * 60000, age: '2h', tickers: ['DXY', 'USDJPY'] },
  { id: '11', source: 'x', category: 'social', title: '@zerohedge: Fed pivot incoming? Market pricing now shows 73% chance of September cut', timestamp: Date.now() - 52 * 60000, age: '52m' },
  { id: '12', source: 'reddit', category: 'social', title: 'r/wallstreetbets: Massive call flow on SPY 550c expiring Friday', timestamp: Date.now() - 67 * 60000, age: '1h' },
];

export function useHarness() {
  const [status, setStatus] = useState<HarnessStatus>(mockStatus);
  const [positions, setPositions] = useState<Position[]>(mockPositions);
  const [trades, setTrades] = useState<Trade[]>(mockTrades);
  const [markets, setMarkets] = useState<Market[]>(mockMarkets);
  const [feed, setFeed] = useState<FeedItem[]>(mockFeed);
  const [messages, setMessages] = useState<Message[]>([]);
  const [connectionType, setConnectionType] = useState<'ws' | 'sse' | 'none'>('none');
  const wsRef = useRef<WebSocket | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loopTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

    // Pull live data from the gateway (real markets, real risk state)
    async function pollLive() {
      if (!mounted) return;
      try {
        const [scanRes, riskRes] = await Promise.all([
          fetch(`${API_BASE}/scan?limit=50`).catch(() => null),
          fetch(`${API_BASE}/risk`).catch(() => null),
        ]);

        if (scanRes?.ok && mounted) {
          const data = await scanRes.json();
          const live = Array.isArray(data?.markets) ? (data.markets as GatewayMarket[]).map(toMarket) : [];
          if (live.length > 0) setMarkets(live);
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
            setStatus((prev) => ({
              ...prev,
              dayPnL: Number(state.dailyPnL ?? 0),
              dayPnLPercent: prev.capital > 0 ? (Number(state.dailyPnL ?? 0) / prev.capital) * 100 : 0,
              trades: Number(state.dailyTrades ?? 0),
              openPositions: livePositions.length,
            }));
          }
        }
      } catch {
        /* swallow — next tick will retry */
      }
    }

    function connectWebSocket() {
      if (!mounted) return;

      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          if (mounted) {
            console.log('[WS] Connected');
            setConnectionType('ws');
            setStatus((prev) => ({ ...prev, connection: 'connected' }));
            // If SSE fallback is open, close it now that WS is live
            if (eventSourceRef.current) {
              eventSourceRef.current.close();
              eventSourceRef.current = null;
            }
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            handleRealtimeMessage(data);
          } catch {
            // Ignore invalid JSON
          }
        };

        ws.onerror = () => {
          console.log('[WS] Error, falling back to SSE');
          ws.close();
        };

        ws.onclose = () => {
          if (mounted) {
            wsRef.current = null;
            // Fall back to SSE
            connectSSE();
            // Try to reconnect WebSocket after delay
            reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000);
          }
        };
      } catch {
        // WebSocket not available, use SSE
        connectSSE();
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

    fetchData();
    connectWebSocket();
    pollLive();
    pollTimer = setInterval(pollLive, POLL_INTERVAL_MS);

    return () => {
      mounted = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
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

  return {
    status,
    positions,
    trades,
    markets,
    feed,
    messages,
    sendCommand,
    toggleAutoLoop,
    setLoopInterval,
    runCycle,
    panic,
  };
}
