/** OpenTradex Gateway - IP-enabled HTTP server with auth, SSE, WebSocket, and Dashboard UI */

import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { OpenTradex } from '../index.js';
import { loadConfig, verifyAuthToken, getModeBadge, readModeLock } from '../config.js';
import { getRiskState, panicFlatten, isTradingHalted, checkRisk } from '../risk.js';
import type { Exchange } from '../types.js';

// Get the directory of this file to find the dashboard
const __dirname = fileURLToPath(new URL('.', import.meta.url));

export interface GatewayConfig {
  port?: number;
  host?: string;
  requireAuth?: boolean;
}

// SSE clients for real-time updates
const sseClients = new Set<ServerResponse>();

// WebSocket clients for real-time updates (native implementation)
interface WebSocketClient {
  socket: import('node:net').Socket;
  isAlive: boolean;
  id: string;
}
const wsClients = new Set<WebSocketClient>();

// WebSocket frame encoding (RFC 6455)
function encodeWebSocketFrame(data: string): Buffer {
  const payload = Buffer.from(data, 'utf8');
  const length = payload.length;

  let header: Buffer;
  if (length <= 125) {
    header = Buffer.alloc(2);
    header[0] = 0x81; // FIN + text frame
    header[1] = length;
  } else if (length <= 65535) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }

  return Buffer.concat([header, payload]);
}

// Decode WebSocket frame
function decodeWebSocketFrame(buffer: Buffer): { opcode: number; payload: string } | null {
  if (buffer.length < 2) return null;

  const firstByte = buffer[0];
  const secondByte = buffer[1];
  const opcode = firstByte & 0x0f;
  const isMasked = (secondByte & 0x80) !== 0;
  let payloadLength = secondByte & 0x7f;
  let offset = 2;

  if (payloadLength === 126) {
    if (buffer.length < 4) return null;
    payloadLength = buffer.readUInt16BE(2);
    offset = 4;
  } else if (payloadLength === 127) {
    if (buffer.length < 10) return null;
    payloadLength = Number(buffer.readBigUInt64BE(2));
    offset = 10;
  }

  let maskKey: Buffer | null = null;
  if (isMasked) {
    if (buffer.length < offset + 4) return null;
    maskKey = buffer.subarray(offset, offset + 4);
    offset += 4;
  }

  if (buffer.length < offset + payloadLength) return null;

  let payload = buffer.subarray(offset, offset + payloadLength);
  if (maskKey) {
    payload = Buffer.from(payload);
    for (let i = 0; i < payload.length; i++) {
      payload[i] ^= maskKey[i % 4];
    }
  }

  return { opcode, payload: payload.toString('utf8') };
}

// Broadcast event to all SSE and WebSocket clients
export function broadcast(type: string, payload: unknown): void {
  const data = JSON.stringify({ type, payload, timestamp: Date.now() });

  // Broadcast to SSE clients
  for (const client of sseClients) {
    client.write(`data: ${data}\n\n`);
  }

  // Broadcast to WebSocket clients
  const frame = encodeWebSocketFrame(data);
  for (const client of wsClients) {
    try {
      client.socket.write(frame);
    } catch {
      wsClients.delete(client);
    }
  }
}

// MIME types for static files
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

// Find dashboard directory
function findDashboardDir(): string | null {
  const possiblePaths = [
    join(__dirname, '..', '..', 'packages', 'dashboard', 'dist', 'client'),
    join(__dirname, '..', '..', '..', 'packages', 'dashboard', 'dist', 'client'),
    join(process.cwd(), 'packages', 'dashboard', 'dist', 'client'),
  ];

  for (const p of possiblePaths) {
    if (existsSync(join(p, 'index.html'))) {
      return p;
    }
  }
  return null;
}

