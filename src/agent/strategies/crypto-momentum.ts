/**
 * Crypto momentum — very simple: rank by 24h notional volume. Because the
 * harness doesn't yet persist price history, we proxy "momentum" with liquidity.
 * The aggregator will only pick these when prediction edges are absent.
 */

import type { StrategyFn, StrategyResult, StrategyContext } from './types.js';

export const cryptoMomentumStrategy: StrategyFn = (market, ctx?: StrategyContext): StrategyResult | null => {
  if (market.category !== 'crypto' && market.exchange !== 'binance' && market.exchange !== 'coinbase') return null;
  if (!market.price || market.price <= 0 || !market.volume) return null;

  const notional = market.price * market.volume;
  if (notional < 1_000_000) return null;

  // Score in [0,100] based on log-scale notional (10M ~ 50, 1B ~ 100).
  const score = Math.min(100, Math.round(Math.log10(notional) * 12 - 30));
  if (score < 40) return null;

  const maxUsd = ctx?.maxPositionUsd ?? 200;
  const qty = maxUsd / market.price;

  return {
    score,
    side: 'buy',
    entryPrice: market.price,
    suggestedSizeUsd: qty * market.price,
    reasons: [
      `${market.symbol} notional 24h $${notional.toLocaleString()}`,
      `high-liquidity leader on ${market.exchange}`,
    ],
  };
};
