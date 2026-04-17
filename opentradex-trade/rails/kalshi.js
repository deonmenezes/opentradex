#!/usr/bin/env node
/**
 * Kalshi rail — read-only scan + paper order fills.
 * Public markets endpoint works without auth for read. Orders are paper-only.
 */

const API = 'https://api.elections.kalshi.com/trade-api/v2';

export async function scan({ limit = 10 } = {}) {
  try {
    const r = await fetch(`${API}/markets?limit=${limit}&status=open`);
    if (!r.ok) throw new Error(`kalshi ${r.status}`);
    const j = await r.json();
    const rows = (j.markets || []).slice(0, limit).map((m) => ({
      symbol: m.ticker,
      title: m.title || m.subtitle || m.ticker,
      yesBid: (m.yes_bid ?? 0) / 100,
      yesAsk: (m.yes_ask ?? 0) / 100,
      volume: m.volume ?? 0,
      closeTime: m.close_time,
    }));
    return rows;
  } catch (e) {
    return [{ symbol: 'KALSHI-DEMO', title: `scan failed: ${e.message}`, yesBid: 0.5, yesAsk: 0.55, volume: 0 }];
  }
}

export async function order({ symbol, side, qty, price }) {
  const p = price ?? 0.5;
  return {
    rail: 'kalshi',
    symbol, side, qty,
    price: Number(p),
    paper: true,
    filledAt: new Date().toISOString(),
  };
}