// Serve static file
function serveStatic(res: ServerResponse, dashboardDir: string, filePath: string): boolean {
  const fullPath = join(dashboardDir, filePath);

  // Security: prevent directory traversal
  if (!fullPath.startsWith(dashboardDir)) {
    return false;
  }

  if (!existsSync(fullPath)) return false;

  try {
    const stat = statSync(fullPath);
    if (!stat.isFile()) return false;

    const ext = extname(fullPath);
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = readFileSync(fullPath);

    res.writeHead(200, {
      'Content-Type': mimeType,
      'Content-Length': content.length,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000',
    });
    res.end(content);
    return true;
  } catch {
    return false;
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

  // Find dashboard
  const dashboardDir = findDashboardDir();

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

    // Auth check for API routes (skip for static files and health)
    const isApiRoute = path.startsWith('/api/') || ['/scan', '/search', '/quote', '/orderbook', '/risk', '/command', '/panic', '/config', '/events'].includes(path);
    if (isApiRoute && path !== '/api/health' && !checkAuth(req, requireAuth)) {
      return error(res, 'Unauthorized', 401);
    }

    try {
      // ============ API ROUTES ============

      // Health & Status (API)
      if (path === '/api/health' || path === '/api/' || path === '/api') {
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

      // SSE Events
      if (path === '/events' || path === '/api/events') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        });

        res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);
        sseClients.add(res);

        const heartbeat = setInterval(() => {
          res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`);
        }, 30000);

        req.on('close', () => {
          clearInterval(heartbeat);
          sseClients.delete(res);
        });

        return;
      }

      // Scan
      if (path === '/scan' || path === '/api/scan') {
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

      // Search
      if (path === '/search' || path === '/api/search') {
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

      // Quote
      if (path === '/quote' || path === '/api/quote') {
        const exchange = params.get('exchange') as Exchange;
        const symbol = params.get('symbol');

        if (!exchange) return error(res, 'Missing parameter: exchange');
        if (!symbol) return error(res, 'Missing parameter: symbol');

        const quote = await harness.exchange(exchange).quote(symbol);
        return json(res, quote);
      }

      // Orderbook
      if (path === '/orderbook' || path === '/api/orderbook') {
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

      // Risk
      if (path === '/risk' || path === '/api/risk') {
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

      if ((path === '/risk/check' || path === '/api/risk/check') && req.method === 'POST') {
        const body = await readBody(req);
        const trade = JSON.parse(body);
        const result = checkRisk(trade);
        return json(res, result);
      }

      // Command
      if ((path === '/command' || path === '/api/command') && req.method === 'POST') {
        const body = await readBody(req);
        const { command } = JSON.parse(body);

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

        broadcast('command', { command, response });
        return json(res, { command, response });
      }

      // Panic
      if ((path === '/panic' || path === '/api/panic') && req.method === 'POST') {
        const result = panicFlatten();
        broadcast('panic', result);
        return json(res, { message: 'PANIC executed - all positions flattened', ...result });
      }

      // Config
      if (path === '/config' || path === '/api/config') {
        const config = loadConfig();
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

      // ============ DASHBOARD UI ============

      if (dashboardDir) {
        // Serve static assets
        if (path !== '/' && serveStatic(res, dashboardDir, path)) {
          return;
        }

        // SPA fallback - serve index.html for all other routes
        const indexPath = join(dashboardDir, 'index.html');
        if (existsSync(indexPath)) {
          const content = readFileSync(indexPath, 'utf-8');
          res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' });
          res.end(content);
          return;
        }
      }

      // No dashboard - show API info
      if (path === '/') {
        const mode = readModeLock();
        const badge = getModeBadge();

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
<!DOCTYPE html>
<html>
<head>
  <title>OpenTradex Gateway</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0B0F14; color: #E6EDF3; padding: 40px; max-width: 800px; margin: 0 auto; }
    h1 { color: #3FB68B; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; }
    .paper { background: rgba(63,182,139,0.2); color: #3FB68B; }
    .live { background: rgba(229,72,77,0.2); color: #E5484D; }
    pre { background: #121821; padding: 16px; border-radius: 8px; overflow-x: auto; }
    a { color: #3FB68B; }
    .warning { background: #1A2230; border-left: 4px solid #F5A623; padding: 16px; margin: 20px 0; }
  </style>
</head>
<body>
  <h1>⚡ OpenTradex Gateway</h1>
  <p>Mode: <span class="badge ${mode === 'live-allowed' ? 'live' : 'paper'}">${badge.text}</span></p>

  <div class="warning">
    <strong>Dashboard not found!</strong><br>
    Build the dashboard first: <code>npm run build:all</code>
  </div>

  <h2>API Endpoints</h2>
  <pre>
GET  /api/health      Health & status
GET  /api/scan        Scan markets
GET  /api/search?q=   Search markets
GET  /api/quote       Get quote
GET  /api/risk        Risk state
GET  /api/events      SSE stream
POST /api/command     Send command
POST /api/panic       Emergency stop
  </pre>

  <h2>Quick Test</h2>
  <pre>curl http://localhost:${port}/api/scan?exchange=crypto&limit=3</pre>

  <p><a href="https://github.com/deonmenezes/opentradex">GitHub</a></p>
</body>
</html>
        `);
        return;
      }

      return error(res, 'Not found', 404);
    } catch (err) {
      console.error('Gateway error:', err);
      return error(res, err instanceof Error ? err.message : 'Internal error', 500);
    }
  });

  // WebSocket upgrade handler (native, no external dependencies)
  server.on('upgrade', (req: IncomingMessage, socket: import('node:net').Socket, head: Buffer) => {
    const url = new URL(req.url || '/', `http://${host}`);

    // Only handle /ws endpoint
    if (url.pathname !== '/ws' && url.pathname !== '/api/ws') {
      socket.destroy();
      return;
    }

    // Check auth for WebSocket
    const tokenParam = url.searchParams.get('token');
    if (requireAuth && !tokenParam) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    if (requireAuth && tokenParam && !verifyAuthToken(tokenParam)) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    // Perform WebSocket handshake
    const key = req.headers['sec-websocket-key'];
    if (!key) {
      socket.destroy();
      return;
    }

    const acceptKey = createHash('sha1')
      .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
      .digest('base64');

    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${acceptKey}\r\n` +
      '\r\n'
    );

    const clientId = Date.now().toString(36) + Math.random().toString(36).substring(2);
    const client: WebSocketClient = { socket, isAlive: true, id: clientId };
    wsClients.add(client);

    console.log(`[WS] Client connected: ${clientId} (${wsClients.size} total)`);

    // Send welcome message
    const welcomeMsg = encodeWebSocketFrame(JSON.stringify({
      type: 'connected',
      payload: { clientId, protocol: 'websocket' },
      timestamp: Date.now(),
    }));
    socket.write(welcomeMsg);

    // Handle incoming messages
    let buffer = Buffer.alloc(0);
    socket.on('data', (data: Buffer) => {
      buffer = Buffer.concat([buffer, data]);

      const frame = decodeWebSocketFrame(buffer);
      if (!frame) return;

      buffer = Buffer.alloc(0); // Clear buffer after processing

      // Handle different opcodes
      if (frame.opcode === 0x08) {
        // Close frame
        wsClients.delete(client);
        socket.end();
        return;
      }

      if (frame.opcode === 0x09) {
        // Ping - respond with pong
        const pong = Buffer.alloc(2);
        pong[0] = 0x8a; // Pong frame
        pong[1] = 0x00;
        socket.write(pong);
        return;
      }

      if (frame.opcode === 0x0a) {
        // Pong - mark client as alive
        client.isAlive = true;
        return;
      }

      // Text frame - handle message
      if (frame.opcode === 0x01) {
        try {
          const msg = JSON.parse(frame.payload);
          if (msg.type === 'ping') {
            const response = encodeWebSocketFrame(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            socket.write(response);
          }
        } catch {
          // Ignore invalid JSON
        }
      }
    });

    socket.on('close', () => {
      wsClients.delete(client);
      console.log(`[WS] Client disconnected: ${clientId} (${wsClients.size} remaining)`);
    });

    socket.on('error', () => {
      wsClients.delete(client);
    });
  });

  // WebSocket heartbeat to detect dead connections
  const wsHeartbeat = setInterval(() => {
    for (const client of wsClients) {
      if (!client.isAlive) {
        wsClients.delete(client);
        client.socket.destroy();
        continue;
      }
      client.isAlive = false;
      // Send ping
      const ping = Buffer.alloc(2);
      ping[0] = 0x89; // Ping frame
      ping[1] = 0x00;
      try {
        client.socket.write(ping);
      } catch {
        wsClients.delete(client);
      }
    }
  }, 30000);

  return {
    start() {
      return new Promise<void>((resolve) => {
        server.listen(port, host, () => {
          const badge = getModeBadge();
          const isRemote = host === '0.0.0.0';
          const hasDashboard = dashboardDir !== null;

          console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   ⚡ OpenTradex Gateway                                      ║
║                                                              ║
║   Dashboard: http://${isRemote ? '0.0.0.0' : 'localhost'}:${String(port).padEnd(5)}                          ║
║   API:       http://${isRemote ? '0.0.0.0' : 'localhost'}:${String(port).padEnd(5)}/api                      ║
║   WebSocket: ws://${isRemote ? '0.0.0.0' : 'localhost'}:${String(port).padEnd(5)}/ws                        ║
║                                                              ║
║   Mode:      ${badge.text.padEnd(12)}                                   ║
║   UI:        ${hasDashboard ? 'Enabled ✓' : 'Not built (run npm run build:all)'}              ║
║   Auth:      ${requireAuth ? 'Required (bearer token)' : 'Disabled (local only)'}              ║
║   Realtime:  SSE + WebSocket ✓                               ║
║                                                              ║
║   Exchanges: ${harness.exchanges.join(', ').padEnd(40)}  ║
║                                                              ║
║   Press Ctrl+C to stop                                       ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

          if (!hasDashboard) {
            console.log('⚠️  Dashboard not found. Run: npm run build:all\n');
          }

          if (isRemote && requireAuth) {
            console.log('⚠️  Remote access enabled. Use bearer token for authentication.\n');
          }

          resolve();
        });
      });
    },
    stop() {
      // Clear heartbeat
      clearInterval(wsHeartbeat);

      // Close SSE clients
      for (const client of sseClients) {
        client.end();
      }
      sseClients.clear();

      // Close WebSocket clients
      for (const client of wsClients) {
        try {
          // Send close frame
          const closeFrame = Buffer.alloc(2);
          closeFrame[0] = 0x88; // Close frame
          closeFrame[1] = 0x00;
          client.socket.write(closeFrame);
          client.socket.end();
        } catch {
          // Ignore errors during shutdown
        }
      }
      wsClients.clear();

      return new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
    server,
    broadcast,
    wsClients, // Expose for testing
  };
}
