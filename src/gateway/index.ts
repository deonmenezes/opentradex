/** OpenTradex Gateway - IP-enabled HTTP server with auth, SSE, WebSocket, and Dashboard UI */

import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { OpenTradex } from '../index.js';
import { loadConfig, saveConfig, writeModeLock, defaultConfig, verifyAuthToken, getModeBadge, readModeLock, type TradingMode } from '../config.js';
import { PROVIDER_ENV, clearProviderKey, listSavedProviders, saveProviderKey, setPreferredProvider, getPreferredProvider } from '../ai/ai-keys.js';
import { detectCLIs, getProvider } from '../ai/providers/registry.js';
import { getRiskState, panicFlatten, isTradingHalted, checkRisk, getEquity, recordPosition, closePosition } from '../risk.js';
import { getAgent, AgentConfig } from '../agent/index.js';
import { getAI, initializeAI } from '../ai/index.js';
import { addressFromKey, generatePrivateKey, isPaymentsActive, loadX402Settings, readLedger, saveX402Settings } from '../x402/index.js';
import type { Exchange } from '../types.js';
import { getScraperService } from '../scraper/service.js';
import { getMemory } from '../ai/memory.js';
import { routeIntent } from '../ai/intents.js';
import { SKILLS, getSkill, renderCommand, getAllCategories } from '../agent/skills-registry.js';
import { recordRun, getRuns, generateRunId } from '../agent/runs-log.js';

// Get the directory of this file to find the dashboard
const __dirname = fileURLToPath(new URL('.', import.meta.url));

export interface GatewayConfig {
  port?: number;
  host?: string;
  requireAuth?: boolean;
  timeoutMs?: number;
}

// SSE clients for real-time updates
const sseClients = new Set<ServerResponse>();

// WebSocket clients for real-time updates (native implementation)
interface WebSocketClient {
  socket: import('node:net').Socket;
  isAlive: boolean;
  missedPings: number;
  id: string;
}
const wsClients = new Set<WebSocketClient>();

// Backpressure: if a client's outbound buffer exceeds this, we drop them so one slow peer
// can't balloon memory. 1 MB matches the PRD requirement.
const WS_SEND_BUFFER_LIMIT = 1024 * 1024;
// Allow this many consecutive missed pings before we evict a dead client.
const WS_MAX_MISSED_PINGS = 2;

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

// Decode WebSocket frame and report how many bytes were consumed
function decodeWebSocketFrameWithSize(
  buffer: Buffer
): { frame: { opcode: number; payload: string }; consumed: number } | null {
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

  return {
    frame: { opcode, payload: payload.toString('utf8') },
    consumed: offset + payloadLength,
  };
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
    // Backpressure: if the outbound buffer is above 1 MB the peer can't keep up —
    // drop them with close-code 1013 (Try Again Later) so one slow client can't OOM us.
    if (client.socket.writableLength > WS_SEND_BUFFER_LIMIT) {
      console.warn(`[WS] Evicting slow client ${client.id} (buffer=${client.socket.writableLength}B > ${WS_SEND_BUFFER_LIMIT}B)`);
      try {
        const closeFrame = Buffer.from([0x88, 0x02, 0x03, 0xf5]); // FIN+close, len=2, code=1013
        client.socket.write(closeFrame);
        client.socket.end();
      } catch {
        // already closing
      }
      wsClients.delete(client);
      continue;
    }
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
  // If the timeout (or another handler) already responded, don't write again.
  if (res.headersSent || res.writableEnded) return;
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(data, null, 2));
}

function error(res: ServerResponse, message: string, status = 400, code = 'BAD_REQUEST') {
  if (res.headersSent) return;
  json(res, { error: message, code }, status);
}

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => resolve(body));
  });
}

async function readJsonBody<T = unknown>(req: IncomingMessage): Promise<T> {
  const body = await readBody(req);
  if (!body) return {} as T;
  try {
    return JSON.parse(body) as T;
  } catch {
    const err = new Error('Invalid JSON body');
    (err as Error & { code?: string; status?: number }).code = 'BAD_JSON';
    (err as Error & { code?: string; status?: number }).status = 400;
    throw err;
  }
}

