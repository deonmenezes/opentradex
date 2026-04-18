/**
 * Risk Manager - Evaluates and controls trading risk
 */

import { EventEmitter } from 'events';
import { ScanResult } from './scanner.js';
import { loadConfig } from '../config.js';

function initialEquity(): number {
  const cfg = loadConfig();
  const v = cfg?.risk?.startingCapital;
  return Number.isFinite(v) && (v as number) > 0 ? (v as number) : 200000;
}

export interface RiskLimits {
  maxPositionSize: number;
  maxDailyLoss: number;
  maxDrawdown: number;
  maxOpenPositions?: number;
  maxSingleTradeRisk?: number;
}

export interface RiskCheck {
  approved: boolean;
  reason?: string;
  adjustedSize?: number;
  riskScore: number;
}

interface Position {
  symbol: string;
  size: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
}

export class RiskManager extends EventEmitter {
  private limits: RiskLimits;
  private dailyPnL = 0;
  private peakEquity: number;
  private currentEquity: number;
  private positions: Map<string, Position> = new Map();

  constructor(limits: RiskLimits) {
    super();
    const eq = initialEquity();
    this.peakEquity = eq;
    this.currentEquity = eq;
    this.limits = {
      maxOpenPositions: 10,
      maxSingleTradeRisk: 0.05, // 5% of equity — paper sim needs room to place trades
      ...limits,
    };
  }

  evaluate(opportunity: ScanResult): boolean {
    const check = this.checkTrade({
      symbol: opportunity.symbol,
      side: opportunity.signal === 'buy' ? 'buy' : 'sell',
      quantity: this.calculatePositionSize(opportunity),
      price: opportunity.price,
    });

    if (!check.approved) {
      this.emit('trade-rejected', { opportunity, reason: check.reason });
    }

    return check.approved;
  }

  checkTrade(params: {
    symbol: string;
    side: 'buy' | 'sell';
    quantity: number;
    price?: number;
  }): RiskCheck {
    const tradeValue = params.quantity * (params.price || 0);

    // Check daily loss limit
    if (this.dailyPnL <= -this.limits.maxDailyLoss) {
      this.emit('limit-breach', { type: 'daily-loss', severity: 'critical', value: this.dailyPnL });
      return {
        approved: false,
        reason: `Daily loss limit reached: $${Math.abs(this.dailyPnL).toFixed(2)}`,
        riskScore: 1.0,
      };
    }

    // Check drawdown limit
    const drawdown = (this.peakEquity - this.currentEquity) / this.peakEquity;
    if (drawdown >= this.limits.maxDrawdown) {
      this.emit('limit-breach', { type: 'drawdown', severity: 'critical', value: drawdown });
      return {
        approved: false,
        reason: `Max drawdown reached: ${(drawdown * 100).toFixed(1)}%`,
        riskScore: 1.0,
      };
    }

    // Check position size limit
    if (tradeValue > this.limits.maxPositionSize) {
      const adjustedQuantity = Math.floor(this.limits.maxPositionSize / (params.price || 1));
      return {
        approved: true,
        reason: 'Position size reduced to meet limits',
        adjustedSize: adjustedQuantity,
        riskScore: 0.7,
      };
    }

    // Check max open positions
    if (this.positions.size >= (this.limits.maxOpenPositions || 10)) {
      return {
        approved: false,
        reason: `Maximum open positions reached: ${this.positions.size}`,
        riskScore: 0.8,
      };
    }

    // Check single trade risk
    const tradeRisk = tradeValue / this.currentEquity;
    if (tradeRisk > (this.limits.maxSingleTradeRisk || 0.02)) {
      this.emit('limit-breach', { type: 'single-trade-risk', severity: 'warning', value: tradeRisk });
      return {
        approved: false,
        reason: `Trade risk too high: ${(tradeRisk * 100).toFixed(1)}% of equity`,
        riskScore: 0.9,
      };
    }

    // Calculate risk score
    const riskScore = this.calculateRiskScore(params);

    return {
      approved: riskScore < 0.8,
      riskScore,
    };
  }

  private calculateRiskScore(params: { symbol: string; side: 'buy' | 'sell'; quantity: number; price?: number }): number {
    let score = 0;

    // Factor 1: Position concentration
    const existingPosition = this.positions.get(params.symbol);
    if (existingPosition) {
      score += 0.2; // Adding to existing position increases risk
    }

    // Factor 2: Daily P&L status
    if (this.dailyPnL < 0) {
      score += Math.min(Math.abs(this.dailyPnL) / this.limits.maxDailyLoss, 0.3);
    }

    // Factor 3: Drawdown status
    const drawdown = (this.peakEquity - this.currentEquity) / this.peakEquity;
    score += drawdown * 2;

    // Factor 4: Number of open positions
    score += (this.positions.size / (this.limits.maxOpenPositions || 10)) * 0.2;

    return Math.min(score, 1.0);
  }

  private calculatePositionSize(opportunity: ScanResult): number {
    // Risk-adjusted position sizing
    const maxRiskAmount = this.currentEquity * (this.limits.maxSingleTradeRisk || 0.02);
    const stopLossDistance = opportunity.stopLoss
      ? Math.abs(opportunity.price - opportunity.stopLoss)
      : opportunity.price * 0.02;

    const positionSize = maxRiskAmount / stopLossDistance;
    const maxShares = Math.floor(this.limits.maxPositionSize / opportunity.price);

    return Math.min(positionSize, maxShares);
  }

  // Position tracking

  addPosition(position: Position): void {
    this.positions.set(position.symbol, position);
  }

  updatePosition(symbol: string, currentPrice: number): void {
    const position = this.positions.get(symbol);
    if (position) {
      position.currentPrice = currentPrice;
      position.pnl = (currentPrice - position.entryPrice) * position.size;
    }
  }

  closePosition(symbol: string, exitPrice: number): number {
    const position = this.positions.get(symbol);
    if (!position) return 0;

    const pnl = (exitPrice - position.entryPrice) * position.size;
    this.dailyPnL += pnl;
    this.currentEquity += pnl;

    if (this.currentEquity > this.peakEquity) {
      this.peakEquity = this.currentEquity;
    }

    this.positions.delete(symbol);
    return pnl;
  }

  // Public API

  updateLimits(limits: Partial<RiskLimits>): void {
    this.limits = { ...this.limits, ...limits };
    this.emit('limits-updated', this.limits);
  }

  getLimits(): RiskLimits {
    return { ...this.limits };
  }

  getStatus(): {
    dailyPnL: number;
    drawdown: number;
    openPositions: number;
    equity: number;
  } {
    return {
      dailyPnL: this.dailyPnL,
      drawdown: (this.peakEquity - this.currentEquity) / this.peakEquity,
      openPositions: this.positions.size,
      equity: this.currentEquity,
    };
  }

  resetDaily(): void {
    this.dailyPnL = 0;
    this.emit('daily-reset');
  }

  setEquity(equity: number): void {
    this.currentEquity = equity;
    this.peakEquity = Math.max(this.peakEquity, equity);
  }
}
