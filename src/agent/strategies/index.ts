/**
 * Signal aggregator — run every strategy against every market, rank by score.
 * Consumers (scanner + auto-loop) pull the top-N candidates from here.
 */

import type { ScrapedExchangeEvent } from '../../scraper/types.js';
import type { RankedCandidate, StrategyContext, StrategyFn } from './types.js';
import { predictionStrategy } from './prediction.js';
import { cryptoMomentumStrategy } from './crypto-momentum.js';

interface NamedStrategy {
  name: string;
  fn: StrategyFn;
}

const STRATEGIES: NamedStrategy[] = [
  { name: 'prediction-edge', fn: predictionStrategy },
  { name: 'crypto-momentum', fn: cryptoMomentumStrategy },
];

export function aggregateSignals(
  markets: ScrapedExchangeEvent[],
  options: { topN?: number; maxPositionUsd?: number } = {}
): RankedCandidate[] {
  const { topN = 10, maxPositionUsd = 200 } = options;
  const ctx: StrategyContext = { allMarkets: markets, maxPositionUsd };

  const ranked: RankedCandidate[] = [];
  for (const m of markets) {
    for (const s of STRATEGIES) {
      const r = s.fn(m, ctx);
      if (!r) continue;
      ranked.push({
        ...r,
        exchange: m.exchange,
        symbol: m.symbol,
        title: m.title,
        category: m.category,
        url: m.url,
        strategy: s.name,
      });
    }
  }

  return ranked.sort((a, b) => b.score - a.score).slice(0, topN);
}

export { predictionStrategy, cryptoMomentumStrategy };
export type { RankedCandidate, StrategyResult, StrategyFn, StrategyContext } from './types.js';
