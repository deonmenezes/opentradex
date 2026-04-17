#!/usr/bin/env node
/**
 * OpenTradex Trading Plugin — CLI dispatcher.
 * All skills/agents call:  node bin/tradex.js <subcommand> [args...]
 *
 * Subcommands:
 *   help
 *   onboard               interactive-friendly stdin key entry
 *   status                enabled rails + ledger path
 *   scan [rail] [limit]   list markets on enabled rails
 *   buy   <rail> <symbol> <qty> [price]
 *   sell  <id> [price]
 *   positions             list open paper positions
 *   trades                list realized trades
 *   risk                  daily P&L snapshot
 *   panic                 flatten all open positions at last mark
 *   keys                  list saved rails (redacted)
 *   keys-delete <rail>    remove saved credentials for a rail
 */
import { readKeys, writeKey, deleteKey, enabledRails, keysPath } from '../lib/keys.js';
import {
  openPosition, closePosition, listPositions, listTrades,
  markToMarket, dailyPnl, setPanicCooldown, getPanicCooldown, ledgerPath,
} from '../lib/ledger.js';
import { scan as kalshiScan, order as kalshiOrder } from '../rails/kalshi.js';
import { scan as polyScan, order as polyOrder } from '../rails/polymarket.js';
import { scan as alpacaScan, order as alpacaOrder } from '../rails/alpaca.js';
import { scan as cbScan, order as cbOrder } from '../rails/coinbase.js';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';

const RAILS = {
  kalshi: { scan: kalshiScan, order: kalshiOrder, label: 'Kalshi' },
  polymarket: { scan: polyScan, order: polyOrder, label: 'Polymarket' },
  alpaca: { scan: alpacaScan, order: alpacaOrder, label: 'Alpaca' },
  coinbase: { scan: cbScan, order: cbOrder, label: 'Coinbase' },
};

function out(obj) {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
}

function fail(msg, extra = {}) {
  process.stdout.write(JSON.stringify({ ok: false, error: msg, ...extra }, null, 2) + '\n');
  process.exit(1);
}

function help() {
  out({
    ok: true,
    plugin: 'opentradex-trade',
    version: '1.0.0',
    rails: Object.keys(RAILS),
    subcommands: [
      'help', 'onboard', 'status',
      'scan [rail] [limit]',
      'buy <rail> <symbol> <qty> [price]',
      'sell <position-id> [price]',
      'positions', 'trades', 'risk', 'panic',
      'keys', 'keys-delete <rail>',
    ],
    paperOnly: true,
  });
}

function redact(keys) {
  const out = {};
  for (const [rail, fields] of Object.entries(keys)) {
    const redacted = {};
    for (const [k, v] of Object.entries(fields || {})) {
      if (v == null) { redacted[k] = null; continue; }
      const s = String(v);
      redacted[k] = s.length <= 6 ? '***' : `${s.slice(0, 3)}…${s.slice(-3)}`;
    }
    out[rail] = redacted;
  }
  return out;
}

async function onboard() {
  const rl = createInterface({ input, output });
  const ask = async (q) => (await rl.question(q)).trim();
  const saved = [];
  try {
    output.write('OpenTradex onboarding — paper trading only. Leave blank to skip any rail.\n');
    const kApi = await ask('Kalshi API key (blank to skip): ');
    if (kApi) { writeKey('kalshi', { apiKey: kApi }); saved.push('kalshi'); }

    const pApi = await ask('Polymarket API key (blank to skip): ');
    if (pApi) { writeKey('polymarket', { apiKey: pApi }); saved.push('polymarket'); }

    const aKey = await ask('Alpaca key (blank to skip): ');
    if (aKey) {
      const aSec = await ask('Alpaca secret: ');
      writeKey('alpaca', { apiKey: aKey, apiSecret: aSec });
      saved.push('alpaca');
    }

    const cKey = await ask('Coinbase key (blank to skip): ');
    if (cKey) {
      const cSec = await ask('Coinbase secret: ');
      writeKey('coinbase', { apiKey: cKey, apiSecret: cSec });
      saved.push('coinbase');
    }
  } finally {
    rl.close();
  }
  out({ ok: true, saved, keysPath: keysPath() });
}

