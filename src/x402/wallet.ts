/**
 * x402 wallet — loads the agent's EVM signer for paying 402-gated APIs.
 *
 * Scope A: Base Sepolia testnet only. Set AGENT_PRIVATE_KEY in env (or in
 * ~/.opentradex/config.json under `x402.privateKey`). If absent, x402 is
 * disabled and outbound fetches fall back to unpaid requests.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { CONFIG_FILE, ensureConfigDir } from '../config.js';

export type X402Chain = 'base-sepolia' | 'base';

export interface X402Settings {
  enabled: boolean;
  chain: X402Chain;
  privateKey?: `0x${string}`;
  maxPaymentUsd?: number;
  facilitatorUrl?: string;
}

function readFileSettings(): Partial<X402Settings> {
  if (!existsSync(CONFIG_FILE)) return {};
  try {
    const raw = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    return (raw?.x402 ?? {}) as Partial<X402Settings>;
  } catch {
    return {};
  }
}

export function loadX402Settings(): X402Settings {
  const file = readFileSettings();
  const envKey = process.env.AGENT_PRIVATE_KEY || process.env.X402_PRIVATE_KEY;
  const privateKey = (file.privateKey || envKey) as `0x${string}` | undefined;
  const chain = (file.chain || (process.env.X402_CHAIN as X402Chain) || 'base-sepolia') as X402Chain;
  const maxPaymentUsd = Number(
    file.maxPaymentUsd ?? process.env.X402_MAX_PAYMENT_USD ?? 1
  );
  return {
    enabled: Boolean(privateKey),
    chain,
    privateKey: privateKey && privateKey.startsWith('0x') ? privateKey : undefined,
    maxPaymentUsd: Number.isFinite(maxPaymentUsd) ? maxPaymentUsd : 1,
    facilitatorUrl: file.facilitatorUrl || process.env.X402_FACILITATOR_URL,
  };
}

let cachedSigner: unknown = null;

/**
 * Lazy-load the x402 signer via `createSigner(network, privateKey)`.
 * Returns null when no key is configured so callers can degrade to plain fetch.
 */
export async function getAgentAccount(): Promise<unknown | null> {
  if (cachedSigner) return cachedSigner;
  const settings = loadX402Settings();
  if (!settings.enabled || !settings.privateKey) return null;
  try {
    const mod = await import('x402/types');
    const createSigner = (mod as { createSigner?: (n: string, k: string) => Promise<unknown> }).createSigner;
    if (typeof createSigner !== 'function') {
      console.warn('[x402] createSigner missing from x402/types, payments disabled');
      return null;
    }
    cachedSigner = await createSigner(settings.chain, settings.privateKey);
    return cachedSigner;
  } catch (err) {
    console.warn('[x402] signer init failed, payments disabled:', (err as Error).message);
    return null;
  }
}

/** USDC has 6 decimals on Base/Base Sepolia. */
export function usdcBaseUnits(usd: number): bigint {
  const cents = Math.round(Math.max(0, usd) * 1_000_000);
  return BigInt(cents);
}

/**
 * Persist x402 settings into ~/.opentradex/config.json under `x402`.
 * Merges with existing config. Pass `privateKey: null` to clear the key.
 */
export function saveX402Settings(
  patch: Omit<Partial<X402Settings>, 'privateKey'> & { privateKey?: `0x${string}` | null }
): X402Settings {
  ensureConfigDir();
  let raw: Record<string, unknown> = {};
  if (existsSync(CONFIG_FILE)) {
    try { raw = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')); } catch { raw = {}; }
  }
  const current = (raw.x402 as Partial<X402Settings>) ?? {};
  const next: Partial<X402Settings> = { ...current };
  if (patch.chain !== undefined) next.chain = patch.chain;
  if (patch.maxPaymentUsd !== undefined) next.maxPaymentUsd = patch.maxPaymentUsd;
  if (patch.facilitatorUrl !== undefined) next.facilitatorUrl = patch.facilitatorUrl;
  if (patch.privateKey === null) delete next.privateKey;
  else if (patch.privateKey !== undefined) next.privateKey = patch.privateKey;
  raw.x402 = next;
  writeFileSync(CONFIG_FILE, JSON.stringify(raw, null, 2), { mode: 0o600 });
  cachedSigner = null;
  return loadX402Settings();
}

/** Generate a fresh testnet/mainnet EVM private key via viem. */
export async function generatePrivateKey(): Promise<`0x${string}`> {
  const mod = await import('viem/accounts');
  return (mod as { generatePrivateKey: () => `0x${string}` }).generatePrivateKey();
}

/** Derive the public 0x address from a key, for display. */
export async function addressFromKey(privateKey: `0x${string}`): Promise<`0x${string}`> {
  const mod = await import('viem/accounts');
  const account = (mod as { privateKeyToAccount: (k: `0x${string}`) => { address: `0x${string}` } }).privateKeyToAccount(privateKey);
  return account.address;
}
