/**
 * Trade Executor - Executes trades via connected brokers
 */

import { EventEmitter } from 'events';
import { ScanResult } from './scanner.js';
import { recordPosition, closePosition as closeRiskPosition, getOpenPositions as getRiskPositions } from '../risk.js';
import type { Exchange, Side } from '../types.js';

function mapExchange(raw: string): Exchange {
  const s = raw.toLowerCase();
  if (s === 'kalshi') return 'kalshi';
  if (s === 'polymarket') return 'polymarket';
  if (s === 'alpaca') return 'alpaca';
  if (s === 'crypto') return 'crypto';
  // stocks, commodities, tradingview → tradingview
  return 'tradingview';
}

export interface TradeResult {
  success: boolean;
  orderId?: string;
  symbol: string;
  exchange?: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  pnl?: number;
  error?: string;
  timestamp: Date;
  mode: string;
}

interface Order {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  type: 'market' | 'limit';
  price?: number;
  exchange?: string;
  status: 'pending' | 'filled' | 'cancelled' | 'rejected';
  filledPrice?: number;
  filledAt?: Date;
}

interface Position {
  symbol: string;
  quantity: number;
  avgPrice: number;
  side: 'long' | 'short';
  unrealizedPnL: number;
}

export class TradeExecutor extends EventEmitter {
  private mode: 'paper-only' | 'paper-default' | 'live-allowed';
  private orders: Map<string, Order> = new Map();
  private positions: Map<string, Position> = new Map();
  private orderIdCounter = 0;

  constructor(mode: 'paper-only' | 'paper-default' | 'live-allowed' = 'paper-only') {
    super();
    this.mode = mode;
  }

  async execute(opportunity: ScanResult): Promise<TradeResult> {
    const side = opportunity.signal === 'buy' ? 'buy' : 'sell';
    const quantity = this.calculateQuantity(opportunity);

    return this.executeDirect({
      symbol: opportunity.symbol,
      side,
      quantity,
      type: 'market',
      price: opportunity.price,
      exchange: opportunity.exchange,
    });
  }

  async executeDirect(params: {
    symbol: string;
    side: 'buy' | 'sell';
    quantity: number;
    type?: 'market' | 'limit';
    price?: number;
    exchange?: string;
  }): Promise<TradeResult> {
    const orderId = `ORD-${++this.orderIdCounter}-${Date.now()}`;

    // Create order
    const order: Order = {
      id: orderId,
      symbol: params.symbol,
      side: params.side,
      quantity: params.quantity,
      type: params.type || 'market',
      price: params.price,
      exchange: params.exchange,
      status: 'pending',
    };

    this.orders.set(orderId, order);
    this.emit('order-created', order);

    try {
      // Execute based on mode
      if (this.mode === 'paper-only' || this.mode === 'paper-default') {
        return await this.executePaper(order);
      } else {
        return await this.executeLive(order);
      }
    } catch (error) {
      order.status = 'rejected';
      return {
        success: false,
        orderId,
        symbol: params.symbol,
        side: params.side,
        quantity: params.quantity,
        price: params.price || 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        mode: this.mode,
      };
    }
  }

  private async executePaper(order: Order): Promise<TradeResult> {
    // Simulate market execution with slight slippage
    await this.simulateLatency();

    const slippage = (Math.random() - 0.5) * 0.001; // 0.1% max slippage
    const filledPrice = (order.price || 100) * (1 + slippage);

    order.status = 'filled';
    order.filledPrice = filledPrice;
    order.filledAt = new Date();

    // Update positions (local + shared harness ledger)
    this.updatePosition(order.symbol, order.side, order.quantity, filledPrice);
    this.syncToHarness(order, filledPrice);

    const result: TradeResult = {
      success: true,
      orderId: order.id,
      symbol: order.symbol,
      exchange: mapExchange(order.exchange || 'tradingview'),
      side: order.side,
      quantity: order.quantity,
      price: filledPrice,
      timestamp: new Date(),
      mode: this.mode,
    };

    this.emit('trade', result);
    return result;
  }

