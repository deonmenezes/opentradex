import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateSignals, predictionStrategy, cryptoMomentumStrategy } from './index.js';
import type { ScrapedExchangeEvent } from '../../scraper/types.js';

function predMarket(exchange: string, title: string, yesPrice: number): ScrapedExchangeEvent {
  return {
    id: `${exchange}-${title}`,
    exchange,
    symbol: title.replace(/\s/g, '-'),
    title,
    price: yesPrice,
    yesPrice,
    noPrice: 1 - yesPrice,
    volume: 1000,
    category: 'prediction',
    timestamp: Date.now(),
  };
}

test('prediction strategy flags ≥10pp divergence', () => {
  const markets = [
    predMarket('kalshi',    'Will Trump win 2028 election', 0.60),
    predMarket('polymarket', 'Will Donald Trump win the 2028 election', 0.50),
    predMarket('manifold',   'Trump 2028 election winner', 0.45),
  ];
  const result = predictionStrategy(markets[0], { allMarkets: markets });
  assert.ok(result, 'expected a signal');
  assert.ok(result!.score > 0);
  assert.equal(result!.side, 'no', 'kalshi overpriced vs consensus → NO side');
});

test('prediction strategy returns null when divergence <10pp', () => {
  const markets = [
    predMarket('kalshi',     'Will Trump win 2028 election', 0.52),
    predMarket('polymarket', 'Will Donald Trump win the 2028 election', 0.50),
  ];
  const result = predictionStrategy(markets[0], { allMarkets: markets });
  assert.equal(result, null);
});

test('crypto momentum picks up high-notional movers', () => {
  const m: ScrapedExchangeEvent = {
    id: 'binance-BTC',
    exchange: 'binance',
    symbol: 'BTC',
    title: 'BTC 24h',
    price: 60_000,
    volume: 20_000, // $1.2B notional
    category: 'crypto',
    timestamp: Date.now(),
  };
  const result = cryptoMomentumStrategy(m);
  assert.ok(result);
  assert.ok(result!.score >= 40);
  assert.equal(result!.side, 'buy');
});

test('aggregator returns top-N ranked by score', () => {
  const markets = [
    predMarket('kalshi',      'Test one market question', 0.70),
    predMarket('polymarket',  'Test one market question', 0.40),
    predMarket('manifold',    'Test one market question', 0.45),
    {
      id: 'binance-ETH',
      exchange: 'binance',
      symbol: 'ETH',
      title: 'ETH 24h',
      price: 3_000,
      volume: 500_000,
      category: 'crypto',
      timestamp: Date.now(),
    } as ScrapedExchangeEvent,
  ];
  const top = aggregateSignals(markets, { topN: 5 });
  assert.ok(top.length >= 1);
  for (let i = 1; i < top.length; i++) {
    assert.ok(top[i - 1].score >= top[i].score, 'must be sorted desc');
  }
});
