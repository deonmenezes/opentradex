#!/usr/bin/env node
/**
 * Polymarket rail — read-only scan + paper order fills.
 */

const API = 'https://gamma-api.polymarket.com';

export async function scan({ limit = 10 } = {}) {
  try {
    const r = await fetch(`${API}/markets?active=true&closed=false&limit=${limit}`);
    if (!r.ok) throw new Error(`polymarket ${r.status}`);
    const j = await r.json();
    const rows = (Array.isArray(j) ? j : j.data || []).slice(0, limit).map((m) => {
      const last = Number(m.lastTradePrice ?? m.outcomePrices?.[0] ?? 0.5);
      return {
        symbol: m.conditionId || m.slug || m.id,
        title: m.question || m.title || 'untitled',
        yesBid: Math.max(0, last - 0.01),
        yesAsk: Math.min(1, last + 0.01),
        volume: Number(m.volume || 0),
        closeTime: m.endDate,
      };
    });
    return rows;
  } catch (e) {
    return [{ symbol: 'POLY-DEMO', title: `scan failed: ${e.message}`, yesBid: 0.48, yesAsk: 0.52, volume: 0 }];
  }
}

export async function order({ symbol, side, qty, price }) {
  const p = price ?? 0.5;
  return {
    rail: 'polymarket',
    symbol, side, qty,
    price: Number(p),
    paper: true,
    filledAt: new Date().toISOString(),
  };
}
