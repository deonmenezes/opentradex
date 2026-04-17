#!/usr/bin/env node
/**
 * OpenTradex Trading Plugin — key storage.
 * Stores exchange API credentials at ~/.claude/opentradex/keys.json (0600).
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const DIR = join(homedir(), '.claude', 'opentradex');
const FILE = join(DIR, 'keys.json');

function ensureDir() {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true, mode: 0o700 });
  try { chmodSync(DIR, 0o700); } catch { /* windows — best effort */ }
}

export function readKeys() {
  try {
    if (!existsSync(FILE)) return {};
    return JSON.parse(readFileSync(FILE, 'utf8')) || {};
  } catch {
    return {};
  }
}

export function writeKey(rail, fields) {
  ensureDir();
  const current = readKeys();
  const existing = current[rail] ?? {};
  current[rail] = { ...existing, ...fields };
  writeFileSync(FILE, JSON.stringify(current, null, 2), { mode: 0o600 });
  try { chmodSync(FILE, 0o600); } catch { /* windows — best effort */ }
}

export function deleteKey(rail) {
  const current = readKeys();
  if (!current[rail]) return false;
  delete current[rail];
  writeFileSync(FILE, JSON.stringify(current, null, 2), { mode: 0o600 });
  return true;
}

export function enabledRails() {
  return Object.keys(readKeys());
}

export function keysPath() {
  return FILE;
}
