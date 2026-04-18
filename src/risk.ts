/** Risk engine for OpenTradex - hard-coded caps that never ask the LLM */

import { loadConfig, writeAuditLog, type RiskProfile } from './config.js';
import type { Position, Trade } from './types.js';

export interface RiskCheckResult {
  allowed: boolean;
  reason?: string;
  warnings: string[];
}

export interface RiskState {
  dailyPnL: number;
  dailyTrades: number;
  dailyWins: number;
  openPositions: Position[];
  lastReset: string; // ISO date
  startingCapital: number;
}

const DEFAULT_STARTING_CAPITAL = 200000;

/** Read starting capital from config (falls back to default) */
function configStartingCapital(): number {
  const config = loadConfig();
  const v = config?.risk?.startingCapital;
  return Number.isFinite(v) && (v as number) > 0 ? (v as number) : DEFAULT_STARTING_CAPITAL;
}

// In-memory risk state (would be persisted in production)
let riskState: RiskState = {
  dailyPnL: 0,
  dailyTrades: 0,
  dailyWins: 0,
  openPositions: [],
  lastReset: new Date().toISOString().split('T')[0],
  startingCapital: configStartingCapital(),
};

/** Current equity = starting capital + realized day P&L + unrealized P&L on open positions */
export function getEquity(): number {
  const unrealized = riskState.openPositions.reduce((sum, p) => sum + (p.pnl ?? 0), 0);
  const base = configStartingCapital();
  riskState.startingCapital = base;
  return base + riskState.dailyPnL + unrealized;
}

/** Set the starting capital (one-time on first run / onboarding) */
export function setStartingCapital(usd: number): void {
  if (Number.isFinite(usd) && usd > 0) {
    riskState.startingCapital = usd;
  }
}

/** Get current risk profile from config */
function getRiskProfile(): RiskProfile {
  const config = loadConfig();
  return config?.risk ?? {
    maxPositionUsd: 100,
    maxDailyLossUsd: 50,
    maxOpenPositions: 3,
    perTradePercent: 5,
    dailyDDKill: 10,
  };
}

/** Reset daily counters if new day */
function checkDayReset(): void {
  const today = new Date().toISOString().split('T')[0];
  if (riskState.lastReset !== today) {
    riskState = {
      dailyPnL: 0,
      dailyTrades: 0,
      dailyWins: 0,
      openPositions: riskState.openPositions, // Keep positions
      lastReset: today,
      startingCapital: riskState.startingCapital,
    };
  }
}

/** Check if a trade is allowed by risk rules */
export function checkRisk(trade: Partial<Trade>): RiskCheckResult {
  checkDayReset();
  const profile = getRiskProfile();
  const warnings: string[] = [];

  const size = trade.size ?? 0;
  const price = trade.price ?? 0;
  const positionValue = size * price;

  // Check 1: Position size cap
  if (positionValue > profile.maxPositionUsd) {
    return {
      allowed: false,
      reason: `Position value $${positionValue.toFixed(2)} exceeds max $${profile.maxPositionUsd}`,
      warnings,
    };
  }

  // Check 2: Max open positions
  if (riskState.openPositions.length >= profile.maxOpenPositions) {
    return {
      allowed: false,
      reason: `Already at max open positions (${profile.maxOpenPositions})`,
      warnings,
    };
  }

  // Check 3: Daily loss limit
  if (Math.abs(riskState.dailyPnL) >= profile.maxDailyLossUsd && riskState.dailyPnL < 0) {
    return {
      allowed: false,
      reason: `Daily loss limit reached ($${Math.abs(riskState.dailyPnL).toFixed(2)} / $${profile.maxDailyLossUsd})`,
      warnings,
    };
  }

  // Check 4: Daily drawdown kill switch
  const ddPercent = (Math.abs(riskState.dailyPnL) / profile.maxDailyLossUsd) * 100;
  if (ddPercent >= profile.dailyDDKill && riskState.dailyPnL < 0) {
    return {
      allowed: false,
      reason: `Daily drawdown kill switch triggered (${ddPercent.toFixed(1)}%)`,
      warnings,
    };
  }

  // Warnings (allowed but flagged)
  if (positionValue > profile.maxPositionUsd * 0.8) {
    warnings.push(`Position size near limit (${((positionValue / profile.maxPositionUsd) * 100).toFixed(0)}%)`);
  }

  if (riskState.openPositions.length >= profile.maxOpenPositions - 1) {
    warnings.push(`Near max open positions (${riskState.openPositions.length + 1}/${profile.maxOpenPositions})`);
  }

  return { allowed: true, warnings };
}