async function scanCmd(railName, limitStr) {
  const limit = Number(limitStr) || 10;
  const enabled = enabledRails();
  const targets = railName ? [railName] : enabled;
  if (!targets.length) {
    return out({ ok: true, markets: [], note: 'No rails enabled. Run: node bin/tradex.js onboard' });
  }
  const markets = [];
  for (const rail of targets) {
    const def = RAILS[rail];
    if (!def) continue;
    const creds = readKeys()[rail] || {};
    try {
      const rows = await def.scan({ creds, limit });
      for (const r of rows) markets.push({ rail, ...r });
    } catch (e) {
      markets.push({ rail, error: String(e.message || e) });
    }
  }
  out({ ok: true, markets });
}

async function buyCmd(rail, symbol, qtyStr, priceStr) {
  if (!rail || !symbol || !qtyStr) return fail('usage: buy <rail> <symbol> <qty> [price]');
  const def = RAILS[rail];
  if (!def) return fail(`unknown rail: ${rail}`, { rails: Object.keys(RAILS) });
  const qty = Number(qtyStr);
  const price = priceStr != null ? Number(priceStr) : undefined;
  const creds = readKeys()[rail] || {};
  const fill = await def.order({ creds, symbol, side: 'buy', qty, price });
  const pos = openPosition(rail, symbol, 'buy', qty, fill.price);
  out({ ok: true, position: pos, fill });
}

async function sellCmd(id, priceStr) {
  if (!id) return fail('usage: sell <position-id> [price]');
  const price = priceStr != null ? Number(priceStr) : null;
  const result = closePosition(id, price);
  if (!result) return fail(`position not found: ${id}`);
  out({ ok: true, ...result });
}

function positionsCmd() {
  out({ ok: true, positions: listPositions() });
}

function tradesCmd() {
  out({ ok: true, trades: listTrades().slice(-50) });
}

function riskCmd() {
  const positions = listPositions();
  const pnl = dailyPnl();
  const exposure = positions.reduce((a, p) => a + Math.abs(p.qty * (p.mark || p.entry)), 0);
  out({
    ok: true,
    openPositions: positions.length,
    exposure: Number(exposure.toFixed(2)),
    dailyRealized: Number(pnl.realized.toFixed(2)),
    dailyUnrealized: Number(pnl.unrealized.toFixed(2)),
    dailyTotal: Number(pnl.total.toFixed(2)),
    panicCooldown: getPanicCooldown(),
  });
}

async function panicCmd() {
  const positions = listPositions();
  const closed = [];
  for (const p of positions) {
    const result = closePosition(p.id, p.mark);
    if (result) closed.push(result);
  }
  setPanicCooldown(Date.now() + 30 * 60 * 1000); // 30-min cooldown
  out({ ok: true, flattened: closed.length, closed, cooldownUntil: getPanicCooldown() });
}

function statusCmd() {
  out({
    ok: true,
    enabledRails: enabledRails(),
    keysPath: keysPath(),
    ledgerPath: ledgerPath(),
    openPositions: listPositions().length,
    panicCooldown: getPanicCooldown(),
  });
}

function keysCmd() {
  out({ ok: true, keys: redact(readKeys()), keysPath: keysPath() });
}

function keysDeleteCmd(rail) {
  if (!rail) return fail('usage: keys-delete <rail>');
  const removed = deleteKey(rail);
  out({ ok: true, removed, rail });
}

async function main() {
  const [, , cmd, ...args] = process.argv;
  try {
    switch (cmd) {
      case undefined:
      case 'help': case '-h': case '--help': return help();
      case 'onboard': return await onboard();
      case 'status': return statusCmd();
      case 'scan': return await scanCmd(args[0], args[1]);
      case 'buy': return await buyCmd(args[0], args[1], args[2], args[3]);
      case 'sell': return await sellCmd(args[0], args[1]);
      case 'positions': return positionsCmd();
      case 'trades': return tradesCmd();
      case 'risk': return riskCmd();
      case 'panic': return await panicCmd();
      case 'keys': return keysCmd();
      case 'keys-delete': return keysDeleteCmd(args[0]);
      default: return fail(`unknown subcommand: ${cmd}`);
    }
  } catch (e) {
    fail(String(e.message || e));
  }
}

main();
