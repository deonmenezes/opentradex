/**
 * Prediction-market edge detection.
 *
 * Core idea: same question often trades on multiple venues (Kalshi, Polymarket,
 * PredictIt, Manifold). If one venue prices it >10pp away from the crowd
 * consensus, that's a candidate edge. We use token overlap on market title as
 * the match heuristic because tickers aren't shared across venues.
 */

import type { ScrapedExchangeEvent } from '../../scraper/types.js';
import type { StrategyFn, StrategyResult, StrategyContext } from './types.js';

const STOP = new Set(['the', 'a', 'an', 'will', 'be', 'is', 'are', 'to', 'of', 'in', 'on', 'by', 'before', 'after', 'for', 'and', 'or', 'next', 'any']);
const VENUE_WEIGHT: Record<string, number> = {
  kalshi: 1.0,
  polymarket: 1.0,
  predictit: 0.9,
  manifold: 0.3,
};

function tokens(title: string): Set<string> {
  return new Set(
    title.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOP.has(w))
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Find consensus probability across other venues for markets similar to `target`. */
function consensus(target: ScrapedExchangeEvent, pool: ScrapedExchangeEvent[]): { p: number; sources: string[] } | null {
  const targetTokens = tokens(target.title);
  if (targetTokens.size < 2) return null;

  let weightedSum = 0;
  let weightTotal = 0;
  const sources: string[] = [];
  for (const m of pool) {
    if (m.exchange === target.exchange) continue;
    if (typeof m.yesPrice !== 'number' || m.yesPrice <= 0 || m.yesPrice >= 1) continue;
    const sim = jaccard(targetTokens, tokens(m.title));
    if (sim < 0.35) continue;
    const w = (VENUE_WEIGHT[m.exchange] ?? 0.5) * sim;
    weightedSum += m.yesPrice * w;
    weightTotal += w;
    sources.push(`${m.exchange}@${(m.yesPrice * 100).toFixed(0)}¢`);
  }
  if (weightTotal === 0) return null;
  return { p: weightedSum / weightTotal, sources };
}

export const predictionStrategy: StrategyFn = (market, ctx?: StrategyContext): StrategyResult | null => {
  if (market.category !== 'prediction') return null;
  if (typeof market.yesPrice !== 'number' || market.yesPrice <= 0 || market.yesPrice >= 1) return null;

  const pool = ctx?.allMarkets ?? [];
  const c = consensus(market, pool);
  if (!c) return null;

  const diffPp = Math.abs(market.yesPrice - c.p) * 100;
  if (diffPp < 10) return null;

  const side = market.yesPrice < c.p ? 'yes' : 'no';
  const entryPrice = side === 'yes' ? market.yesPrice : (market.noPrice ?? 1 - market.yesPrice);
  const score = Math.min(100, Math.round(diffPp * 4));

  const maxUsd = ctx?.maxPositionUsd ?? 200;
  const contracts = Math.floor(maxUsd / Math.max(entryPrice, 0.05));

  return {
    score,
    side,
    entryPrice,
    suggestedSizeUsd: contracts * entryPrice,
    reasons: [
      `${market.exchange} YES @ ${(market.yesPrice * 100).toFixed(0)}¢ vs consensus ${(c.p * 100).toFixed(0)}¢`,
      `edge ${diffPp.toFixed(0)}pp; sources: ${c.sources.join(', ')}`,
      `buy ${side.toUpperCase()} @ ${(entryPrice * 100).toFixed(0)}¢`,
    ],
  };
};
