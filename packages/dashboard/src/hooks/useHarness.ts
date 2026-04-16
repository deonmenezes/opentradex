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
  { id: '1', source: 'reuters', title: 'Rates markets lean toward an earlier cut as Treasury yields cool', summary: 'Bond traders pushed yields lower after softer macro data...', timestamp: Date.now() - 14 * 60000, age: '14m' },
  { id: '2', source: 'bloomberg', title: 'Bitcoin demand firms as ETF flows recover and volatility settles', timestamp: Date.now() - 28 * 60000, age: '28m' },
  { id: '3', source: 'ft', title: 'Crude risk premium rises as traders assess fresh supply concerns', timestamp: Date.now() - 45 * 60000, age: '45m' },
  { id: '4', source: 'x', title: '@zerohedge: Fed pivot incoming? Market pricing now shows 73% chance of September cut', timestamp: Date.now() - 52 * 60000, age: '52m' },
  { id: '5', source: 'reddit', title: 'r/wallstreetbets: Massive call flow on SPY 550c expiring Friday', timestamp: Date.now() - 67 * 60000, age: '1h' },
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

    async function fetchData() {
      try {
        const res = await fetch(`${API_BASE}/`);
        if (res.ok) {
          const data = await res.json();
          if (mounted) {
            setStatus((prev) => ({
              ...prev,
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
          if (mounted && connectionType !== 'ws') {
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
            setStatus((prev) => ({ ...prev, connection: 'reconnecting' }));
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

    return () => {
      mounted = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close();
      eventSourceRef.current?.close();
    };
  }, [handleRealtimeMessage, connectionType]);

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

  // Toggle auto loop
  const toggleAutoLoop = useCallback(() => {
    setStatus((prev) => ({ ...prev, isAutoLoop: !prev.isAutoLoop }));
  }, []);

  // Run single cycle
  const runCycle = useCallback(async () => {
    setStatus((prev) => ({ ...prev, cycles: prev.cycles + 1 }));
    await sendCommand('scan all markets and propose best trade');
  }, [sendCommand]);

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
    runCycle,
    panic,
  };
}
