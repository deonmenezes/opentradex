/** OpenTradex - Lightweight AI harness for multi-market trading */

export * from './types.js';
export * from './markets/index.js';

import type { Exchange, Market, MarketConnector, HarnessConfig } from './types.js';
import { createKalshiConnector } from './markets/kalshi.js';
import { createPolymarketConnector } from './markets/polymarket.js';
import { createTradingViewConnector } from './markets/tradingview.js';
import { createCryptoConnector } from './markets/crypto.js';

export class OpenTradex {
  private connectors: Map<Exchange, MarketConnector> = new Map();

  constructor(config: HarnessConfig = {}) {
    this.connectors.set('kalshi', createKalshiConnector(config.kalshi));
    this.connectors.set('polymarket', createPolymarketConnector(config.polymarket));
    this.connectors.set('tradingview', createTradingViewConnector());
    this.connectors.set('crypto', createCryptoConnector());
  }

  /** Get a specific market connector */
  exchange(name: Exchange): MarketConnector {
    const connector = this.connectors.get(name);
    if (!connector) throw new Error(`Unknown exchange: ${name}`);
    return connector;
  }

  /** Scan all markets across all exchanges */
  async scanAll(limit = 10): Promise<Market[]> {
    const results = await Promise.allSettled(
      Array.from(this.connectors.values()).map(c => c.scan(limit))
    );

    return results
      .filter((r): r is PromiseFulfilledResult<Market[]> => r.status === 'fulfilled')
      .flatMap(r => r.value);
  }

  /** Search across all exchanges */
  async searchAll(query: string): Promise<Market[]> {
    const results = await Promise.allSettled(
      Array.from(this.connectors.values()).map(c => c.search(query))
    );

    return results
      .filter((r): r is PromiseFulfilledResult<Market[]> => r.status === 'fulfilled')
      .flatMap(r => r.value);
  }

  /** List available exchanges */
  get exchanges(): Exchange[] {
    return Array.from(this.connectors.keys());
  }
}

/** Create a new OpenTradex instance */
export function createHarness(config?: HarnessConfig): OpenTradex {
  return new OpenTradex(config);
}
