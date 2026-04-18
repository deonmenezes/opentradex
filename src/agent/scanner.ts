/**
 * Market Scanner - Monitors multiple exchanges for trading opportunities.
 *
 * Now powered by the ScraperService for LIVE market data instead of hardcoded prices.
 * Falls back to mock data only when the scraper hasn't fetched yet.
 */

import { EventEmitter } from 'events';
import { getScraperService } from '../scraper/service.js';
import type { ScrapedPrice } from '../scraper/types.js';

export interface ScanResult {
  id: string;
  symbol: string;
  exchange: string;
  signal: 'buy' | 'sell' | 'hold';
  confidence: number; // 0-1
  price: number;
  targetPrice?: number;
  stopLoss?: number;
  urgency: 'low' | 'medium' | 'high';
  reasoning: string;
  timestamp: Date;
  indicators: {
    rsi?: number;
    macd?: { value: number; signal: number; histogram: number };
    volume?: number;
    volatility?: number;
    trend?: 'bullish' | 'bearish' | 'neutral';
  };
}

interface MarketData {
  symbol: string;
  exchange: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
}

export class MarketScanner extends EventEmitter {
  private watchlist: string[] = [];
  private exchanges: string[] = ['stocks', 'crypto', 'commodities'];
  private lastPrices: Map<string, number> = new Map();
  private priceHistory: Map<string, number[]> = new Map();

  constructor() {
    super();
    this.loadDefaultWatchlist();
  }

  private loadDefaultWatchlist(): void {
    // Pull watchlist from the scraper service (dynamic, user-configurable)
    const scraper = getScraperService();
    this.watchlist = scraper.getWatchlist();
  }

