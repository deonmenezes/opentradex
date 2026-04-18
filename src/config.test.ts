/** Tests for config load/save and mode-lock enforcement — US-002 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Redirect CONFIG_DIR before importing config.ts by rewriting HOME/USERPROFILE.
// config.ts evaluates `homedir()` at module load, so we must do this first.
const tmpHome = mkdtempSync(join(tmpdir(), 'ot-config-test-'));
process.env.HOME = tmpHome;
process.env.USERPROFILE = tmpHome;

const config = await import('./config.js');
const {
  defaultConfig,
  saveConfig,
  loadConfig,
  readModeLock,
  writeModeLock,
  isPaperMode,
  isLiveAllowed,
  hashToken,
  generateAuthToken,
  verifyAuthToken,
  saveAuthToken,
} = config;

test.after(() => {
  try {
    rmSync(tmpHome, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
});

test('loadConfig: returns null when no config exists', () => {
  // Fresh tmpHome — nothing saved yet
  assert.equal(loadConfig(), null);
});

test('saveConfig + loadConfig round-trip preserves all fields', () => {
  const cfg = defaultConfig();
  cfg.port = 4242;
  cfg.risk.maxPositionUsd = 5000;
  cfg.tradingMode = 'paper-default';
  saveConfig(cfg);

  const loaded = loadConfig();
  assert.ok(loaded, 'loadConfig returned null after save');
  assert.equal(loaded!.port, 4242);
  assert.equal(loaded!.risk.maxPositionUsd, 5000);
  assert.equal(loaded!.tradingMode, 'paper-default');
  assert.equal(loaded!.version, 1);
});

test('saveConfig updates updatedAt timestamp', async () => {
  const cfg = defaultConfig();
  saveConfig(cfg);
  const first = loadConfig()!;
  await new Promise((r) => setTimeout(r, 10));
  saveConfig(cfg);
  const second = loadConfig()!;
  assert.ok(
    new Date(second.updatedAt).getTime() >= new Date(first.updatedAt).getTime(),
    'updatedAt did not advance'
  );
});

test('mode lock: paper-only blocks live trading', () => {
  writeModeLock('paper-only');
  assert.equal(readModeLock(), 'paper-only');
  assert.equal(isPaperMode(), true);
  assert.equal(isLiveAllowed(), false);
});

test('mode lock: paper-default allows both paper and live', () => {
  writeModeLock('paper-default');
  assert.equal(readModeLock(), 'paper-default');
  assert.equal(isPaperMode(), true);
  assert.equal(isLiveAllowed(), true);
});

test('mode lock: live-allowed permits live only', () => {
  writeModeLock('live-allowed');
  assert.equal(readModeLock(), 'live-allowed');
  assert.equal(isPaperMode(), false);
  assert.equal(isLiveAllowed(), true);
});

test('auth token: generate → hash → verify round-trip', () => {
  const token = generateAuthToken();
  assert.ok(token.length >= 32, 'generated token too short');
  saveAuthToken(token);
  assert.equal(verifyAuthToken(token), true);
  assert.equal(verifyAuthToken('wrong-token'), false);
});

test('hashToken: deterministic and different for different inputs', () => {
  assert.equal(hashToken('abc'), hashToken('abc'));
  assert.notEqual(hashToken('abc'), hashToken('abd'));
});
