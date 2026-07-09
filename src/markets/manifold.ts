/**
 * Manifold Markets connector for OpenTradex
 * Maps the Manifold v0 API to the standard MarketConnector interface.
 */

import { httpGet } from './base.js';
import type { Market, Quote, MarketConnector, Exchange } from '../types.js';

const MANIFOLD_API_BASE = 'https://api.manifold.markets/v0';

// Helper function to map Manifold's raw API response to the OpenTradex Market interface
function mapManifoldMarket(rawMarket: any): Market {
    return {
        id: rawMarket.id,
        exchange: 'manifold' as Exchange, // Cast as Exchange until 'manifold' is manually added to types.ts
        symbol: rawMarket.id, // Manifold uses unique IDs rather than traditional tickers
        title: rawMarket.question,
        price: rawMarket.probability || 0, // Fallback to 0 if probability is missing
        volume: rawMarket.volume,
        endDate: rawMarket.closeTime ? new Date(rawMarket.closeTime).toISOString() : undefined,
        url: rawMarket.url,
        meta: {
            slug: rawMarket.slug,
            outcomeType: rawMarket.outcomeType,
            isResolved: rawMarket.isResolved,
            resolution: rawMarket.resolution,
        }
    };
}

export function createManifoldConnector(): MarketConnector {
    return {
        name: 'manifold' as Exchange,

        async scan(limit: number = 20): Promise<Market[]> {
            // Endpoint: GET /v0/markets
            const data = await httpGet<any[]>(`${MANIFOLD_API_BASE}/markets?limit=${limit}`);

            return data
                // We filter for 'BINARY' markets (Yes/No) because they map perfectly to a single 'probability' price
                .filter(m => m.outcomeType === 'BINARY')
                .map(mapManifoldMarket);
        },

        async search(query: string): Promise<Market[]> {
            // Endpoint: GET /v0/search-markets
            const data = await httpGet<any[]>(`${MANIFOLD_API_BASE}/search-markets?term=${encodeURIComponent(query)}`);

            return data
                .filter(m => m.outcomeType === 'BINARY')
                .map(mapManifoldMarket);
        },

        async quote(symbol: string): Promise<Quote> {
            // Endpoint: GET /v0/market/[marketId]
            // The 'symbol' passed from the harness will be the Manifold market ID
            const data = await httpGet<any>(`${MANIFOLD_API_BASE}/market/${symbol}`);

            return {
                market: mapManifoldMarket(data),
                timestamp: Date.now() // Stamped for the OpenTradex Orderbook cache
            };
        }
    };
}