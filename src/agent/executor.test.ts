/** Tests for the Trade Executor - US-001 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Setup temporary home for config isolation
const tmpHome = mkdtempSync(join(tmpdir(), 'ot-executor-test-'));
process.env.HOME = tmpHome;
process.env.USERPROFILE = tmpHome;

// Import executor after setting up env
const { TradeExecutor } = await import('./executor.js');

test.after(() => {
  try {
    rmSync(tmpHome, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
});

test('TradeExecutor: paper-only mode routes to paper trading', async () => {
  const executor = new TradeExecutor('paper-only');
  const result = await executor.executeDirect({
    symbol: 'BTC',
    side: 'buy',
    quantity: 1,
    exchange: 'crypto',
    price: 50000
  });

  assert.equal(result.success, true);
  assert.equal(result.mode, 'paper-only');
  assert.equal(result.symbol, 'BTC');
  assert.equal(result.exchange, 'crypto');
});

test('TradeExecutor: live-allowed mode returns failure for unimplemented live exchange', async () => {
  const executor = new TradeExecutor('live-allowed');
  
  const result = await executor.executeDirect({
    symbol: 'AAPL',
    side: 'buy',
    quantity: 5,
    exchange: 'alpaca',
    price: 150
  });

  // This verifies my fix: it should be an explicit failure now, not a silent paper fill
  assert.equal(result.success, false);
  assert.equal(result.mode, 'live-allowed');
  assert.match(result.error || '', /live trading not implemented/);
});

test('TradeExecutor: events are emitted during order lifecycle', async (t) => {
  const executor = new TradeExecutor('paper-only');
  const orderCreated = t.mock.fn();
  const tradeCompleted = t.mock.fn();

  executor.on('order-created', orderCreated);
  executor.on('trade', tradeCompleted);

  await executor.executeDirect({
    symbol: 'ETH',
    side: 'buy',
    quantity: 10,
    price: 3000
  });

  assert.equal(orderCreated.mock.callCount(), 1);
  assert.equal(tradeCompleted.mock.callCount(), 1);
  
  const order = orderCreated.mock.calls[0].arguments[0];
  assert.equal(order.symbol, 'ETH');
  assert.equal(order.status, 'filled');
});
