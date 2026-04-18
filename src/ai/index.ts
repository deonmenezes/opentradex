/**
 * OpenTradex AI Service — multi-model, provider-agnostic.
 * Inspired by oh-my-openagent: no lock-in, orchestrate any model.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { loadConfig } from '../config.js';
import { getRiskState } from '../risk.js';
import type { AIProvider, AIMessage, ChatOptions, TaskRole } from './providers/types.js';
import {
  configuredProviders,
  getProvider,
  listProviders,
  resolveProvider,
  resolveProviderForRole,
} from './providers/registry.js';
import { hydrateAIKeysFromDisk } from './ai-keys.js';

// Load any keys the user saved via the setup wizard into process.env
// before the first isConfigured() check runs.
hydrateAIKeysFromDisk();

export interface AIConfig {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  systemPrompt?: string;
  provider?: string;
}

export interface AIResponse {
  content: string;
  usage?: { inputTokens: number; outputTokens: number };
  model: string;
  provider?: string;
}

export interface ChatCallOptions {
  role?: TaskRole;
  model?: string;
  provider?: string;
  includeContext?: boolean;
  maxTokens?: number;
}

const PERSONA_FILES = ['soul.md', 'agents.md', 'skills.md', 'cron.md'] as const;

function loadPersona(): string {
  const overrideDir = join(homedir(), '.opentradex', 'persona');
  const bundledDir = join(dirname(fileURLToPath(import.meta.url)), 'persona');
  const parts: string[] = [];
  for (const file of PERSONA_FILES) {
    const override = join(overrideDir, file);
    const bundled = join(bundledDir, file);
    const chosen = existsSync(override) ? override : bundled;
    if (existsSync(chosen)) {
      try {
        parts.push(`\n\n===== ${file.toUpperCase()} =====\n\n${readFileSync(chosen, 'utf8').trim()}`);
      } catch {
        // skip unreadable file
      }
    }
  }
  return parts.join('\n');
}

const GREETING_RULE = `
## First-message behavior

If the user's first message is a greeting ("hi", "hey", "hello", "sup", "yo", or empty) AND there is no prior conversation history, respond with exactly one friendly opener that:
1. Introduces yourself in one line.
2. Asks: **"What markets do you want to trade — prediction markets (Kalshi/Polymarket), stocks (Alpaca), or crypto?"**
3. Does not dump capabilities, menus, or long explanations.

Keep it under 40 words. Warm and interactive, not corporate.

Example good greeting:
"Hey — I'm OpenTradex, your trading copilot. What markets are we looking at today: prediction markets (Kalshi / Polymarket), stocks (Alpaca), or crypto?"
`;

const DEFAULT_SYSTEM_PROMPT = `You are **OpenTradex**, a conversational trading copilot.
${loadPersona()}

${GREETING_RULE}
`;

class OpenTradexAI {
  private config: AIConfig;
  private initialized = false;

  constructor(config: AIConfig = {}) {
    this.config = {
      model: config.model,
      maxTokens: config.maxTokens ?? 2048,
      systemPrompt: config.systemPrompt || DEFAULT_SYSTEM_PROMPT,
      apiKey: config.apiKey,
      provider: config.provider,
    };
  }

  /**
   * Legacy initialize — kept for compatibility. Sets ANTHROPIC_API_KEY if provided
   * so the Anthropic provider picks it up, then marks this instance as initialized.
   */
  initialize(apiKey?: string): boolean {
    if (apiKey) process.env.ANTHROPIC_API_KEY = apiKey;
    const available = configuredProviders();
    if (available.length === 0) {
      console.log('[AI] No providers configured — AI features disabled');
      return false;
    }
    this.initialized = true;
    const names = available.map((p) => p.name).join(', ');
    console.log(`[AI] Ready — configured providers: ${names}`);
    return true;
  }

  isAvailable(): boolean {
    if (!this.initialized) this.initialize();
    return configuredProviders().length > 0;
  }

  /**
   * List all registered providers with configured/active status.
   */
  providerStatus(): Array<{ name: string; configured: boolean; defaultModel: string }> {
    return listProviders().map((p) => ({
      name: p.name,
      configured: p.isConfigured(),
      defaultModel: p.defaultModel,
    }));
  }

  private buildContext(): string {
    const config = loadConfig();
    const risk = getRiskState();
    return `
## Current Trading Context

**Mode:** ${config?.tradingMode || 'paper-only'}
**Daily P&L:** $${risk.dailyPnL.toFixed(2)}
**Open Positions:** ${risk.openPositions.length}
**Trades Today:** ${risk.dailyTrades}

**Risk Limits:**
- Max Position: $${config?.risk?.maxPositionUsd || 1000}
- Max Daily Loss: $${config?.risk?.maxDailyLossUsd || 500}
- Max Drawdown: ${(config?.risk?.dailyDDKill || 10)}%

**Available Exchanges:** ${Object.entries(config?.rails || {})
      .filter(([_, v]) => v.enabled)
      .map(([k]) => k)
      .join(', ') || 'None configured'}
`;
  }

  private pickProvider(opts: ChatCallOptions): AIProvider | null {
    if (opts.provider) {
      const p = getProvider(opts.provider);
      if (p?.isConfigured()) return p;
    }
    if (opts.role) {
      const p = resolveProviderForRole(opts.role);
      if (p) return p;
    }
    if (opts.model) {
      const p = resolveProvider(opts.model);
      if (p?.isConfigured()) return p;
    }
    if (this.config.provider) {
      const p = getProvider(this.config.provider);
      if (p?.isConfigured()) return p;
    }
    if (this.config.model) {
      const p = resolveProvider(this.config.model);
      if (p?.isConfigured()) return p;
    }
    return resolveProviderForRole('orchestrator');
  }

  /**
   * Send a message and get a response. Optionally route by role/model/provider.
   */
  async chat(userMessage: string, arg2?: boolean | ChatCallOptions): Promise<AIResponse> {
    const opts: ChatCallOptions = typeof arg2 === 'boolean'
      ? { includeContext: arg2 }
      : (arg2 || {});
    const includeContext = opts.includeContext ?? true;

    const provider = this.pickProvider(opts);
    if (!provider) {
      return {
        content: 'AI not configured. Set one of: ANTHROPIC_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY, GOOGLE_API_KEY, GROQ_API_KEY, KIMI_API_KEY, DEEPSEEK_API_KEY — or install the Claude Code CLI / OpenCode CLI (oh-my-openagent-compatible).',
        model: 'none',
      };
    }

    const contextBlock = includeContext ? this.buildContext() : '';
    const fullMessage = contextBlock ? `${contextBlock}\n\n---\n\n${userMessage}` : userMessage;

    const messages: AIMessage[] = [{ role: 'user', content: fullMessage }];
    const chatOpts: ChatOptions = {
      model: opts.model || this.config.model,
      maxTokens: opts.maxTokens ?? this.config.maxTokens,
      systemPrompt: this.config.systemPrompt,
    };

    try {
      const res = await provider.chat(messages, chatOpts);
      return {
        content: res.content,
        model: res.model,
        provider: res.provider,
        usage: res.usage,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[AI] ${provider.name} error:`, message);
      return { content: `AI Error (${provider.name}): ${message}`, model: 'error', provider: provider.name };
    }
  }

  async analyzeMarket(symbol: string, exchange: string, marketData?: unknown): Promise<AIResponse> {
    const prompt = `Analyze the following market for trading opportunities:

**Symbol:** ${symbol}
**Exchange:** ${exchange}
${marketData ? `**Market Data:** ${JSON.stringify(marketData, null, 2)}` : ''}

Please provide:
1. Current market assessment (bullish/bearish/neutral)
2. Key levels to watch
3. Potential trade setup if one exists
4. Risk factors to consider`;
    return this.chat(prompt, { role: 'reasoning' });
  }

  async getRecommendation(context: string): Promise<AIResponse> {
    const prompt = `Based on the current market conditions and my portfolio, what trading actions would you recommend?

Additional context: ${context}

Please provide specific, actionable recommendations with clear reasoning.`;
    return this.chat(prompt, { role: 'reasoning' });
  }

  async explainRisk(): Promise<AIResponse> {
    const prompt = `Please analyze my current risk exposure and provide:

1. Assessment of current position risk
2. Whether I'm within safe limits
3. Any concerns or warnings
4. Suggestions for risk management`;
    return this.chat(prompt, { role: 'orchestrator' });
  }

  async processCommand(command: string): Promise<{ action: string; params: Record<string, unknown>; explanation: string }> {
    const prompt = `Parse this trading command and extract the action and parameters:

Command: "${command}"

Respond in this exact JSON format:
{
  "action": "scan|buy|sell|close|analyze|status|help",
  "params": { ... relevant parameters ... },
  "explanation": "Brief explanation of what will be done"
}

If the command is unclear, set action to "clarify" and explain what information is needed.`;
    const response = await this.chat(prompt, { role: 'speed', includeContext: false });
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch {
      // fall through
    }
    return { action: 'unknown', params: {}, explanation: response.content };
  }

  updateConfig(updates: Partial<AIConfig>): void {
    this.config = { ...this.config, ...updates };
    if (updates.apiKey) process.env.ANTHROPIC_API_KEY = updates.apiKey;
  }

  getConfig(): Omit<AIConfig, 'apiKey'> & { hasApiKey: boolean; providers: Array<{ name: string; configured: boolean }> } {
    return {
      model: this.config.model,
      maxTokens: this.config.maxTokens,
      systemPrompt: this.config.systemPrompt,
      provider: this.config.provider,
      hasApiKey: configuredProviders().length > 0,
      providers: this.providerStatus().map(({ name, configured }) => ({ name, configured })),
    };
  }
}

// Singleton
let aiInstance: OpenTradexAI | null = null;

export function getAI(config?: AIConfig): OpenTradexAI {
  if (!aiInstance) {
    aiInstance = new OpenTradexAI(config);
    aiInstance.initialize();
  } else if (config) {
    aiInstance.updateConfig(config);
  }
  return aiInstance;
}

export function initializeAI(apiKey?: string): boolean {
  return getAI().initialize(apiKey);
}

export { OpenTradexAI };
export type { TaskRole, AIProvider } from './providers/types.js';
