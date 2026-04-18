/** Gateway auth tests — US-003: auth is unbypassable in non-local bind modes */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AddressInfo } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Redirect HOME so saveAuthToken writes to a temp dir, not the real user's ~/.opentradex
const tmpHome = mkdtempSync(join(tmpdir(), 'ot-gw-auth-test-'));
process.env.HOME = tmpHome;
process.env.USERPROFILE = tmpHome;

const { createHarness } = await import('../index.js');
const { createGateway } = await import('./index.js');
const { generateAuthToken, saveAuthToken } = await import('../config.js');

type GW = ReturnType<typeof createGateway>;

const VALID_TOKEN = generateAuthToken();
saveAuthToken(VALID_TOKEN);

async function startAuthGateway() {
  const harness = createHarness();
  const gw: GW = createGateway(harness, {
    port: 0,
    host: '127.0.0.1',
    requireAuth: true,
    timeoutMs: 5_000,
  });
  await gw.start();
  const addr = gw.server.address() as AddressInfo;
  const base = `http://127.0.0.1:${addr.port}`;
  return { gw, base };
}

test.after(() => {
  try {
    rmSync(tmpHome, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
});

test('GET /api/scan without token → 401 UNAUTHORIZED', async () => {
  const { gw, base } = await startAuthGateway();
  try {
    const res = await fetch(`${base}/api/scan?exchange=crypto&limit=1`);
    assert.equal(res.status, 401);
    const body = (await res.json()) as { error: string; code: string };
    assert.equal(body.code, 'UNAUTHORIZED');
  } finally {
    await gw.stop();
  }
});

test('GET /api/scan with wrong bearer token → 401', async () => {
  const { gw, base } = await startAuthGateway();
  try {
    const res = await fetch(`${base}/api/scan?exchange=crypto&limit=1`, {
      headers: { Authorization: 'Bearer totally-wrong-token' },
    });
    assert.equal(res.status, 401);
  } finally {
    await gw.stop();
  }
});

test('GET /api/scan with valid bearer token → not 401 (route reachable)', async () => {
  const { gw, base } = await startAuthGateway();
  try {
    const res = await fetch(`${base}/api/scan?exchange=crypto&limit=1`, {
      headers: { Authorization: `Bearer ${VALID_TOKEN}` },
    });
    assert.notEqual(res.status, 401);
    // Scan may 500 (network to real exchange) or 200 — either way, auth passed.
    assert.ok(res.status === 200 || res.status >= 500, `unexpected status ${res.status}`);
  } finally {
    await gw.stop();
  }
});

test('GET /api/scan with valid token as query param → 200-or-reachable', async () => {
  const { gw, base } = await startAuthGateway();
  try {
    const res = await fetch(`${base}/api/scan?exchange=crypto&limit=1&token=${VALID_TOKEN}`);
    assert.notEqual(res.status, 401);
  } finally {
    await gw.stop();
  }
});

test('GET /api/health is accessible without token (health is always open)', async () => {
  const { gw, base } = await startAuthGateway();
  try {
    const res = await fetch(`${base}/api/health`);
    assert.equal(res.status, 200);
  } finally {
    await gw.stop();
  }
});

test('WebSocket upgrade without token is rejected with 401 before client allocation', async () => {
  const { gw, base } = await startAuthGateway();
  try {
    const wsUrl = base.replace('http://', 'ws://') + '/ws';
    // We can't easily construct a raw upgrade with node:fetch; use net module.
    const { connect } = await import('node:net');
    const url = new URL(wsUrl);
    const socket = connect({ host: url.hostname, port: Number(url.port) });

    const response = await new Promise<string>((resolve, reject) => {
      let data = '';
      socket.on('data', (chunk) => {
        data += chunk.toString();
        if (data.includes('\r\n\r\n')) resolve(data);
      });
      socket.on('error', reject);
      socket.on('close', () => resolve(data));

      socket.write(
        'GET /ws HTTP/1.1\r\n' +
          `Host: 127.0.0.1:${url.port}\r\n` +
          'Upgrade: websocket\r\n' +
          'Connection: Upgrade\r\n' +
          'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n' +
          'Sec-WebSocket-Version: 13\r\n' +
          '\r\n'
      );
    });

    assert.match(response, /^HTTP\/1\.1 401/, 'WS upgrade should be rejected with 401');
    socket.destroy();
  } finally {
    await gw.stop();
  }
});

test('WebSocket upgrade with invalid token is rejected with 401', async () => {
  const { gw, base } = await startAuthGateway();
  try {
    const { connect } = await import('node:net');
    const url = new URL(base);
    const socket = connect({ host: url.hostname, port: Number(url.port) });

    const response = await new Promise<string>((resolve, reject) => {
      let data = '';
      socket.on('data', (chunk) => {
        data += chunk.toString();
        if (data.includes('\r\n\r\n')) resolve(data);
      });
      socket.on('error', reject);
      socket.on('close', () => resolve(data));

      socket.write(
        'GET /ws?token=bogus HTTP/1.1\r\n' +
          `Host: 127.0.0.1:${url.port}\r\n` +
          'Upgrade: websocket\r\n' +
          'Connection: Upgrade\r\n' +
          'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n' +
          'Sec-WebSocket-Version: 13\r\n' +
          '\r\n'
      );
    });

    assert.match(response, /^HTTP\/1\.1 401/);
    socket.destroy();
  } finally {
    await gw.stop();
  }
});
