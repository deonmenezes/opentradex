/**
 * x402 payment ledger — append-only JSONL at ~/.opentradex/x402-ledger.jsonl.
 * Every 402 payment the agent makes lands here with the URL, amount, and tx hash.
 */

import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONFIG_DIR, ensureConfigDir } from '../config.js';

export const LEDGER_FILE = join(CONFIG_DIR, 'x402-ledger.jsonl');

export interface LedgerEntry {
  timestamp: string;
  direction: 'out' | 'in';
  url: string;
  amountUsd: number;
  txHash?: string;
  chain: string;
  payer?: string;
  recipient?: string;
  note?: string;
}

export function recordPayment(entry: Omit<LedgerEntry, 'timestamp'>): void {
  ensureConfigDir();
  const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '\n';
  try {
    appendFileSync(LEDGER_FILE, line);
  } catch {
    // Best-effort ledger; never throw from the fetch path.
  }
}

export function readLedger(limit = 100): LedgerEntry[] {
  if (!existsSync(LEDGER_FILE)) return [];
  try {
    const lines = readFileSync(LEDGER_FILE, 'utf-8').trim().split('\n').filter(Boolean);
    const slice = lines.slice(-limit);
    return slice.map((l) => JSON.parse(l) as LedgerEntry);
  } catch {
    return [];
  }
}
