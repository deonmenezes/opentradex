#!/usr/bin/env node
/**
 * OpenTradex Dashboard Server
 * Serves the built React app and proxies to the harness gateway
 */

import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const CLIENT_DIR = join(__dirname, 'client');
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3210';
const PORT = parseInt(process.env.PORT || '3000');
const HOST = process.env.HOST || '0.0.0.0';

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

function serveStatic(res: ServerResponse, filePath: string): boolean {
  const fullPath = join(CLIENT_DIR, filePath);

  if (!existsSync(fullPath)) return false;

  const stat = statSync(fullPath);
  if (!stat.isFile()) return false;

  const ext = extname(fullPath);
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

  res.writeHead(200, { 'Content-Type': mimeType });
  createReadStream(fullPath).pipe(res);
  return true;
}

async function proxyToGateway(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
  try {
    const url = `${GATEWAY_URL}${path}`;
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    if (req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization;
    }

    let body: string | undefined;
    if (req.method === 'POST') {
      body = await new Promise((resolve) => {
        let data = '';
        req.on('data', (chunk) => (data += chunk));
        req.on('end', () => resolve(data));
      });
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method: req.method,
      headers,
      body,
    });

    const data = await response.text();
    res.writeHead(response.status, {
      'Content-Type': response.headers.get('content-type') || 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(data);
  } catch (err) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Gateway unavailable', details: String(err) }));
  }
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url || '/', `http://${HOST}`);
  const path = url.pathname;

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

  // API proxy
  if (path.startsWith('/api/')) {
    const apiPath = path.replace('/api', '');
    await proxyToGateway(req, res, apiPath);
    return;
  }

  // Static files
  if (path !== '/' && serveStatic(res, path)) {
    return;
  }

  // SPA fallback - serve index.html
  const indexPath = join(CLIENT_DIR, 'index.html');
  if (existsSync(indexPath)) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    createReadStream(indexPath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Dashboard not built. Run: npm run build');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   ⚡ OpenTradex Dashboard                                ║
║                                                          ║
║   Dashboard:  http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}                       ║
║   Gateway:    ${GATEWAY_URL}                       ║
║                                                          ║
║   Press Ctrl+C to stop                                   ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
`);
});
