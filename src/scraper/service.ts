/**
 * ScraperService — orchestrates all scrapers with timed polling loops,
 * maintains an in-memory cache, and emits events for the gateway to broadcast.
 */

import { EventEmitter } from 'events';
import { setFirecrawlKey } from './fetcher.js';
import { scrapeAllPrices } from './prices.js';
import { scrapeAllNews } from './news.js';
import { scrapeAllExchanges } from './exchanges.js';
import type { ScraperConfig, ScraperCache, ScrapedPrice, ScrapedNews, ScrapedExchangeEvent } from './types.js';

const DEFAULT_WATCHLIST = [
  'SPY', 'QQQ', 'AAPL', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'TSLA',
  'BTC', 'ETH', 'SOL',
  'GOLD', 'OIL',
];

export class ScraperService extends EventEmitter {
  private cache: ScraperCache = {
    prices: new Map(),
    news: [],
    events: [],
    lastPriceUpdate: 0,
    lastNewsUpdate: 0,
    lastEventUpdate: 0,
  };

  private priceTimer: ReturnType<typeof setInterval> | null = null;
  private newsTimer: ReturnType<typeof setInterval> | null = null;
  private exchangeTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private config: Required<ScraperConfig>;

  constructor(config: ScraperConfig = {}) {
    super();
    this.config = {
      firecrawlApiKey: config.firecrawlApiKey || process.env.FIRECRAWL_API_KEY || '',
      priceIntervalMs: config.priceIntervalMs ?? 30_000,
      newsIntervalMs: config.newsIntervalMs ?? 60_000,
      exchangeIntervalMs: config.exchangeIntervalMs ?? 45_000,
      watchlist: config.watchlist ?? DEFAULT_WATCHLIST,
      newsSources: config.newsSources ?? [],
    };

    if (this.config.firecrawlApiKey) {
      setFirecrawlKey(this.config.firecrawlApiKey);
    }
  }

  /** Start all polling loops */
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    console.log('[Scraper] Starting real-time data feeds...');

    // Initial fetch (all in parallel)
    await Promise.allSettled([
      this.refreshPrices(),
      this.refreshNews(),
      this.refreshExchanges(),
    ]);

    // Set up polling loops
    this.priceTimer = setInterval(() => this.refreshPrices(), this.config.priceIntervalMs);
    this.newsTimer = setInterval(() => this.refreshNews(), this.config.newsIntervalMs);
    this.exchangeTimer = setInterval(() => this.refreshExchanges(), this.config.exchangeIntervalMs);