  async scan(): Promise<ScanResult[]> {
    const results: ScanResult[] = [];

    for (const symbol of this.watchlist) {
      try {
        const data = await this.fetchMarketData(symbol);
        const analysis = this.analyzeMarket(data);

        if (analysis.signal !== 'hold' && analysis.confidence >= 0.6) {
          results.push(analysis);
          this.emit('opportunity', analysis);
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        this.emit('error', new Error(`Failed to scan ${symbol}: ${reason}`));
      }
    }

    return results.sort((a, b) => b.confidence - a.confidence);
  }

  private async fetchMarketData(symbol: string): Promise<MarketData> {
    // Try live data from the scraper service first
    const scraper = getScraperService();
    const livePrice = scraper.getPrice(symbol);

    if (livePrice) {
      // Track price history for better RSI calculation
      this.trackPrice(symbol, livePrice.price);

      return {
        symbol,
        exchange: livePrice.exchange,
        price: livePrice.price,
        change24h: livePrice.changePercent24h,
        volume24h: livePrice.volume24h,
        high24h: livePrice.high24h,
        low24h: livePrice.low24h,
      };
    }

    // Check exchange events (Polymarket, Kalshi)
    const events = scraper.getExchangeEvents();
    const event = events.find((e) => e.symbol.toLowerCase() === symbol.toLowerCase());
    if (event) {
      return {
        symbol,
        exchange: event.exchange,
        price: event.price,
        change24h: 0,
        volume24h: event.volume,
        high24h: event.price * 1.02,
        low24h: event.price * 0.98,
      };
    }

    // Fallback: simulate with last known price or conservative estimate
    const exchange = this.getExchange(symbol);
    const lastPrice = this.lastPrices.get(symbol) || 100;
    const change = (Math.random() - 0.48) * 0.05;
    const newPrice = lastPrice * (1 + change);
    this.lastPrices.set(symbol, newPrice);

    return {
      symbol,
      exchange,
      price: newPrice,
      change24h: (Math.random() - 0.5) * 10,
      volume24h: Math.random() * 1000000000,
      high24h: newPrice * (1 + Math.random() * 0.03),
      low24h: newPrice * (1 - Math.random() * 0.03),
    };
  }

  /** Track price history for RSI/trend calculations */
  private trackPrice(symbol: string, price: number): void {
    const history = this.priceHistory.get(symbol) || [];
    history.push(price);
    // Keep last 50 data points
    if (history.length > 50) history.shift();
    this.priceHistory.set(symbol, history);
    this.lastPrices.set(symbol, price);
  }

  /** Calculate RSI from price history (14-period) */
  private calculateRSI(symbol: string): number | null {
    const history = this.priceHistory.get(symbol);
    if (!history || history.length < 15) return null;

    const period = 14;
    const recent = history.slice(-period - 1);
    let gains = 0;
    let losses = 0;

    for (let i = 1; i < recent.length; i++) {
      const change = recent[i] - recent[i - 1];
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private getExchange(symbol: string): string {
    if (['BTC', 'ETH', 'SOL', 'DOGE', 'XRP', 'ADA', 'AVAX', 'LINK', 'DOT', 'MATIC'].includes(symbol)) return 'crypto';
    if (['GOLD', 'OIL', 'SILVER'].includes(symbol)) return 'commodities';
    return 'stocks';
  }

  private analyzeMarket(data: MarketData): ScanResult {
    // Use real RSI if we have history, otherwise estimate from change
    const calculatedRSI = this.calculateRSI(data.symbol);
    const rsi = calculatedRSI ?? (50 + data.change24h * 2); // Estimate from 24h change
    const clampedRSI = Math.max(0, Math.min(100, rsi));

    const trend = data.change24h > 2 ? 'bullish' : data.change24h < -2 ? 'bearish' : 'neutral';
    const volatility = Math.abs(data.high24h - data.low24h) / data.price;

    // Generate signal based on indicators
    let signal: 'buy' | 'sell' | 'hold' = 'hold';
    let confidence = 0.5;
    let reasoning = '';

    if (clampedRSI < 35 && trend !== 'bearish') {
      signal = 'buy';
      confidence = 0.6 + (35 - clampedRSI) / 100;
      reasoning = `RSI oversold at ${clampedRSI.toFixed(1)}, potential reversal`;
    } else if (clampedRSI > 65 && trend !== 'bullish') {
      signal = 'sell';
      confidence = 0.6 + (clampedRSI - 65) / 100;
      reasoning = `RSI overbought at ${clampedRSI.toFixed(1)}, potential pullback`;
    } else if (trend === 'bullish' && data.change24h > 3) {
      signal = 'buy';
      confidence = 0.55 + data.change24h / 100;
      reasoning = `Strong bullish momentum: +${data.change24h.toFixed(2)}%`;
    } else if (trend === 'bearish' && data.change24h < -3) {
      signal = 'sell';
      confidence = 0.55 + Math.abs(data.change24h) / 100;
      reasoning = `Strong bearish momentum: ${data.change24h.toFixed(2)}%`;
    } else {
      reasoning = 'No clear signal, holding';
    }

    // High volume + signal = higher confidence
    if (data.volume24h > 1_000_000_000 && signal !== 'hold') {
      confidence += 0.05;
      reasoning += ' (high volume confirms)';
    }

    // Determine urgency
    let urgency: 'low' | 'medium' | 'high' = 'low';
    if (confidence > 0.8 || volatility > 0.05) urgency = 'high';
    else if (confidence > 0.65) urgency = 'medium';

    // Dynamic target/stop based on volatility
    const targetPct = Math.max(0.02, volatility * 1.5);
    const stopPct = Math.max(0.01, volatility * 0.75);

    return {
      id: `${data.symbol}-${Date.now()}`,
      symbol: data.symbol,
      exchange: data.exchange,
      signal,
      confidence: Math.min(confidence, 0.95),
      price: data.price,
      targetPrice: signal === 'buy' ? data.price * (1 + targetPct) : signal === 'sell' ? data.price * (1 - targetPct) : undefined,
      stopLoss: signal === 'buy' ? data.price * (1 - stopPct) : signal === 'sell' ? data.price * (1 + stopPct) : undefined,
      urgency,
      reasoning,
      timestamp: new Date(),
      indicators: {
        rsi: clampedRSI,
        volume: data.volume24h,
        volatility,
        trend,
      },
    };
  }

  // Public API

  setWatchlist(symbols: string[]): void {
    this.watchlist = symbols;
    // Also sync to scraper service
    getScraperService().setWatchlist(symbols);
  }

  addToWatchlist(symbol: string): void {
    if (!this.watchlist.includes(symbol)) {
      this.watchlist.push(symbol);
    }
  }

  removeFromWatchlist(symbol: string): void {
    this.watchlist = this.watchlist.filter((s) => s !== symbol);
  }

  getWatchlist(): string[] {
    return [...this.watchlist];
  }

  async getQuote(symbol: string): Promise<MarketData> {
    return this.fetchMarketData(symbol);
  }
}