/** Record a new position */
export function recordPosition(position: Position): void {
  checkDayReset();
  riskState.openPositions.push(position);
  writeAuditLog({
    event: 'position_opened',
    position,
    openCount: riskState.openPositions.length,
  });
}

/** Close a position and update P&L */
export function closePosition(symbol: string, exchange: string, realizedPnL: number): void {
  checkDayReset();
  const idx = riskState.openPositions.findIndex(
    p => p.symbol === symbol && p.exchange === exchange
  );

  if (idx !== -1) {
    const position = riskState.openPositions[idx];
    riskState.openPositions.splice(idx, 1);
    riskState.dailyPnL += realizedPnL;
    riskState.dailyTrades++;
    if (realizedPnL > 0) riskState.dailyWins++;

    writeAuditLog({
      event: 'position_closed',
      position,
      realizedPnL,
      dailyPnL: riskState.dailyPnL,
    });
  }
}

/** Get current risk state */
export function getRiskState(): RiskState {
  checkDayReset();
  riskState.startingCapital = configStartingCapital();
  return { ...riskState };
}

/** Get current open positions */
export function getOpenPositions(): Position[] {
  return [...riskState.openPositions];
}

/** Update position prices (for P&L tracking) */
export function updatePositionPrices(updates: Map<string, number>): void {
  for (const pos of riskState.openPositions) {
    const key = `${pos.exchange}:${pos.symbol}`;
    const newPrice = updates.get(key);
    if (newPrice !== undefined) {
      pos.currentPrice = newPrice;
      pos.pnl = (newPrice - pos.avgPrice) * pos.size * (pos.side === 'long' || pos.side === 'yes' ? 1 : -1);
      pos.pnlPercent = (pos.pnl / (pos.avgPrice * pos.size)) * 100;
    }
  }
}

/** Emergency flatten all positions */
export function panicFlatten(): { flattened: Position[]; totalPnL: number } {
  const flattened = [...riskState.openPositions];
  let totalPnL = 0;

  for (const pos of flattened) {
    totalPnL += pos.pnl;
  }

  riskState.openPositions = [];
  riskState.dailyPnL += totalPnL;

  writeAuditLog({
    event: 'panic_flatten',
    flattened,
    totalPnL,
  });

  return { flattened, totalPnL };
}

/** Check if trading is halted due to risk */
export function isTradingHalted(): { halted: boolean; reason?: string } {
  checkDayReset();
  const profile = getRiskProfile();

  if (riskState.dailyPnL <= -profile.maxDailyLossUsd) {
    return { halted: true, reason: 'Daily loss limit reached' };
  }

  const ddPercent = (Math.abs(riskState.dailyPnL) / profile.maxDailyLossUsd) * 100;
  if (ddPercent >= profile.dailyDDKill && riskState.dailyPnL < 0) {
    return { halted: true, reason: 'Daily drawdown kill switch' };
  }

  return { halted: false };
}

/** Calculate Kelly position size */
export function kellySize(
  winProbability: number,
  winAmount: number,
  lossAmount: number,
  bankroll: number,
  fraction = 0.25 // Use quarter-Kelly for safety
): number {
  if (winProbability <= 0 || winProbability >= 1) return 0;
  if (winAmount <= 0 || lossAmount <= 0) return 0;

  const b = winAmount / lossAmount;
  const p = winProbability;
  const q = 1 - p;

  const kelly = (b * p - q) / b;
  if (kelly <= 0) return 0;

  const profile = getRiskProfile();
  const maxByPercent = bankroll * (profile.perTradePercent / 100);
  const kellyAmount = bankroll * kelly * fraction;

  return Math.min(kellyAmount, maxByPercent, profile.maxPositionUsd);
}