    console.log(`[Scraper] Live — prices every ${this.config.priceIntervalMs / 1000}s, news every ${this.config.newsIntervalMs / 1000}s, exchanges every ${this.config.exchangeIntervalMs / 1000}s`);
  }

  /** Stop all polling loops */
  stop(): void {
    this.running = false;
    if (this.priceTimer) { clearInterval(this.priceTimer); this.priceTimer = null; }
    if (this.newsTimer) { clearInterval(this.newsTimer); this.newsTimer = null; }
    if (this.exchangeTimer) { clearInterval(this.exchangeTimer); this.exchangeTimer = null; }
    console.log('[Scraper] Stopped.');
  }

  /** Refresh market prices */
  private async refreshPrices(): Promise<void> {
    try {
      const prices = await scrapeAllPrices(this.config.watchlist);
      for (const p of prices) {
        this.cache.prices.set(p.symbol, p);
      }
      this.cache.lastPriceUpdate = Date.now();
      this.emit('prices', prices);
    } catch (err) {
      console.error('[Scraper] Price refresh error:', err instanceof Error ? err.message : err);
    }
  }

  /** Refresh news */
  private async refreshNews(): Promise<void> {
    try {
      const news = await scrapeAllNews();
      if (news.length > 0) {
        this.cache.news = news;
        this.cache.lastNewsUpdate = Date.now();
        this.emit('news', news);
      }
    } catch (err) {
      console.error('[Scraper] News refresh error:', err instanceof Error ? err.message : err);
    }
  }

  /** Refresh exchange data */
  private async refreshExchanges(): Promise<void> {
    try {
      const events = await scrapeAllExchanges();
      if (events.length > 0) {
        this.cache.events = events;
        this.cache.lastEventUpdate = Date.now();
        this.emit('exchanges', events);
      }
    } catch (err) {
      console.error('[Scraper] Exchange refresh error:', err instanceof Error ? err.message : err);
    }
  }

  // ── Public getters ─────────────────────────────────────────────────

  /** Get cached price for a symbol */
  getPrice(symbol: string): ScrapedPrice | undefined {
    return this.cache.prices.get(symbol);
  }

  /** Get all cached prices */
  getAllPrices(): ScrapedPrice[] {
    return Array.from(this.cache.prices.values());
  }

  /** Get cached news (newest first) */
  getNews(limit = 50): ScrapedNews[] {
    return this.cache.news.slice(0, limit);
  }

  /** Get cached exchange events */
  getExchangeEvents(exchange?: string): ScrapedExchangeEvent[] {
    if (exchange) return this.cache.events.filter((e) => e.exchange === exchange);
    return this.cache.events;
  }

  /** Get full cache snapshot (for dashboard hydration) */
  getSnapshot(): {
    prices: ScrapedPrice[];
    news: ScrapedNews[];
    events: ScrapedExchangeEvent[];
    lastPriceUpdate: number;
    lastNewsUpdate: number;
    lastEventUpdate: number;
  } {
    return {
      prices: this.getAllPrices(),
      news: this.cache.news,
      events: this.cache.events,
      lastPriceUpdate: this.cache.lastPriceUpdate,
      lastNewsUpdate: this.cache.lastNewsUpdate,
      lastEventUpdate: this.cache.lastEventUpdate,
    };
  }

  /** Per-exchange health report for the dashboard Scraper Health panel (US-010 / FR-4). */
  getExchangeHealth(): Array<{
    exchange: string;
    count: number;
    validPricePct: number;
    lastUpdate: number;
    ageSec: number;
    status: 'green' | 'yellow' | 'red';
  }> {
    const knownExchanges = ['polymarket', 'kalshi', 'binance', 'coinbase', 'predictit', 'manifold'];
    const now = Date.now();
    const ageSec = Math.floor((now - this.cache.lastEventUpdate) / 1000);

    return knownExchanges.map((ex) => {
      const events = this.cache.events.filter((e) => e.exchange === ex);
      const valid = events.filter((e) => e.price > 0 && Number.isFinite(e.price));
      const pct = events.length ? (valid.length / events.length) * 100 : 0;
      let status: 'green' | 'yellow' | 'red' = 'green';
      if (!events.length) status = 'red';
      else if (ageSec > 120 || pct < 80) status = 'yellow';
      if (ageSec > 300 || pct < 50) status = 'red';
      return { exchange: ex, count: events.length, validPricePct: Math.round(pct), lastUpdate: this.cache.lastEventUpdate, ageSec, status };
    });
  }

  /** Get the current watchlist */
  getWatchlist(): string[] {
    return [...this.config.watchlist];
  }

  /** Update the watchlist and trigger immediate refresh */
  setWatchlist(symbols: string[]): void {
    this.config.watchlist = symbols;
    if (this.running) this.refreshPrices();
  }

  /** Force refresh all data now */
  async forceRefresh(): Promise<void> {
    await Promise.allSettled([
      this.refreshPrices(),
      this.refreshNews(),
      this.refreshExchanges(),
    ]);
  }

  isRunning(): boolean {
    return this.running;
  }
}

// Singleton
let _scraperService: ScraperService | null = null;

export function getScraperService(config?: ScraperConfig): ScraperService {
  if (!_scraperService) {
    _scraperService = new ScraperService(config);
  }
  return _scraperService;
}
