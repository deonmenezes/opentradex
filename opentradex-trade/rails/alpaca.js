#!/usr/bin/env node
/**
 * Alpaca rail — scan most-active US stocks + paper order fills.
 * Uses data.alpaca.markets with paper creds if provided.
 */

const DATA = 'https://data.alpaca.markets/v2';
const DEFAULT_SYMS = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'GOOGL', 'META', 'AMD', 'NFLX', 'SPY'];

export async function scan({ creds = {}, limit = 10 } = {}) {
  const symbols = DEFAULT_SYMS.slice(0, limit);
  const headers = creds.apiKey && creds.apiSecret
    ? { 'APCA-API-KEY-ID': creds.apiKey, 'APCA-API-SECRET-KEY': creds.apiSecret }
    : {};
  try {
    const url = `${DATA}/stocks/snapshots?symbols=${symbols.join(',')}`;
    const r = await fetch(url, { headers });
    if (!r.ok) throw new Error(`alpaca ${r.status}`);
    const j = await r.json();
    const rows = [];
    for (const sym of symbols) {
      const s = j[sym] || {};
      const trade = s.latestTrade || {};
      const quote = s.latestQuote || {};
      const price = Number(trade.p || quote.ap || quote.bp || 0);
      rows.push({
        symbol: sym,
        title: sym,
        bid: Number(quote.bp || price),
        ask: Number(quote.ap || price),
        volume: Number(trade.s || 0),
      });
    }
    return rows;
  } catch (e) {
    return symbols.map((s) => ({ symbol: s, title: s, bid: 0, ask: 0, volume: 0, note: `scan failed: ${e.message}` }));
  }
}

export async function order({ symbol, side, qty, price }) {
  const p = price ?? 0;
  return {
    rail: 'alpaca',
    symbol, side, qty,
    price: Number(p),
    paper: true,
    filledAt: new Date().toISOString(),
  };
}
