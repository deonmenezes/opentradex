/** Shared strategy types. Pure functions — no I/O so they are trivial to unit-test. */

import type { ScrapedExchangeEvent } from '../../scraper/types.js';

export type TradeSide = 'buy' | 'sell' | 'yes' | 'no';

export interface StrategyResult {
  score: number;            // 0-100, higher = stronger signal
  side: TradeSide;
  reasons: string[];
  entryPrice: number;
  suggestedSizeUsd: number;
}

export interface RankedCandidate extends StrategyResult {
  exchange: string;
  symbol: string;
  title: string;
  category?: string;
  url?: string;
  thesis?: string;          // Filled in later by LLM layer (US-012)
  strategy: string;         // Name of the strategy that produced this candidate
}

export type StrategyFn = (market: ScrapedExchangeEvent, context?: StrategyContext) => StrategyResult | null;

export interface StrategyContext {
  /** Other markets from the same scan cycle — lets prediction strategy cross-reference Manifold etc. */
  allMarkets?: ScrapedExchangeEvent[];
  /** Max USD per position (default $200 — well under the $2000 harness limit). */
  maxPositionUsd?: number;
}
