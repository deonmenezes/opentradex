/**
 * Live smoke tests — hit real public APIs and assert each scraper returns
 * non-zero valid markets. Gated by SKIP_LIVE=1 so CI/default test runs skip them.
 *
 * Run with: npm run test:live
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  scrapePolymarket,
  scrapeKalshi,
  scrapeBinanceTickers,
  scrapeCoinbase,
  scrapePredictIt,
  scrapeManifold,
} from './exchanges.js';

const SKIP = process.env.SKIP_LIVE === '1';

function validPriceCount(events: Array<{ price: number }>): number {
  return events.filter((e) => e.price > 0 && Number.isFinite(e.price)).length;
}

test('Polymarket — returns ≥50 open markets with real prices', { skip: SKIP }, async () => {
  const events = await scrapePolymarket(100);
  assert.ok(events.length >= 50, `expected ≥50 markets, got ${events.length}`);
  const valid = validPriceCount(events);
  assert.ok(valid / events.length >= 0.9, `expected ≥90% valid prices, got ${valid}/${events.length}`);
});

test('Kalshi — returns ≥50 open markets with real prices', { skip: SKIP }, async () => {
  const events = await scrapeKalshi(100);
  assert.ok(events.length >= 50, `expected ≥50 markets, got ${events.length}`);
  const valid = validPriceCount(events);
  assert.ok(valid / events.length >= 0.5, `expected ≥50% valid prices (Kalshi has many 0-priced markets), got ${valid}/${events.length}`);
});

test('Binance — returns ≥20 USDT pairs with real prices', { skip: SKIP }, async () => {
  const events = await scrapeBinanceTickers(50);
  assert.ok(events.length >= 20, `expected ≥20 tickers, got ${events.length}`);
  assert.equal(validPriceCount(events), events.length, 'all Binance prices should be non-zero');
});

test('Coinbase — returns ≥5 USD pairs with real prices', { skip: SKIP }, async () => {
  const events = await scrapeCoinbase(10);
  assert.ok(events.length >= 5, `expected ≥5 products, got ${events.length}`);
  assert.equal(validPriceCount(events), events.length, 'all Coinbase prices should be non-zero');
});

test('PredictIt — returns ≥10 open contracts', { skip: SKIP }, async () => {
  const events = await scrapePredictIt();
  assert.ok(events.length >= 10, `expected ≥10 contracts, got ${events.length}`);
  assert.ok(validPriceCount(events) >= 10, 'expected real prices');
});

test('Manifold — returns ≥50 binary markets with real probabilities', { skip: SKIP }, async () => {
  const events = await scrapeManifold(100);
  assert.ok(events.length >= 50, `expected ≥50 markets, got ${events.length}`);
  const valid = events.filter((e) => typeof e.yesPrice === 'number' && e.yesPrice >= 0 && e.yesPrice <= 1);
  assert.ok(valid.length / events.length >= 0.95, `expected ≥95% valid yesPrice, got ${valid.length}/${events.length}`);
});