  private async executeLive(order: Order): Promise<TradeResult> {
    // In production, this would connect to real broker APIs
    // For now, fall back to paper trading
    console.warn('Live trading not implemented, using paper mode');
    return this.executePaper(order);
  }

  private updatePosition(
    symbol: string,
    side: 'buy' | 'sell',
    quantity: number,
    price: number
  ): void {
    const existing = this.positions.get(symbol);

    if (!existing) {
      // New position
      this.positions.set(symbol, {
        symbol,
        quantity,
        avgPrice: price,
        side: side === 'buy' ? 'long' : 'short',
        unrealizedPnL: 0,
      });
    } else if ((side === 'buy' && existing.side === 'long') ||
               (side === 'sell' && existing.side === 'short')) {
      // Adding to position
      const totalCost = existing.avgPrice * existing.quantity + price * quantity;
      const totalQuantity = existing.quantity + quantity;
      existing.avgPrice = totalCost / totalQuantity;
      existing.quantity = totalQuantity;
    } else {
      // Reducing or closing position
      if (quantity >= existing.quantity) {
        // Close position
        const pnl = existing.side === 'long'
          ? (price - existing.avgPrice) * existing.quantity
          : (existing.avgPrice - price) * existing.quantity;
        this.positions.delete(symbol);
        this.emit('position-closed', { symbol, pnl });
      } else {
        // Reduce position
        existing.quantity -= quantity;
      }
    }
  }

  private syncToHarness(order: Order, filledPrice: number): void {
    const exchange = mapExchange(order.exchange || 'tradingview');
    const harnessSide: Side = order.side === 'buy' ? 'long' : 'short';
    const existing = getRiskPositions().find((p) => p.symbol === order.symbol && p.exchange === exchange);

    if (!existing) {
      recordPosition({
        exchange,
        symbol: order.symbol,
        side: harnessSide,
        size: order.quantity,
        avgPrice: filledPrice,
        currentPrice: filledPrice,
        pnl: 0,
        pnlPercent: 0,
      });
      return;
    }

    // Opposite-side fill → close (or reduce) the existing harness position
    const isClosingFill =
      (existing.side === 'long' && order.side === 'sell') ||
      (existing.side === 'short' && order.side === 'buy');

    if (isClosingFill) {
      const pnl =
        existing.side === 'long'
          ? (filledPrice - existing.avgPrice) * existing.size
          : (existing.avgPrice - filledPrice) * existing.size;
      closeRiskPosition(order.symbol, exchange, pnl);
    }
    // Same-side adds are left as-is; the existing position's avgPrice update lives in local state.
  }

  private calculateQuantity(opportunity: ScanResult): number {
    // Default to 1 share/unit for simplicity
    // In production, this would use position sizing rules
    return 1;
  }

  private async simulateLatency(): Promise<void> {
    const latency = 50 + Math.random() * 150; // 50-200ms
    return new Promise((resolve) => setTimeout(resolve, latency));
  }

  // Public API

  async closeAllPositions(): Promise<TradeResult[]> {
    const results: TradeResult[] = [];

    for (const [symbol, position] of this.positions) {
      const result = await this.executeDirect({
        symbol,
        side: position.side === 'long' ? 'sell' : 'buy',
        quantity: position.quantity,
        type: 'market',
      });
      results.push(result);
    }

    return results;
  }

  async closePosition(symbol: string): Promise<TradeResult | null> {
    const position = this.positions.get(symbol);
    if (!position) return null;

    return this.executeDirect({
      symbol,
      side: position.side === 'long' ? 'sell' : 'buy',
      quantity: position.quantity,
      type: 'market',
    });
  }

  getOpenPositionCount(): number {
    return this.positions.size;
  }

  getPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  getOrders(): Order[] {
    return Array.from(this.orders.values());
  }

  setMode(mode: 'paper-only' | 'paper-default' | 'live-allowed'): void {
    this.mode = mode;
    this.emit('mode-changed', mode);
  }

  getMode(): string {
    return this.mode;
  }
}
