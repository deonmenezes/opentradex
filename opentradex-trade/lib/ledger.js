#!/usr/bin/env node
/**
 * OpenTradex Trading Plugin — paper ledger.
 * Persists positions and realized trades at ~/.claude/opentradex/ledger.json.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const DIR = join(homedir(), '.claude', 'opentradex');
const FILE = join(DIR, 'ledger.json');

function ensureDir() {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
}

function loadLedger() {
  try {
    if (!existsSync(FILE)) return { positions: [], trades: [], panicCooldown: 0 };
    const l = JSON.parse(readFileSync(FILE, 'utf8'));
    return {
      positions: Array.isArray(l.positions) ? l.positions : [],
      trades: Array.isArray(l.trades) ? l.trades : [],
      panicCooldown: Number(l.panicCooldown) || 0,
    };
  } catch {
    return { positions: [], trades: [], panicCooldown: 0 };
  }
}

function saveLedger(ledger) {
  ensureDir();
  writeFileSync(FILE, JSON.stringify(ledger, null, 2));
}

function nextId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function openPosition(rail, symbol, side, qty, price) {
  const l = loadLedger();
  const pos = {
    id: nextId('p'),
    rail, symbol, side, qty: Number(qty), entry: Number(price),
    mark: Number(price), unrealizedPnl: 0,
    openedAt: new Date().toISOString(),
  };
  l.positions.push(pos);
  saveLedger(l);
  return pos;
}

export function closePosition(id, markPrice) {
  const l = loadLedger();
  const idx = l.positions.findIndex((p) => p.id === id);
  if (idx < 0) return null;
  const p = l.positions[idx];
  const exit = markPrice == null ? p.mark : Number(markPrice);
  const dir = p.side === 'buy' || p.side === 'long' || p.side === 'yes' ? 1 : -1;
  const realized = (exit - p.entry) * p.qty * dir;
  l.positions.splice(idx, 1);
  l.trades.push({
    id: nextId('t'),
    rail: p.rail, symbol: p.symbol, side: p.side, qty: p.qty,
    entry: p.entry, exit, pnl: realized,
    openedAt: p.openedAt, closedAt: new Date().toISOString(),
  });
  saveLedger(l);
  return { position: p, pnl: realized };
}

export function listPositions() {
  return loadLedger().positions;
}

export function listTrades() {
  return loadLedger().trades;
}

export function markToMarket(rail, symbol, price) {
  const l = loadLedger();
  let changed = false;
  for (const p of l.positions) {
    if (p.rail === rail && p.symbol === symbol) {
      p.mark = Number(price);
      const dir = p.side === 'buy' || p.side === 'long' || p.side === 'yes' ? 1 : -1;
      p.unrealizedPnl = (p.mark - p.entry) * p.qty * dir;
      changed = true;
    }
  }
  if (changed) saveLedger(l);
}

export function dailyPnl() {
  const l = loadLedger();
  const today = new Date().toISOString().slice(0, 10);
  const realized = l.trades
    .filter((t) => t.closedAt.startsWith(today))
    .reduce((a, t) => a + t.pnl, 0);
  const unrealized = l.positions.reduce((a, p) => a + (p.unrealizedPnl || 0), 0);
  return { realized, unrealized, total: realized + unrealized };
}

export function setPanicCooldown(untilMs) {
  const l = loadLedger();
  l.panicCooldown = untilMs;
  saveLedger(l);
}

export function getPanicCooldown() {
  return loadLedger().panicCooldown;
}

export function ledgerPath() {
  return FILE;
}
