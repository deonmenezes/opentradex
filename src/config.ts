/** Configuration management for OpenTradex */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

// Directory paths
export const CONFIG_DIR = join(homedir(), '.opentradex');
export const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
export const MODE_LOCK_FILE = join(CONFIG_DIR, 'mode.lock');
export const AUTH_FILE = join(CONFIG_DIR, 'auth.json');
export const AUDIT_DIR = join(CONFIG_DIR, 'audit');
export const SKILLS_DIR = join(CONFIG_DIR, 'skills');

/** Trading mode - determines what's allowed */
export type TradingMode = 'paper-only' | 'paper-default' | 'live-allowed';

/** Network bind mode for dashboard */
export type BindMode = 'local' | 'lan' | 'tunnel';

/** Rail configuration */
export interface RailConfig {
  enabled: boolean;
  apiKey?: string;
  secretKey?: string;
  privateKey?: string;
  demo?: boolean;
}

/** Risk profile configuration */
export interface RiskProfile {
  startingCapital?: number;
  maxPositionUsd: number;
  maxDailyLossUsd: number;
  maxOpenPositions: number;
  perTradePercent: number;
  dailyDDKill: number; // Daily drawdown % to kill trading
}

/** Full configuration */
export interface OpenTradexConfig {
  version: number;
  tradingMode: TradingMode;
  bindMode: BindMode;
  port: number;
  rails: {
    kalshi: RailConfig;
    polymarket: RailConfig;
    alpaca: RailConfig;
    oanda: RailConfig;
  };
  feeds: {
    x?: { apiKey?: string; apiSecret?: string };
    reddit?: { clientId?: string; clientSecret?: string };
    rss?: { feeds: string[] };
  };
  risk: RiskProfile;
  model: string;
  createdAt: string;
  updatedAt: string;
}

/** Default configuration */
export function defaultConfig(): OpenTradexConfig {
  return {
    version: 1,
    tradingMode: 'paper-only',
    bindMode: 'local',
    port: 3210,
    rails: {
      kalshi: { enabled: true, demo: true },
      polymarket: { enabled: true, demo: true },
      alpaca: { enabled: false, demo: true },
      oanda: { enabled: false, demo: true },
    },
    feeds: {
      rss: { feeds: [] },
    },
    risk: {
      startingCapital: 200000,
      maxPositionUsd: 2000,
      maxDailyLossUsd: 1000,
      maxOpenPositions: 5,
      perTradePercent: 5,
      dailyDDKill: 10,
    },
    model: 'claude-sonnet-4-6',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/** Ensure config directory exists */
export function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  if (!existsSync(AUDIT_DIR)) {
    mkdirSync(AUDIT_DIR, { recursive: true });
  }
  if (!existsSync(SKILLS_DIR)) {
    mkdirSync(SKILLS_DIR, { recursive: true });
  }
}

/** Check if onboarding has been done */
export function isOnboarded(): boolean {
  return existsSync(CONFIG_FILE) && existsSync(MODE_LOCK_FILE);
}

/** Load configuration */
export function loadConfig(): OpenTradexConfig | null {
  if (!existsSync(CONFIG_FILE)) return null;
  try {
    const data = readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(data) as OpenTradexConfig;
  } catch {
    return null;
  }
}

/** Save configuration */
export function saveConfig(config: OpenTradexConfig): void {
  ensureConfigDir();
  config.updatedAt = new Date().toISOString();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

/** Read the trading mode lock */
export function readModeLock(): TradingMode | null {
  if (!existsSync(MODE_LOCK_FILE)) return null;
  try {
    const data = readFileSync(MODE_LOCK_FILE, 'utf-8').trim();
    if (['paper-only', 'paper-default', 'live-allowed'].includes(data)) {
      return data as TradingMode;
    }
    return null;
  } catch {
    return null;
  }
}

/** Write the trading mode lock - IRREVERSIBLE for paper-only */
export function writeModeLock(mode: TradingMode): void {
  ensureConfigDir();
  writeFileSync(MODE_LOCK_FILE, mode);
}

/** Check if live trading is allowed */
export function isLiveAllowed(): boolean {
  const mode = readModeLock();
  return mode === 'live-allowed' || mode === 'paper-default';
}

/** Check if currently in paper mode */
export function isPaperMode(): boolean {
  const mode = readModeLock();
  return mode === 'paper-only' || mode === 'paper-default';
}

/** Generate auth token for non-local bind modes */
export function generateAuthToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Hash a token for storage */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Save auth token (hashed) */
export function saveAuthToken(token: string): void {
  ensureConfigDir();
  const hashed = hashToken(token);
  writeFileSync(AUTH_FILE, JSON.stringify({ hash: hashed, createdAt: new Date().toISOString() }));
}

/** Verify auth token with constant-time comparison (prevents timing attacks) */
export function verifyAuthToken(token: string): boolean {
  if (!existsSync(AUTH_FILE)) return false;
  if (typeof token !== 'string' || token.length === 0) return false;
  try {
    const data = JSON.parse(readFileSync(AUTH_FILE, 'utf-8')) as { hash?: string };
    const stored = data?.hash;
    if (typeof stored !== 'string' || stored.length === 0) return false;

    const a = Buffer.from(stored, 'hex');
    const b = Buffer.from(hashToken(token), 'hex');
    if (a.length !== b.length) {
      // Still do a constant-time compare so timing stays independent of hash length
      timingSafeEqual(b, b);
      return false;
    }
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Revoke all auth tokens */
export function revokeAllTokens(): void {
  if (existsSync(AUTH_FILE)) {
    unlinkSync(AUTH_FILE);
  }
}

/** Get the mode badge text for display */
export function getModeBadge(): { text: string; color: 'green' | 'amber' | 'red' } {
  const mode = readModeLock();
  switch (mode) {
    case 'paper-only':
      return { text: 'PAPER ONLY', color: 'green' };
    case 'paper-default':
      return { text: 'PAPER', color: 'amber' };
    case 'live-allowed':
      return { text: 'LIVE', color: 'red' };
    default:
      return { text: 'NOT CONFIGURED', color: 'amber' };
  }
}

/** Write to audit log */
export function writeAuditLog(entry: Record<string, unknown>): void {
  ensureConfigDir();
  const date = new Date().toISOString().split('T')[0];
  const file = join(AUDIT_DIR, `${date}.jsonl`);
  const line = JSON.stringify({
    ...entry,
    timestamp: new Date().toISOString(),
    mode: readModeLock(),
  }) + '\n';

  try {
    appendFileSync(file, line);
  } catch {
    // Best effort logging
  }
}
