import { useState, useEffect } from 'react';

export interface ScraperHealth {
  name: string;
  ok: boolean;
  status: 'green' | 'yellow' | 'red';
  count: number;
  ageSec: number;
  lastUpdate: number;
}

export interface AgentContext {
  mode?: string;
  modeLock: string;
  tradingHalted: { halted: boolean; cooldownUntil?: number; reason?: string };
  risk: { equity: number; dailyPnL: number; openPositions: number; dailyTrades: number };
  positions: Array<{ id: string; symbol: string; exchange: string; side: string; pnl: number }>;
  scraperHealth: ScraperHealth[];
  rails: Array<{ id: string; kind: string; enabled: boolean }>;
  recentRuns: Array<{ runId: string; skillId: string; status: string }>;
  skills: Array<{ id: string; category: string }>;
  aiProviders?: Array<{ name: string; configured: boolean }>;
  timestamp: number;
}

const API_BASE = (import.meta as unknown as { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE || '/api';
const POLL_MS = 8000;

// Polls /api/agent/context to get a single unified snapshot of harness state:
// scraper health, trading halt, risk, positions, rails, recent runs, AI providers.
// Used by TopBar status badges (US-014) and the Agent Console awareness indicator.
export function useAgentContext() {
  const [context, setContext] = useState<AgentContext | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let aborter: AbortController | null = null;

    async function load() {
      aborter?.abort();
      aborter = new AbortController();
      try {
        const r = await fetch(`${API_BASE}/agent/context`, { signal: aborter.signal });
        if (!r.ok) { if (mounted) setError(`HTTP ${r.status}`); return; }
        const data = await r.json();
        if (mounted) { setContext(data); setError(null); }
      } catch (e) {
        if (mounted && (e as Error).name !== 'AbortError') {
          setError((e as Error).message);
        }
      }
    }

    load();
    const t = setInterval(load, POLL_MS);
    return () => { mounted = false; aborter?.abort(); clearInterval(t); };
  }, []);

  return { context, error };
}
