import type { AIProvider, TaskRole } from './types.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAICompatibleProvider } from './openai-compatible.js';
import { GoogleProvider } from './google.js';
import { ClaudeCLIProvider } from './claude-cli.js';
import { OpenCodeCLIProvider } from './opencode-cli.js';
import { GeminiCLIProvider } from './gemini-cli.js';
import { OllamaProvider } from './ollama.js';
import { detectBinary } from './detect.js';

/**
 * Built-in provider registry. Add a new backend by adding one line here —
 * OpenAI-compatible covers the vast majority of modern LLM APIs.
 */
const PROVIDERS: AIProvider[] = [
  new AnthropicProvider(),
  new OpenAICompatibleProvider('openai',     'https://api.openai.com/v1',              'OPENAI_API_KEY',     'gpt-4o'),
  new OpenAICompatibleProvider('openrouter', 'https://openrouter.ai/api/v1',           'OPENROUTER_API_KEY', 'anthropic/claude-sonnet-4',
    { 'HTTP-Referer': 'https://opentradex.local', 'X-Title': 'OpenTradex' }),
  new OpenAICompatibleProvider('kimi',       'https://api.moonshot.ai/v1',             'KIMI_API_KEY',       'moonshot-v1-32k'),
  new OpenAICompatibleProvider('glm',        'https://open.bigmodel.cn/api/paas/v4',   'GLM_API_KEY',        'glm-4-plus'),
  new OpenAICompatibleProvider('groq',       'https://api.groq.com/openai/v1',         'GROQ_API_KEY',       'llama-3.3-70b-versatile'),
  new OpenAICompatibleProvider('deepseek',   'https://api.deepseek.com/v1',            'DEEPSEEK_API_KEY',   'deepseek-chat'),
  new OpenAICompatibleProvider('together',   'https://api.together.xyz/v1',            'TOGETHER_API_KEY',   'meta-llama/Llama-3.3-70B-Instruct-Turbo'),
  new OpenAICompatibleProvider('xai',        'https://api.x.ai/v1',                    'XAI_API_KEY',        'grok-2-latest'),
  new OpenAICompatibleProvider('perplexity', 'https://api.perplexity.ai',              'PERPLEXITY_API_KEY', 'sonar-pro'),
  new GoogleProvider(),
  new ClaudeCLIProvider(),
  new OpenCodeCLIProvider(),
  new GeminiCLIProvider(),
  new OllamaProvider(),
];

/**
 * Public list of CLI providers the one-click setup flow probes for. Extend
 * this list (plus a new provider class above) to surface a new zero-config
 * tool in the setup wizard.
 */
export interface CLIDetection {
  provider: string;       // provider name as registered above
  binary: string;         // short name probed on PATH (e.g. "claude")
  path: string | null;    // absolute path when found, else null
  available: boolean;     // shorthand: path !== null
  label: string;          // human-readable tile title
  description: string;    // short tagline for the tile
  requiresApiKey: boolean; // CLIs self-auth, so always false today
}

export function detectCLIs(): CLIDetection[] {
  const probes: Array<Omit<CLIDetection, 'path' | 'available'>> = [
    { provider: 'claude-cli',   binary: 'claude',   label: 'Claude Code CLI', description: 'Anthropic CLI — uses your existing Claude subscription or API login', requiresApiKey: false },
    { provider: 'opencode-cli', binary: 'opencode', label: 'OpenCode CLI',    description: 'sst/opencode — orchestrates whatever model you have configured', requiresApiKey: false },
    { provider: 'gemini-cli',   binary: 'gemini',   label: 'Gemini CLI',      description: 'Google Gemini CLI — uses `gemini auth login`',                     requiresApiKey: false },
    { provider: 'ollama',       binary: 'ollama',   label: 'Ollama',          description: 'Local LLM runtime — runs models on your machine, free',            requiresApiKey: false },
  ];
  return probes.map((p) => {
    const path = detectBinary(p.binary);
    return { ...p, path, available: path !== null };
  });
}

/**
 * Role → ordered provider preferences. First configured provider wins.
 * Override any of these via env vars (e.g. OPENTRADEX_ROLE_SPEED=groq).
 */
const DEFAULT_ROLE_PRIORITY: Record<TaskRole, string[]> = {
  orchestrator: ['anthropic', 'claude-cli', 'opencode-cli', 'openrouter', 'openai', 'kimi', 'deepseek', 'gemini', 'glm'],
  reasoning:    ['openai', 'anthropic', 'deepseek', 'openrouter', 'claude-cli', 'opencode-cli'],
  speed:        ['groq', 'kimi', 'gemini', 'deepseek', 'anthropic', 'openai', 'opencode-cli'],
  creative:     ['gemini', 'anthropic', 'openai', 'openrouter', 'claude-cli', 'opencode-cli'],
};

export function listProviders(): AIProvider[] {
  return PROVIDERS.slice();
}

export function configuredProviders(): AIProvider[] {
  return PROVIDERS.filter((p) => p.isConfigured());
}

export function getProvider(name: string): AIProvider | null {
  return PROVIDERS.find((p) => p.name === name) ?? null;
}

export function resolveProviderForRole(role: TaskRole): AIProvider | null {
  const envOverride = process.env[`OPENTRADEX_ROLE_${role.toUpperCase()}`];
  if (envOverride) {
    const p = getProvider(envOverride);
    if (p?.isConfigured()) return p;
  }
  for (const name of DEFAULT_ROLE_PRIORITY[role]) {
    const p = getProvider(name);
    if (p?.isConfigured()) return p;
  }
  return configuredProviders()[0] ?? null;
}

/**
 * Resolve provider by explicit name or by model-string hint (e.g. "gpt-4o" → openai,
 * "claude-*" → anthropic, "gemini-*" → gemini, "provider/model" → that provider).
 */
export function resolveProvider(hint?: string): AIProvider | null {
  if (!hint) return resolveProviderForRole('orchestrator');

  // Explicit provider name
  const direct = getProvider(hint);
  if (direct?.isConfigured()) return direct;

  // "provider/model" form (OpenRouter style)
  const slash = hint.split('/')[0];
  if (slash !== hint) {
    const byPrefix = getProvider(slash);
    if (byPrefix?.isConfigured()) return byPrefix;
  }

  // Model-string prefix heuristics
  if (/^gpt-|^o1-|^o3-/i.test(hint)) return getProvider('openai');
  if (/^claude-/i.test(hint))        return getProvider('anthropic');
  if (/^gemini-/i.test(hint))        return getProvider('gemini');
  if (/^moonshot-|^kimi-/i.test(hint)) return getProvider('kimi');
  if (/^glm-/i.test(hint))           return getProvider('glm');
  if (/^deepseek-/i.test(hint))      return getProvider('deepseek');
  if (/^grok-/i.test(hint))          return getProvider('xai');
  if (/^llama-/i.test(hint))         return getProvider('groq') ?? getProvider('together');
  if (/^opencode\//i.test(hint))     return getProvider('opencode-cli');

  return resolveProviderForRole('orchestrator');
}