const GATEWAY_TIMEOUT_MS = 30_000;

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
  // Prefer explicit config.requireAuth; otherwise derive from bindMode (non-local ⇒ auth required).
  const requireAuth =
    typeof config.requireAuth === 'boolean' ? config.requireAuth : appConfig?.bindMode !== 'local';

  const { port = appConfig?.port || 3210, host = defaultHost, timeoutMs = GATEWAY_TIMEOUT_MS } = config;

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
    const protectedPrefixes = ['/api/', '/agent/', '/ai/', '/x402/'];
    const protectedExact = ['/scan', '/search', '/quote', '/orderbook', '/risk', '/risk/check', '/command', '/panic', '/config', '/events', '/agent', '/ai', '/x402'];
    const isApiRoute = protectedPrefixes.some((p) => path.startsWith(p)) || protectedExact.includes(path);
    if (isApiRoute && path !== '/api/health' && !checkAuth(req, requireAuth)) {
      return error(res, 'Unauthorized', 401, 'UNAUTHORIZED');
    }

    // Streaming/persistent connections are exempt from the gateway timeout
    const isStreamingRoute = path === '/events' || path === '/api/events';
    let timeoutHandle: NodeJS.Timeout | undefined;
    if (!isStreamingRoute) {
      timeoutHandle = setTimeout(() => {
        if (!res.headersSent) {
          try {
            json(res, { error: 'Gateway timeout', code: 'TIMEOUT' }, 504);
          } catch {
            // socket may already be torn down
          }
        }
      }, timeoutMs);
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

        const equity = getEquity();
        const winRate = state.dailyTrades > 0 ? (state.dailyWins / state.dailyTrades) * 100 : 0;
        return json(res, {
          state: {
            dailyPnL: state.dailyPnL,
            dailyTrades: state.dailyTrades,
            dailyWins: state.dailyWins,
            winRate,
            openPositions: state.openPositions,
            lastReset: state.lastReset,
            startingCapital: state.startingCapital,
            equity,
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

      // Command - AI-powered with intent routing to agent/harness
      if ((path === '/command' || path === '/api/command') && req.method === 'POST') {
        const body = await readBody(req);
        const { command } = JSON.parse(body);

        let response = '';
        let aiUsed = false;
        let action: string | null = null;

        // 1. Try deterministic intent routing first — this is the AI↔agent bridge.
        //    If the user said "start trading", "panic", "buy 10 AAPL", etc.,
        //    we execute the action and skip the conversational AI.
        const intent = await routeIntent(command, { harness, broadcast });
        if (intent) {
          response = intent.reply;
          action = intent.action;
        }

        // 2. Fall through to conversational AI if no intent matched.
        const ai = getAI();
        const memory = getMemory();
        const memoryUserId = 'local';
        if (!intent && ai.isAvailable()) {
          try {
            let enhancedCommand = command;
            if (command.toLowerCase().includes('scan') || command.toLowerCase().includes('market')) {
              const markets = await harness.scanAll(5);
              enhancedCommand = `${command}\n\nCurrent Market Data:\n${markets.map((m) => `- ${m.exchange}: ${m.symbol} @ $${m.price}`).join('\n')}`;
            }

            const recalled = await memory.recall(memoryUserId, command);
            const memoryBlock = memory.formatForPrompt(recalled);
            if (memoryBlock) {
              enhancedCommand = `${memoryBlock}\n\n---\n\nThe user's new message (respond to THIS, not to the history above):\n\n${enhancedCommand}`;
            }

            const aiResponse = await ai.chat(enhancedCommand);
            response = aiResponse.content;
            aiUsed = true;

            void memory.remember({ userId: memoryUserId, userMessage: command, assistantMessage: response });
          } catch (err) {
            console.error('[AI] Command error:', err);
          }
        }

        // 3. Deterministic fallback if neither intent nor AI produced output.
        if (!intent && !aiUsed) {
          if (command.toLowerCase().includes('status')) {
            const mode = readModeLock();
            response = `Status: ${mode || 'not configured'}\nExchanges: ${harness.exchanges.join(', ')}`;
          } else {
            response = `Command received: "${command}"\n\nAI not configured. Run \`npx opentradex onboard\` to enable AI features.\n\nBasic commands available:\n- "start trading"  (autonomous loop)\n- "stop trading"\n- "scan markets"\n- "risk"  (daily P&L)\n- "positions"\n- "panic"  (flatten all)\n- "buy 10 AAPL" / "sell 5 BTC"`;
          }
        }

        // Remember both user input and our reply when memory is available.
        if (intent) {
          void memory.remember({ userId: memoryUserId, userMessage: command, assistantMessage: response });
        }

        broadcast('command', { command, response, aiUsed, action });
        return json(res, { command, response, aiUsed, action });
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

      // ============ x402 PAYMENTS ROUTES ============

      // Wallet + protocol status (safe — never exposes private key)
      if (path === '/x402/status' || path === '/api/x402/status') {
        const settings = loadX402Settings();
        const active = await isPaymentsActive();
        let address: string | null = null;
        if (settings.enabled && settings.privateKey) {
          try { address = await addressFromKey(settings.privateKey); } catch { address = null; }
        }
        return json(res, {
          enabled: settings.enabled,
          active,
          chain: settings.chain,
          maxPaymentUsd: settings.maxPaymentUsd,
          address,
          facilitatorUrl: settings.facilitatorUrl ?? null,
        });
      }

      // Enable / update x402 (accepts { chain, maxPaymentUsd, privateKey?, generate? })
      if ((path === '/x402/enable' || path === '/api/x402/enable') && req.method === 'POST') {
        const body = await readBody(req);
        const input = body ? JSON.parse(body) : {};
        let privateKey: `0x${string}` | undefined = input.privateKey;
        if (!privateKey && input.generate) privateKey = await generatePrivateKey();
        if (!privateKey) return error(res, 'Provide privateKey or set generate:true', 400);
        if (!privateKey.startsWith('0x') || privateKey.length !== 66) return error(res, 'Invalid private key', 400);
        const saved = saveX402Settings({
          chain: input.chain ?? 'base-sepolia',
          maxPaymentUsd: Number(input.maxPaymentUsd ?? 1),
          privateKey,
        });
        const address = await addressFromKey(privateKey);
        broadcast('x402', { event: 'enabled', address, chain: saved.chain });
        return json(res, { enabled: true, chain: saved.chain, maxPaymentUsd: saved.maxPaymentUsd, address });
      }

      // Disable x402 (clears the key)
      if ((path === '/x402/disable' || path === '/api/x402/disable') && req.method === 'POST') {
        saveX402Settings({ privateKey: null });
        broadcast('x402', { event: 'disabled' });
        return json(res, { enabled: false });
      }

      // Recent payments ledger
      if (path === '/x402/ledger' || path === '/api/x402/ledger') {
        const limit = parseInt(params.get('limit') || '100');
        return json(res, { entries: readLedger(Math.min(limit, 500)) });
      }

      // ============ AI AGENT ROUTES ============

      // Agent Status
      if (path === '/agent' || path === '/api/agent' || path === '/agent/status' || path === '/api/agent/status') {
        const agent = getAgent();
        return json(res, {
          status: agent.getStatus(),
          config: agent.getConfig(),
        });
      }

      // Start Agent
      if ((path === '/agent/start' || path === '/api/agent/start') && req.method === 'POST') {
        const body = await readBody(req);
        const config = body ? JSON.parse(body) : {};
        const agent = getAgent(config as Partial<AgentConfig>);

        // Wire agent → harness risk state (one-time listener install)
        const a = agent as unknown as { _harnessWired?: boolean };
        if (!a._harnessWired) {
          a._harnessWired = true;
          agent.on('trade', (trade: { symbol: string; side: 'buy' | 'sell'; quantity: number; price: number }) => {
            recordPosition({
              exchange: 'crypto',
              symbol: trade.symbol,
              side: trade.side === 'buy' ? 'long' : 'short',
              size: trade.quantity,
              avgPrice: trade.price,
              currentPrice: trade.price,
              pnl: 0,
              pnlPercent: 0,
            });
            broadcast('trade', trade);
          });
        }

        await agent.start();
        broadcast('agent', { event: 'started', status: agent.getStatus() });

        return json(res, { message: 'Agent started', status: agent.getStatus() });
      }

      // Stop Agent
      if ((path === '/agent/stop' || path === '/api/agent/stop') && req.method === 'POST') {
        const agent = getAgent();
        agent.stop();
        broadcast('agent', { event: 'stopped', status: agent.getStatus() });

        return json(res, { message: 'Agent stopped', status: agent.getStatus() });
      }

      // Trigger Manual Scan
      if ((path === '/agent/scan' || path === '/api/agent/scan') && req.method === 'POST') {
        const agent = getAgent();
        const results = await agent.triggerScan();
        broadcast('agent', { event: 'scan-complete', results });

        return json(res, { count: results.length, results });
      }

      // Update Agent Config
      if ((path === '/agent/config' || path === '/api/agent/config') && req.method === 'POST') {
        const body = await readBody(req);
        const updates = JSON.parse(body);
        const agent = getAgent();
        agent.updateConfig(updates);

        return json(res, { message: 'Config updated', config: agent.getConfig() });
      }

      // Toggle Auto-Loop
      if ((path === '/agent/autoloop' || path === '/api/agent/autoloop') && req.method === 'POST') {
        const body = await readBody(req);
        const { enabled } = JSON.parse(body);
        const agent = getAgent();
        agent.setAutoLoop(enabled);
        broadcast('agent', { event: 'autoloop', enabled, status: agent.getStatus() });

        return json(res, { message: `Auto-loop ${enabled ? 'enabled' : 'disabled'}`, status: agent.getStatus() });
      }

      // ============ AI ROUTES ============

      // AI Status
      if (path === '/ai' || path === '/api/ai' || path === '/ai/status' || path === '/api/ai/status') {
        const ai = getAI();
        return json(res, {
          available: ai.isAvailable(),
          config: ai.getConfig(),
        });
      }

      // Initialize AI with API key
      if ((path === '/ai/init' || path === '/api/ai/init') && req.method === 'POST') {
        const body = await readBody(req);
        const { apiKey } = JSON.parse(body);
        const success = initializeAI(apiKey);
        return json(res, { success, message: success ? 'AI initialized' : 'Failed to initialize AI' });
      }

      // AI providers — list all registered backends with configured/active status
      if (path === '/ai/providers' || path === '/api/ai/providers') {
        const ai = getAI();
        return json(res, {
          providers: ai.providerStatus(),
          saved: listSavedProviders(),
          preferred: getPreferredProvider() ?? null,
        });
      }

      // CLI detection — probes PATH for claude/opencode/gemini/ollama so the
      // setup wizard can offer zero-config one-click setup when the user has
      // already installed one of these tools.
      if (path === '/ai/cli-detect' || path === '/api/ai/cli-detect') {
        const detections = detectCLIs().map((d) => {
          const provider = getProvider(d.provider);
          return {
            ...d,
            configured: provider?.isConfigured() === true,
            defaultModel: provider?.defaultModel ?? null,
          };
        });
        return json(res, { detected: detections });
      }

      // Set the user's preferred orchestrator provider — usually a CLI pick
      // from the "Detected on your system" list. Persists to ai-keys.json and
      // sets OPENTRADEX_ROLE_ORCHESTRATOR so the registry routes through it.
      if ((path === '/ai/preferred' || path === '/api/ai/preferred') && req.method === 'POST') {
        const { provider } = await readJsonBody<{ provider?: string | null }>(req);
        if (provider !== null && typeof provider !== 'string') {
          return error(res, 'provider must be a string or null', 400, 'BAD_REQUEST');
        }
        if (provider) {
          const registered = getProvider(provider);
          if (!registered) return error(res, `Unknown provider: ${provider}`, 400, 'UNKNOWN_PROVIDER');
          if (!registered.isConfigured()) {
            return error(res, `${provider} is not configured on this machine`, 400, 'NOT_CONFIGURED');
          }
        }
        setPreferredProvider(provider ?? null);
        getAI().initialize();
        broadcast('ai', { event: 'preferred-changed', provider: provider ?? null });
        return json(res, { ok: true, preferred: provider ?? null });
      }

      // Save an API key for a provider (persists to ~/.opentradex/ai-keys.json
      // and hydrates process.env in-process so the provider becomes active immediately).
      if ((path === '/ai/providers/save' || path === '/api/ai/providers/save') && req.method === 'POST') {
        const { provider, apiKey } = await readJsonBody<{ provider?: string; apiKey?: string }>(req);
        if (!provider || !apiKey) return error(res, 'provider and apiKey are required', 400, 'BAD_REQUEST');
        if (!PROVIDER_ENV[provider]) return error(res, `Unknown provider: ${provider}`, 400, 'UNKNOWN_PROVIDER');
        try {
          saveProviderKey(provider, apiKey);
          // Re-initialise so the in-memory AI singleton picks up the new env var
          getAI().initialize();
          broadcast('ai', { event: 'provider-saved', provider });
          return json(res, { ok: true, provider });
        } catch (e) {
          return error(res, e instanceof Error ? e.message : 'Save failed', 400, 'SAVE_FAILED');
        }
      }

      // Delete a saved provider key (clears file + env var).
      if ((path === '/ai/providers/delete' || path === '/api/ai/providers/delete') && req.method === 'POST') {
        const { provider } = await readJsonBody<{ provider?: string }>(req);
        if (!provider) return error(res, 'provider is required', 400, 'BAD_REQUEST');
        clearProviderKey(provider);
        getAI().initialize();
        broadcast('ai', { event: 'provider-deleted', provider });
        return json(res, { ok: true, provider });
      }

      // Test an API key against the provider — does NOT persist. Sends "say hi" and
      // returns { ok, latencyMs, model, content?, error? } so the wizard can show
      // inline success/error without committing a bad key to disk.
      if ((path === '/ai/providers/test' || path === '/api/ai/providers/test') && req.method === 'POST') {
        const { provider, apiKey } = await readJsonBody<{ provider?: string; apiKey?: string }>(req);
        if (!provider || !apiKey) return error(res, 'provider and apiKey are required', 400, 'BAD_REQUEST');
        const envKey = PROVIDER_ENV[provider];
        if (!envKey) return error(res, `Unknown provider: ${provider}`, 400, 'UNKNOWN_PROVIDER');

        // Swap the env var just for this call, then restore — so we never accidentally
        // leak a failing key into future requests and we don't clobber a good one.
        const prev = process.env[envKey];
        process.env[envKey] = apiKey.trim();
        const started = Date.now();
        try {
          const p = getAI().providerStatus().find((x) => x.name === provider);
          // Force re-init so the provider sees the fresh env var.
          getAI().initialize();
          const response = await getAI().chat('Reply with exactly the word: ok', {
            provider,
            includeContext: false,
            maxTokens: 16,
          });
          const latencyMs = Date.now() - started;
          const ok = !!response.content && !response.content.startsWith('AI Error');
          return json(res, {
            ok,
            latencyMs,
            model: response.model || p?.defaultModel || 'unknown',
            content: response.content.slice(0, 200),
            error: ok ? undefined : response.content,
          });
        } catch (e) {
          const latencyMs = Date.now() - started;
          return json(res, {
            ok: false,
            latencyMs,
            error: e instanceof Error ? e.message : 'Test failed',
          });
        } finally {
          if (prev === undefined) delete process.env[envKey];
          else process.env[envKey] = prev;
          getAI().initialize();
        }
      }

      // Update trading mode — writes config.tradingMode + mode.lock. The lock is
      // irreversible for paper-only (downstream enforces), but the gateway always
      // accepts the write so the UI stays authoritative.
      if ((path === '/mode' || path === '/api/mode') && req.method === 'POST') {
        const { mode } = await readJsonBody<{ mode?: string }>(req);
        const allowed: TradingMode[] = ['paper-only', 'paper-default', 'live-allowed'];
        if (!mode || !allowed.includes(mode as TradingMode)) {
          return error(res, `mode must be one of: ${allowed.join(', ')}`, 400, 'BAD_MODE');
        }
        const currentLock = readModeLock();
        if (currentLock === 'paper-only' && mode !== 'paper-only') {
          return error(res, 'Paper-only mode is locked on this machine. Run `opentradex onboard` to change it.', 409, 'MODE_LOCKED');
        }
        const cfg = loadConfig() || defaultConfig();
        cfg.tradingMode = mode as TradingMode;
        saveConfig(cfg);
        writeModeLock(mode as TradingMode);
        broadcast('mode', { mode });
        return json(res, { ok: true, mode });
      }

      // AI Chat (direct) — accepts optional provider/model/role routing
      if ((path === '/ai/chat' || path === '/api/ai/chat') && req.method === 'POST') {
        const body = await readBody(req);
        const { message, includeContext, provider, model, role } = JSON.parse(body);
        const ai = getAI();

        if (!ai.isAvailable()) {
          return json(res, { error: 'AI not configured. Set any provider key (ANTHROPIC_API_KEY / OPENAI_API_KEY / OPENROUTER_API_KEY / GOOGLE_API_KEY / GROQ_API_KEY / KIMI_API_KEY / DEEPSEEK_API_KEY) or install Claude Code CLI.' }, 400);
        }

        const response = await ai.chat(message, {
          includeContext: includeContext !== false,
          provider,
          model,
          role,
        });
        return json(res, response);
      }

      // AI Analyze Market
      if ((path === '/ai/analyze' || path === '/api/ai/analyze') && req.method === 'POST') {
        const body = await readBody(req);
        const { symbol, exchange } = JSON.parse(body);
        const ai = getAI();

        if (!ai.isAvailable()) {
          return json(res, { error: 'AI not configured' }, 400);
        }

        // Get market data if available
        let marketData;
        try {
          marketData = await harness.exchange(exchange as Exchange).quote(symbol);
        } catch {
          // Continue without market data
        }

        const response = await ai.analyzeMarket(symbol, exchange, marketData);
        return json(res, response);
      }

      // AI Risk Explanation
      if (path === '/ai/risk' || path === '/api/ai/risk') {
        const ai = getAI();

        if (!ai.isAvailable()) {
          return json(res, { error: 'AI not configured' }, 400);
        }

        const response = await ai.explainRisk();
        return json(res, response);
      }

      // ============ SCRAPER ROUTES ============

      // Scraper status + full snapshot (dashboard hydration)
      if (path === '/api/scraper' || path === '/api/scraper/snapshot') {
        const scraper = getScraperService();
        return json(res, {
          running: scraper.isRunning(),
          ...scraper.getSnapshot(),
        });
      }

      // Live prices
      if (path === '/api/scraper/prices') {
        const scraper = getScraperService();
        const symbol = params.get('symbol');
        if (symbol) {
          const price = scraper.getPrice(symbol.toUpperCase());
          return json(res, price ?? { error: 'Symbol not found' });
        }
        return json(res, { prices: scraper.getAllPrices() });
      }

      // Live news feed
      if (path === '/api/scraper/news') {
        const scraper = getScraperService();
        const limit = parseInt(params.get('limit') || '50');
        return json(res, { news: scraper.getNews(limit) });
      }

      // Exchange events (Polymarket, Kalshi, Binance, Coinbase, PredictIt, Manifold)
      if (path === '/api/scraper/exchanges') {
        const scraper = getScraperService();
        const exchange = params.get('exchange');
        return json(res, { events: scraper.getExchangeEvents(exchange || undefined) });
      }

      // Scraper health per exchange — used by dashboard Scraper Health panel (US-010)
      if (path === '/api/scraper/health') {
        const scraper = getScraperService();
        return json(res, { health: scraper.getExchangeHealth() });
      }

      // Ranked trade candidates across all exchanges — used by dashboard + auto-loop (US-013)
      if (path === '/api/agent/candidates') {
        const { aggregateSignals } = await import('../agent/strategies/index.js');
        const scraper = getScraperService();
        const topN = parseInt(params.get('topN') || '10');
        const candidates = aggregateSignals(scraper.getExchangeEvents(), { topN: Math.min(Math.max(topN, 1), 50) });
        return json(res, { candidates });
      }

      // Agent Command Center: skills registry — enumerate all executable skills
      if (path === '/api/agent/skills' && req.method === 'GET') {
        return json(res, { skills: SKILLS, categories: getAllCategories() });
      }

      // Agent Command Center: audit log of all skill runs
      if (path === '/api/agent/runs' && req.method === 'GET') {
        const limit = Math.min(parseInt(params.get('limit') || '50'), 200);
        const filterRaw = params.get('filter');
        const filter = filterRaw === 'user' || filterRaw === 'agent' || filterRaw === 'chain' ? filterRaw : undefined;
        return json(res, { runs: getRuns(limit, filter) });
      }

      // Agent Command Center: invoke a skill by id
      // Body: { args: {...}, confirmed?: boolean, source?: 'user'|'agent'|'chain', chainId?: string }
      if (path.startsWith('/api/agent/skills/') && path.endsWith('/invoke') && req.method === 'POST') {
        const skillId = path.slice('/api/agent/skills/'.length, -('/invoke'.length));
        const skill = getSkill(skillId);
        if (!skill) return error(res, `Unknown skill: ${skillId}`, 404, 'SKILL_NOT_FOUND');

        const body = await readBody(req);
        const parsed = body ? JSON.parse(body) : {};
        const skillArgs: Record<string, string | number> = parsed.args ?? {};
        const confirmed: boolean = parsed.confirmed === true;
        const source: 'user' | 'agent' | 'chain' = parsed.source === 'agent' || parsed.source === 'chain' ? parsed.source : 'user';
        const chainId: string | undefined = typeof parsed.chainId === 'string' ? parsed.chainId : undefined;

        const runId = generateRunId();
        const startedAt = Date.now();

        // Missing-required-arg check
        const missing = skill.args.filter((a) => a.required && (skillArgs[a.name] === undefined || skillArgs[a.name] === '')).map((a) => a.name);
        if (missing.length) {
          const run = {
            runId, skillId: skill.id, skillName: skill.name, args: skillArgs,
            command: skill.commandTemplate, source, status: 'failed' as const,
            output: `Missing required args: ${missing.join(', ')}`,
            startedAt, durationMs: Date.now() - startedAt, chainId,
          };
          recordRun(run);
          return json(res, { runId, status: 'failed', output: run.output, durationMs: run.durationMs });
        }

        // Destructive confirmation gate
        if (skill.destructive && skill.requiresConfirmation && !confirmed) {
          const run = {
            runId, skillId: skill.id, skillName: skill.name, args: skillArgs,
            command: renderCommand(skill, skillArgs), source, status: 'blocked' as const,
            output: `Confirmation required (word: ${skill.confirmWord ?? skill.id})`,
            startedAt, durationMs: Date.now() - startedAt, chainId,
          };
          recordRun(run);
          return json(res, { runId, status: 'blocked', reason: 'confirmation_required', confirmWord: skill.confirmWord, output: run.output });
        }

        // Render and execute
        const command = renderCommand(skill, skillArgs);
        let status: 'ok' | 'failed' = 'ok';
        let output = '';
        let action: string | null = null;
        try {
          // Hardcoded routes for skills that map to gateway endpoints rather than the intent router
          if (skill.id === 'panic') {
            const flattened = panicFlatten();
            output = `PANIC — flattened ${flattened.flattened.length} position(s), realized $${flattened.totalPnL.toFixed(2)}`;
            action = 'panic';
            broadcast('positions', { positions: [] });
          } else if (skill.id === 'autoloop') {
            const enabled = String(skillArgs.enabled).toLowerCase() === 'on';
            const minutes = Math.max(1, Number(skillArgs.minutes ?? 5));
            // Delegate to the existing /api/agent/autoloop endpoint logic by calling harness directly if available
            const h = harness as unknown as { startAutoLoop?: (m: number) => void; stopAutoLoop?: () => void };
            if (enabled) h.startAutoLoop?.(minutes);
            else h.stopAutoLoop?.();
            output = `Auto-loop ${enabled ? `enabled (every ${minutes}m)` : 'disabled'}`;
            action = 'autoloop';
          } else if (skill.id === 'candidates') {
            const { aggregateSignals } = await import('../agent/strategies/index.js');
            const scraper = getScraperService();
            const topN = Math.min(Math.max(Number(skillArgs.topN ?? 10), 1), 50);
            const candidates = aggregateSignals(scraper.getExchangeEvents(), { topN });
            output = `Top ${candidates.length} candidates:\n${candidates.map((c, i) => `${i + 1}. ${c.symbol} (${c.exchange}) · score ${c.score} · ${c.side} @ ${c.entryPrice}`).join('\n')}`;
            action = 'candidates';
          } else {
            // Route through the intent router (same path as /api/command)
            const intent = await routeIntent(command, { harness, broadcast });
            if (intent) {
              output = intent.reply;
              action = intent.action;
            } else {
              status = 'failed';
              output = `Intent router could not execute: "${command}". Check args.`;
            }
          }
        } catch (err) {
          status = 'failed';
          output = `Error: ${err instanceof Error ? err.message : String(err)}`;
        }

        const durationMs = Date.now() - startedAt;
        recordRun({
          runId, skillId: skill.id, skillName: skill.name, args: skillArgs,
          command, source, status, output, startedAt, durationMs, chainId,
        });
        broadcast('run', { runId, skillId: skill.id, status, output, durationMs });
        return json(res, { runId, status, output, action, durationMs });
      }

      // Agent Command Center: live dashboard snapshot the agent can read before acting.
      // Gives the LLM (and UI flow visualizer) a single JSON view of harness state:
      // mode, risk, open positions, connectors, recent activity, enabled rails.
      if (path === '/api/agent/context' && req.method === 'GET') {
        const risk = getRiskState();
        const scraper = getScraperService();
        const health = scraper.getExchangeHealth();
        const lastRuns = getRuns(10);
        const modeLock = readModeLock();
        const appConfigCtx = loadConfig();
        const enabledRails = appConfigCtx?.rails
          ? Object.entries(appConfigCtx.rails).filter(([, v]) => v.enabled).map(([k]) => k)
          : [];
        return json(res, {
          mode: appConfigCtx?.tradingMode || 'paper-only',
          modeLock,
          tradingHalted: isTradingHalted(),
          risk: {
            equity: getEquity(),
            dailyPnL: risk.dailyPnL,
            openPositions: risk.openPositions.length,
            dailyTrades: risk.dailyTrades,
          },
          positions: risk.openPositions,
          scraperHealth: health.map((h) => ({
            name: h.exchange,
            ok: h.status !== 'red',
            status: h.status,
            count: h.count,
            ageSec: h.ageSec,
            lastUpdate: h.lastUpdate,
          })),
          rails: enabledRails,
          recentRuns: lastRuns,
          skills: SKILLS.map((s) => ({
            id: s.id,
            name: s.name,
            category: s.category,
            destructive: s.destructive,
          })),
          aiProviders: listSavedProviders(),
          timestamp: Date.now(),
        });
      }

      // Agent Command Center: proactive suggestions based on current state.
      // Returns up to 5 ranked skill suggestions with reasoning. Surfaced in the UI
      // so the user sees "Top of mind: review panic if daily drawdown > X".
      if (path === '/api/agent/suggest' && req.method === 'GET') {
        const risk = getRiskState();
        const scraper = getScraperService();
        const health = scraper.getExchangeHealth();
        const suggestions: Array<{ skillId: string; reason: string; priority: 'high' | 'normal' | 'low' }> = [];

        // Dead scrapers? Surface risk check before trading
        const deadScrapers = health.filter((e) => e.status === 'red');
        if (deadScrapers.length > 0) {
          suggestions.push({
            skillId: 'risk',
            reason: `${deadScrapers.length} scraper(s) offline: ${deadScrapers.map((e) => e.exchange).join(', ')}. Check risk state first.`,
            priority: 'high',
          });
        }

        // No positions yet? Nudge toward scanning
        if (risk.openPositions.length === 0) {
          suggestions.push({
            skillId: 'candidates',
            reason: 'No open positions. Run ranked candidates to find cross-venue edges.',
            priority: 'normal',
          });
        }

        // Drawdown — surface panic as an option (not executed, just visible)
        if (risk.dailyPnL < -500) {
          suggestions.push({
            skillId: 'panic',
            reason: `Daily P&L is $${risk.dailyPnL.toFixed(2)}. Panic-flatten is available if drawdown continues.`,
            priority: 'high',
          });
        }

        // Many open positions? Suggest inspect
        if (risk.openPositions.length >= 3) {
          suggestions.push({
            skillId: 'positions',
            reason: `${risk.openPositions.length} open positions. Review each for profit-taking.`,
            priority: 'normal',
          });
        }

        // No AI provider? Suggest onboard
        const providers = listSavedProviders();
        if (providers.length === 0) {
          suggestions.push({
            skillId: 'onboard',
            reason: 'No AI provider configured. Run onboarding to enable LLM-backed analysis.',
            priority: 'high',
          });
        }

        // Always include "scan" as default exploration
        if (suggestions.length < 3) {
          suggestions.push({
            skillId: 'scan',
            reason: 'Scan live markets for ranked opportunities.',
            priority: 'low',
          });
        }

        return json(res, { suggestions: suggestions.slice(0, 5), timestamp: Date.now() });
      }

      // Agent Command Center: run a chain of skills sequentially (US-009).
      // Body: { steps: Array<{ skillId, args, confirmed?: boolean }>, dryRun?: boolean }
      // Response: { chainId, steps: Array<{skillId, status, output, runId?}> }
      // A chain aborts at the first `failed` or `blocked` step. Destructive skills
      // must be pre-confirmed by passing confirmed:true on each step.
      if (path === '/api/agent/chains/run' && req.method === 'POST') {
        const body = await readBody(req);
        const parsed = body ? JSON.parse(body) : {};
        const steps = Array.isArray(parsed.steps) ? parsed.steps : [];
        const dryRun = parsed.dryRun === true;
        if (steps.length === 0) return error(res, 'steps array required', 400);
        if (steps.length > 6) return error(res, 'max 6 steps per chain', 400);

        const chainId = `chain-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const results: Array<{ skillId: string; status: string; output: string; runId?: string; args: Record<string, unknown> }> = [];
        let previousOutput = '';

        broadcast('chain:start', { chainId, stepCount: steps.length });

        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          const skill = getSkill(step.skillId);
          if (!skill) {
            results.push({ skillId: step.skillId, status: 'failed', output: `Unknown skill: ${step.skillId}`, args: step.args ?? {} });
            broadcast('chain:step', { chainId, index: i, skillId: step.skillId, status: 'failed' });
            break;
          }

          // Resolve template tokens: {previous.output} → last step's output
          const resolvedArgs: Record<string, string | number> = {};
          for (const [k, v] of Object.entries(step.args ?? {})) {
            if (typeof v === 'string' && v.includes('{previous.output}')) {
              resolvedArgs[k] = v.replace(/\{previous\.output\}/g, previousOutput.slice(0, 200));
            } else {
              resolvedArgs[k] = v as string | number;
            }
          }

          broadcast('chain:step:start', { chainId, index: i, skillId: skill.id, args: resolvedArgs });

          if (dryRun) {
            results.push({
              skillId: skill.id,
              status: 'dry-run',
              output: `[dry] would run: ${renderCommand(skill, resolvedArgs)}`,
              args: resolvedArgs,
            });
            broadcast('chain:step', { chainId, index: i, skillId: skill.id, status: 'dry-run' });
            continue;
          }

          // Destructive gate — honour confirmation per step
          const confirmed = step.confirmed === true;
          if (skill.destructive && skill.requiresConfirmation && !confirmed) {
            const runId = generateRunId();
            const output = `Confirmation required (word: ${skill.confirmWord ?? skill.id})`;
            recordRun({
              runId, skillId: skill.id, skillName: skill.name, args: resolvedArgs,
              command: renderCommand(skill, resolvedArgs), source: 'chain',
              status: 'blocked', output, startedAt: Date.now(), durationMs: 0, chainId,
            });
            results.push({ skillId: skill.id, status: 'blocked', output, runId, args: resolvedArgs });
            broadcast('chain:step', { chainId, index: i, skillId: skill.id, status: 'blocked' });
            break;
          }

          // Missing-required-arg check
          const missing = skill.args.filter((a) => a.required && (resolvedArgs[a.name] === undefined || resolvedArgs[a.name] === '')).map((a) => a.name);
          if (missing.length) {
            const runId = generateRunId();
            const output = `Missing required args: ${missing.join(', ')}`;
            recordRun({
              runId, skillId: skill.id, skillName: skill.name, args: resolvedArgs,
              command: skill.commandTemplate, source: 'chain',
              status: 'failed', output, startedAt: Date.now(), durationMs: 0, chainId,
            });
            results.push({ skillId: skill.id, status: 'failed', output, runId, args: resolvedArgs });
            broadcast('chain:step', { chainId, index: i, skillId: skill.id, status: 'failed' });
            break;
          }

          // Execute via same path as invoke endpoint
          const command = renderCommand(skill, resolvedArgs);
          const runId = generateRunId();
          const startedAt = Date.now();
          let status: 'ok' | 'failed' = 'ok';
          let output = '';
          try {
            if (skill.id === 'panic') {
              const flattened = panicFlatten();
              output = `PANIC — flattened ${flattened.flattened.length} position(s), realized $${flattened.totalPnL.toFixed(2)}`;
              broadcast('positions', { positions: [] });
            } else if (skill.id === 'candidates') {
              const { aggregateSignals } = await import('../agent/strategies/index.js');
              const scraper = getScraperService();
              const topN = Math.min(Math.max(Number(resolvedArgs.topN ?? 10), 1), 50);
              const candidates = aggregateSignals(scraper.getExchangeEvents(), { topN });
              output = `Top ${candidates.length} candidates:\n${candidates.map((c, idx) => `${idx + 1}. ${c.symbol} (${c.exchange}) · score ${c.score}`).join('\n')}`;
            } else {
              const intent = await routeIntent(command, { harness, broadcast });
              if (intent) {
                output = intent.reply;
              } else {
                status = 'failed';
                output = `Intent router could not execute: "${command}"`;
              }
            }
          } catch (err) {
            status = 'failed';
            output = `Error: ${err instanceof Error ? err.message : String(err)}`;
          }

          const durationMs = Date.now() - startedAt;
          recordRun({
            runId, skillId: skill.id, skillName: skill.name, args: resolvedArgs,
            command, source: 'chain', status, output, startedAt, durationMs, chainId,
          });
          results.push({ skillId: skill.id, status, output, runId, args: resolvedArgs });
          broadcast('chain:step', { chainId, index: i, skillId: skill.id, status });
          previousOutput = output;

          if (status === 'failed') break;
        }

        broadcast('chain:complete', { chainId, stepsRun: results.length });
        return json(res, { chainId, steps: results, dryRun });
      }

      // Force refresh all scraped data
      if ((path === '/api/scraper/refresh') && req.method === 'POST') {
        const scraper = getScraperService();
        await scraper.forceRefresh();
        return json(res, { ok: true, ...scraper.getSnapshot() });
      }

      // Update scraper watchlist
      if ((path === '/api/scraper/watchlist') && req.method === 'POST') {
        const body = await readBody(req);
        const { symbols } = JSON.parse(body);
        if (!Array.isArray(symbols)) return error(res, 'symbols must be an array');
        const scraper = getScraperService();
        scraper.setWatchlist(symbols);
        return json(res, { ok: true, watchlist: scraper.getWatchlist() });
      }

      if (path === '/api/scraper/watchlist' && req.method === 'GET') {
        const scraper = getScraperService();
        return json(res, { watchlist: scraper.getWatchlist() });
      }

      // Any unmatched API / agent / AI / x402 path must 404 as JSON — never fall through to the SPA.
      if (
        path.startsWith('/api/') ||
        path.startsWith('/agent/') ||
        path.startsWith('/ai/') ||
        path.startsWith('/x402/') ||
        protectedExact.includes(path)
      ) {
        return error(res, 'Not found', 404, 'NOT_FOUND');
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

      return error(res, 'Not found', 404, 'NOT_FOUND');
    } catch (err) {
      console.error('Gateway error:', err);
      const e = err as Error & { code?: string; status?: number };
      let status = typeof e.status === 'number' ? e.status : 500;
      let code = e.code || (status === 500 ? 'INTERNAL' : 'ERROR');
      // Malformed JSON body → 400
      if (err instanceof SyntaxError) {
        status = 400;
        code = 'BAD_JSON';
      }
      return error(res, e.message || 'Internal error', status, code);
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  });

  // Catch unhandled errors on the HTTP server itself
  server.on('clientError', (err, socket) => {
    console.error('Gateway clientError:', err);
    try {
      socket.end('HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\n\r\n{"error":"Bad Request","code":"BAD_REQUEST"}');
    } catch {
      // socket already destroyed
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
    const client: WebSocketClient = { socket, isAlive: true, missedPings: 0, id: clientId };
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

      // Drain as many complete frames as are buffered
      while (true) {
        const parsed = decodeWebSocketFrameWithSize(buffer);
        if (!parsed) return;

        const { frame, consumed } = parsed;
        buffer = buffer.subarray(consumed);

        if (frame.opcode === 0x08) {
          wsClients.delete(client);
          socket.end();
          return;
        }

        if (frame.opcode === 0x09) {
          const pong = Buffer.alloc(2);
          pong[0] = 0x8a;
          pong[1] = 0x00;
          socket.write(pong);
          continue;
        }

        if (frame.opcode === 0x0a) {
          client.isAlive = true;
          client.missedPings = 0;
          continue;
        }

        if (frame.opcode === 0x01) {
          // Any text frame from a client also proves liveness
          client.isAlive = true;
          client.missedPings = 0;
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

  // WebSocket heartbeat to detect dead connections.
  // Each tick, clients who haven't responded since the last ping have their missedPings
  // counter bumped; when they hit WS_MAX_MISSED_PINGS consecutive misses, we evict them.
  const wsHeartbeat = setInterval(() => {
    for (const client of wsClients) {
      if (!client.isAlive) {
        client.missedPings += 1;
        if (client.missedPings >= WS_MAX_MISSED_PINGS) {
          console.warn(`[WS] Evicting unresponsive client ${client.id} (${client.missedPings} missed pings)`);
          wsClients.delete(client);
          try {
            client.socket.destroy();
          } catch {
            // ignore
          }
          continue;
        }
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
        server.listen(port, host, async () => {
          const badge = getModeBadge();

          // Start the scraper service and wire events to broadcast
          const scraper = getScraperService();
          scraper.on('prices', (prices) => broadcast('prices', prices));
          scraper.on('news', (news) => {
            broadcast('news', news);
            // Also push individual items as feed events for the dashboard
            for (const item of news.slice(0, 5)) {
              broadcast('feed', {
                id: item.id,
                title: item.title,
                summary: item.summary,
                source: item.source,
                url: item.url,
                age: item.age,
                category: item.category,
                tickers: item.tickers,
                sentiment: item.sentiment,
              });
            }
          });
          scraper.on('exchanges', (events) => broadcast('exchanges', events));
          await scraper.start().catch((err) => console.error('[Scraper] Start error:', err));
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

      // Stop the scraper service — it owns price/news/exchange intervals
      // that otherwise keep the event loop alive and hang test runs.
      try {
        getScraperService().stop();
      } catch {
        // Scraper may not have started (e.g. test that never hit its endpoints)
      }

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
