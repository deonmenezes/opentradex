#!/usr/bin/env node
/**
 * Coinbase rail — scan top USD pairs + paper order fills.
 * Uses public Exchange API (api.exchange.coinbase.com), no auth needed for read.
 */

const API = 'https://api.exchange.coinbase.com';
const DEFAULT_PAIRS = ['BTC-USD', 'ETH-USD', 'SOL-USD', 'DOGE-USD', 'XRP-USD', 'ADA-USD', 'AVAX-USD', 'LINK-USD', 'MATIC-USD', 'DOT-USD'];

export async function scan({ limit = 10 } = {}) {
  const pairs = DEFAULT_PAIRS.slice(0, limit);
  const rows = [];
  await Promise.all(pairs.map(async (pair) => {
    try {
      const r = await fetch(`${API}/products/${pair}/ticker`);
      if (!r.ok) throw new Error(`coinbase ${r.status}`);
      const t = await r.json();
      rows.push({
        symbol: pair,
        title: pair,
        bid: Number(t.bid || 0),
        ask: Number(t.ask || 0),
        last: Number(t.price || 0),
        volume: Number(t.volume || 0),
      });
    } catch (e) {
      rows.push({ symbol: pair, title: pair, bid: 0, ask: 0, volume: 0, note: `scan failed: ${e.message}` });
    }
  }));
  return rows;
}

export async function order({ symbol, side, qty, price }) {
  const p = price ?? 0;
  return {
    rail: 'coinbase',
    symbol, side, qty,
    price: Number(p),
    paper: true,
    filledAt: new Date().toISOString(),
  };
}
