/**
 * AI key persistence — simple JSON store for provider API keys.
 *
 * Lives at ~/.opentradex/ai-keys.json. We hydrate process.env at boot so the
 * existing provider abstractions (which read env) pick up saved keys without
 * any other changes. Keys are written 0600 on POSIX. The desktop app will
 * migrate these into the OS keychain in US-006.
 */

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { CONFIG_DIR, ensureConfigDir } from '../config.js';
import { join } from 'node:path';

export const AI_KEYS_FILE = join(CONFIG_DIR, 'ai-keys.json');

/**
 * Provider name → env var expected by the registry. Keep this in sync with
 * src/ai/providers/registry.ts. The wizard only exposes providers that appear
 * in this map.
 */
export const PROVIDER_ENV: Record<string, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  gemini: 'GOOGLE_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  groq: 'GROQ_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  kimi: 'KIMI_API_KEY',
  glm: 'GLM_API_KEY',
  together: 'TOGETHER_API_KEY',
  xai: 'XAI_API_KEY',
  perplexity: 'PERPLEXITY_API_KEY',
};

export interface AIKeyStore {
  version: 1;
  keys: Record<string, string>;
  /** Optional user-chosen orchestrator provider (e.g. "claude-cli"). Hydrated as OPENTRADEX_ROLE_ORCHESTRATOR at boot. */
  preferredProvider?: string;
  updatedAt: string;
}

function emptyStore(): AIKeyStore {
  return { version: 1, keys: {}, updatedAt: new Date().toISOString() };
}

/** Load the raw on-disk store. Returns an empty store when the file is missing or corrupt. */
export function loadAIKeys(): AIKeyStore {
  if (!existsSync(AI_KEYS_FILE)) return emptyStore();
  try {
    const data = JSON.parse(readFileSync(AI_KEYS_FILE, 'utf-8')) as AIKeyStore;
    if (!data || typeof data !== 'object' || !data.keys) return emptyStore();
    return {
      version: 1,
      keys: { ...data.keys },
      preferredProvider: typeof data.preferredProvider === 'string' ? data.preferredProvider : undefined,
      updatedAt: data.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return emptyStore();
  }
}

/** Write the store atomically-ish, with 0600 perms on POSIX. */
export function writeAIKeys(store: AIKeyStore): void {
  ensureConfigDir();
  const dir = dirname(AI_KEYS_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const next: AIKeyStore = {
    version: 1,
    keys: { ...store.keys },
    preferredProvider: store.preferredProvider,
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(AI_KEYS_FILE, JSON.stringify(next, null, 2));
  try { chmodSync(AI_KEYS_FILE, 0o600); } catch { /* windows / best effort */ }
}

/** Save a single provider's key and hydrate process.env in this process. */
export function saveProviderKey(provider: string, apiKey: string): void {
  const envKey = PROVIDER_ENV[provider];
  if (!envKey) throw new Error(`Unknown provider: ${provider}`);
  if (typeof apiKey !== 'string' || apiKey.trim().length < 8) {
    throw new Error('API key looks too short — double-check what you pasted');
  }
  const store = loadAIKeys();
  store.keys[provider] = apiKey.trim();
  writeAIKeys(store);
  process.env[envKey] = apiKey.trim();
}

/** Remove a provider's key (and clear the env var). */
export function clearProviderKey(provider: string): void {
  const envKey = PROVIDER_ENV[provider];
  const store = loadAIKeys();
  if (store.keys[provider]) {
    delete store.keys[provider];
    writeAIKeys(store);
  }
  if (envKey) delete process.env[envKey];
}

/**
 * Hydrate process.env from the on-disk store. Env vars already set in the
 * parent shell win — we only fill gaps. Call once at boot, before any
 * provider isConfigured() check.
 */
export function hydrateAIKeysFromDisk(): void {
  const store = loadAIKeys();
  for (const [provider, apiKey] of Object.entries(store.keys)) {
    const envKey = PROVIDER_ENV[provider];
    if (!envKey) continue;
    if (!process.env[envKey] && apiKey) {
      process.env[envKey] = apiKey;
    }
  }
  // Restore the user's preferred orchestrator provider (CLI pick from setup wizard).
  // Shell env still wins — we only fill the gap.
  if (store.preferredProvider && !process.env.OPENTRADEX_ROLE_ORCHESTRATOR) {
    process.env.OPENTRADEX_ROLE_ORCHESTRATOR = store.preferredProvider;
  }
}

/** List saved providers (names only, never the key). */
export function listSavedProviders(): string[] {
  return Object.keys(loadAIKeys().keys);
}

/** Save the user's preferred orchestrator provider (usually a CLI pick). Pass null to clear. */
export function setPreferredProvider(provider: string | null): void {
  const store = loadAIKeys();
  if (provider) {
    store.preferredProvider = provider;
    process.env.OPENTRADEX_ROLE_ORCHESTRATOR = provider;
  } else {
    delete store.preferredProvider;
    delete process.env.OPENTRADEX_ROLE_ORCHESTRATOR;
  }
  writeAIKeys(store);
}

/** Read the saved preferred provider (may be undefined). */
export function getPreferredProvider(): string | undefined {
  return loadAIKeys().preferredProvider;
}
