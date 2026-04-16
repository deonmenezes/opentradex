/** OpenTradex Gateway - IP-enabled HTTP server with auth and SSE */

import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { OpenTradex } from '../index.js';
import { loadConfig, verifyAuthToken, getModeBadge, readModeLock } from '../config.js';
import { getRiskState, panicFlatten, isTradingHalted, checkRisk } from '../risk.js';
import type { Exchange } from '../types.js';

export interface GatewayConfig {
  port?: number;
  host?: string;
  requireAuth?: boolean;
}

// SSE clients for real-time updates
const sseClients = new Set<ServerResponse>();

// Broadcast event to all SSE clients
export function broadcast(type: string, payload: unknown): void {
  const data = JSON.stringify({ type, payload, timestamp: Date.now() });
  for (const client of sseClients) {
    client.write(`data: ${data}\n\n`);
  }
}

function json(res: ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(data, null, 2));
}

function error(res: ServerResponse, message: string, status = 400) {
  json(res, { error: message }, status);
}

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => resolve(body));
  });
}

function checkAuth(req: IncomingMessage, requireAuth: boolean): boolean {
  if (!requireAuth) return true;

  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (verifyAuthToken(token)) return true;
  }

  // Check query param (for initial dashboard load)
  const url = new URL(req.url || '/', `http://localhost`);
  const tokenParam = url.searchParams.get('token');
  if (tokenParam && verifyAuthToken(tokenParam)) return true;

  return false;
}

export function createGateway(harness: OpenTradex, config: GatewayConfig = {}) {
  const appConfig = loadConfig();
  const defaultHost = appConfig?.bindMode === 'local' ? '127.0.0.1' : '0.0.0.0';
  const requireAuth = appConfig?.bindMode !== 'local';

  const { port = appConfig?.port || 3210, host = defaultHost } = config;

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || '/', `http://${host}`);
    const path = url.pathname;
    const params = url.searchParams;

    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      });
      res.end();
      return;
    }

    // Auth check (skip for health endpoint)
    if (path !== '/' && path !== '/health' && !checkAuth(req, requireAuth)) {
      return error(res, 'Unauthorized', 401);
    }

    try {
      // ============ HEALTH & STATUS ============
      if (path === '/' || path === '/health') {
        const mode = readModeLock();
        const badge = getModeBadge();
        const risk = getRiskState();
        const halted = isTradingHalted();

        return json(res, {
          status: 'ok',
          version: '0.1.0',
          mode,
          badge: badge.text,
          exchanges: harness.exchanges,
          risk: {
            dailyPnL: risk.dailyPnL,
            openPositions: risk.openPositions.length,
            halted: halted.halted,
            haltReason: halted.reason,
          },
        });
      }

      // ============ SSE EVENTS ============
      if (path === '/events') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        });

        // Send initial connection event
        res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);

        // Add to clients
        sseClients.add(res);

        // Heartbeat every 30s
        const heartbeat = setInterval(() => {
          res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`);
        }, 30000);

        // Cleanup on close
        req.on('close', () => {
          clearInterval(heartbeat);
          sseClients.delete(res);
        });

        return;
      }

      // ============ MARKET DATA ============
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

      // ============ RISK ============
      if (path === '/risk') {
        const state = getRiskState();
        const halted = isTradingHalted();
        const config = loadConfig();

        return json(res, {
          state: {
            dailyPnL: state.dailyPnL,
            dailyTrades: state.dailyTrades,
            openPositions: state.openPositions,
            lastReset: state.lastReset,
          },
          halted: halted.halted,
          haltReason: halted.reason,
          limits: config?.risk,
        });
      }

      if (path === '/risk/check' && req.method === 'POST') {
        const body = await readBody(req);
        const trade = JSON.parse(body);
        const result = checkRisk(trade);
        return json(res, result);
      }

      // ============ COMMANDS ============
      if (path === '/command' && req.method === 'POST') {
        const body = await readBody(req);
        const { command } = JSON.parse(body);

        // Simple command routing (would connect to AI agent in production)
        let response: string;

        if (command.toLowerCase().includes('scan')) {
          const markets = await harness.scanAll(5);
          response = `Found ${markets.length} markets:\n${markets.map((m) => `- ${m.exchange}: ${m.symbol} @ ${m.price}`).join('\n')}`;
        } else if (command.toLowerCase().includes('risk')) {
          const state = getRiskState();
          response = `Risk State:\n- Daily P&L: $${state.dailyPnL.toFixed(2)}\n- Open Positions: ${state.openPositions.length}\n- Trades Today: ${state.dailyTrades}`;
        } else if (command.toLowerCase().includes('status')) {
          const mode = readModeLock();
          response = `Status: ${mode || 'not configured'}\nExchanges: ${harness.exchanges.join(', ')}`;
        } else {
          response = `Command received: "${command}"\n\nIn production, this would be processed by the AI agent. For now, try:\n- "scan markets"\n- "risk status"\n- "show status"`;
        }

        // Broadcast command event
        broadcast('command', { command, response });

        return json(res, { command, response });
      }

      // ============ PANIC ============
      if (path === '/panic' && req.method === 'POST') {
        const result = panicFlatten();

        // Broadcast panic event
        broadcast('panic', result);

        return json(res, {
          message: 'PANIC executed - all positions flattened',
          ...result,
        });
      }

      // ============ CONFIG ============
      if (path === '/config') {
        const config = loadConfig();
        // Don't expose sensitive keys
        const safeConfig = config
          ? {
              version: config.version,
              tradingMode: config.tradingMode,
              bindMode: config.bindMode,
              port: config.port,
              rails: Object.fromEntries(
                Object.entries(config.rails).map(([k, v]) => [k, { enabled: v.enabled, demo: v.demo }])
              ),
              risk: config.risk,
              model: config.model,
            }
          : null;
        return json(res, safeConfig);
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
          const badge = getModeBadge();
          const mode = readModeLock();
          const isRemote = host === '0.0.0.0';

          console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   ⚡ OpenTradex Gateway                                      ║
║                                                              ║
║   URL:      http://${isRemote ? '0.0.0.0' : 'localhost'}:${port}                              ║
║   Mode:     ${badge.text.padEnd(12)}                                   ║
║   Auth:     ${requireAuth ? 'Required (bearer token)' : 'Disabled (local only)'}              ║
║   Bind:     ${isRemote ? 'Remote (0.0.0.0)' : 'Local only'}                              ║
║                                                              ║
║   Exchanges: ${harness.exchanges.join(', ').padEnd(40)}  ║
║                                                              ║
║   Press Ctrl+C to stop                                       ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

          if (isRemote && requireAuth) {
            console.log('⚠️  Remote access enabled. Use bearer token for authentication.\n');
          }

          resolve();
        });
      });
    },
    stop() {
      // Close all SSE connections
      for (const client of sseClients) {
        client.end();
      }
      sseClients.clear();

      return new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
    server,
    broadcast,
  };
}
