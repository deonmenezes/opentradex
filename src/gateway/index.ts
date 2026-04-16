/** Local HTTP gateway server for OpenTradex */

import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { OpenTradex } from '../index.js';
import type { Exchange } from '../types.js';

export interface GatewayConfig {
  port?: number;
  host?: string;
}

function json(res: ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data, null, 2));
}

function error(res: ServerResponse, message: string, status = 400) {
  json(res, { error: message }, status);
}

export function createGateway(harness: OpenTradex, config: GatewayConfig = {}) {
  const { port = 3210, host = '127.0.0.1' } = config;

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || '/', `http://${host}`);
    const path = url.pathname;
    const params = url.searchParams;

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      // Routes
      if (path === '/' || path === '/health') {
        return json(res, { status: 'ok', exchanges: harness.exchanges });
      }

      if (path === '/scan') {
        const exchange = params.get('exchange') as Exchange | null;
        const limit = parseInt(params.get('limit') || '20');

        if (exchange) {
          const markets = await harness.exchange(exchange).scan(limit);
          return json(res, { exchange, count: markets.length, markets });
        } else {
          const markets = await harness.scanAll(limit);
          return json(res, { count: markets.length, markets });
        }
      }

      if (path === '/search') {
        const query = params.get('q');
        const exchange = params.get('exchange') as Exchange | null;

        if (!query) return error(res, 'Missing query parameter: q');

        if (exchange) {
          const markets = await harness.exchange(exchange).search(query);
          return json(res, { exchange, query, count: markets.length, markets });
        } else {
          const markets = await harness.searchAll(query);
          return json(res, { query, count: markets.length, markets });
        }
      }

      if (path === '/quote') {
        const exchange = params.get('exchange') as Exchange;
        const symbol = params.get('symbol');

        if (!exchange) return error(res, 'Missing parameter: exchange');
        if (!symbol) return error(res, 'Missing parameter: symbol');

        const quote = await harness.exchange(exchange).quote(symbol);
        return json(res, quote);
      }

      if (path === '/orderbook') {
        const exchange = params.get('exchange') as Exchange;
        const symbol = params.get('symbol');

        if (!exchange) return error(res, 'Missing parameter: exchange');
        if (!symbol) return error(res, 'Missing parameter: symbol');

        const connector = harness.exchange(exchange);
        if (!connector.orderbook) {
          return error(res, `Orderbook not supported for ${exchange}`);
        }
        const ob = await connector.orderbook(symbol);
        return json(res, ob);
      }

      return error(res, 'Not found', 404);
    } catch (err) {
      console.error('Gateway error:', err);
      return error(res, err instanceof Error ? err.message : 'Internal error', 500);
    }
  });

  return {
    start() {
      return new Promise<void>((resolve) => {
        server.listen(port, host, () => {
          console.log(`OpenTradex gateway running at http://${host}:${port}`);
          resolve();
        });
      });
    },
    stop() {
      return new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
    server,
  };
}
