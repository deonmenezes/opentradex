/** Tests for the risk engine — US-002 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmpHome = mkdtempSync(join(tmpdir(), 'ot-risk-test-'));
process.env.HOME = tmpHome;
process.env.USERPROFILE = tmpHome;

const { checkRisk, panicFlatten, recordPosition, getRiskState, getOpenPositions } =
  await import('./risk.js');
const { saveConfig, defaultConfig } = await import('./config.js');

// Install a tight risk profile so limits are easy to trigger
const cfg = defaultConfig();
cfg.risk.maxPositionUsd = 1000;
cfg.risk.maxOpenPositions = 2;
cfg.risk.maxDailyLossUsd = 500;
cfg.risk.dailyDDKill = 100;
saveConfig(cfg);

test.after(() => {
  try {
    rmSync(tmpHome, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
});

test('checkRisk: allows a trade within all limits', () => {
  const result = checkRisk({ size: 1, price: 100 });
  assert.equal(result.allowed, true);
});

test('checkRisk: blocks when position value exceeds maxPositionUsd', () => {
  const result = checkRisk({ size: 100, price: 50 }); // $5000 > $1000
  assert.equal(result.allowed, false);
  assert.match(result.reason || '', /exceeds max/);
});

test('checkRisk: warns when position is near limit (80%+)', () => {
  const result = checkRisk({ size: 1, price: 850 }); // 85% of $1000 cap
  assert.equal(result.allowed, true);
  assert.ok(result.warnings.length > 0, 'expected a warning for near-limit position');
});

test('checkRisk: blocks when already at max open positions', () => {
  // Fill positions up to the cap
  for (let i = 0; i < 2; i++) {
    recordPosition({
      exchange: 'crypto',
      symbol: `TEST${i}`,
      side: 'long',
      size: 1,
      avgPrice: 100,
      currentPrice: 100,
      pnl: 0,
      pnlPercent: 0,
    });
  }

  const result = checkRisk({ size: 1, price: 100 });
  assert.equal(result.allowed, false);
  assert.match(result.reason || '', /max open positions/);
});

test('panicFlatten: removes all open positions', () => {
  // At this point the previous test left 2 positions
  assert.ok(getOpenPositions().length >= 2, 'expected open positions before panic');
  const result = panicFlatten();
  assert.ok(Array.isArray(result.flattened));
  assert.equal(getOpenPositions().length, 0);
});

test('getRiskState: returns a snapshot with expected shape', () => {
  const state = getRiskState();
  assert.ok(typeof state.dailyPnL === 'number');
  assert.ok(typeof state.dailyTrades === 'number');
  assert.ok(Array.isArray(state.openPositions));
  assert.ok(typeof state.startingCapital === 'number');
});
