import type { AIProvider, AIMessage, ChatOptions, AIResponse } from './types.js';
import { detectBinary } from './detect.js';

const DEFAULT_HOST = 'http://127.0.0.1:11434';

/**
 * Ollama provider — talks to a local ollama server over its OpenAI-compatible
 * endpoint. No API key required. `isConfigured()` succeeds when either the
 * `ollama` binary is on PATH, the user set `OLLAMA_HOST`, or `/api/tags` on the
 * default host is reachable (checked lazily at first chat).
 *
 * Default model is llama3.2 — overridable per-call via ChatOptions.model.
 */
export class OllamaProvider implements AIProvider {
  readonly name = 'ollama';
  readonly defaultModel = 'llama3.2';
  private cachedBinary: string | null | undefined;

  isConfigured(): boolean {
    if (this.cachedBinary === undefined) this.cachedBinary = detectBinary('ollama');
    return this.cachedBinary !== null || !!process.env.OLLAMA_HOST;
  }

  private get baseUrl(): string {
    const host = process.env.OLLAMA_HOST || DEFAULT_HOST;
    return host.replace(/\/$/, '') + '/v1';
  }

  async chat(messages: AIMessage[], options: ChatOptions = {}): Promise<AIResponse> {
    const payload: Record<string, unknown> = {
      model: options.model || this.defaultModel,
      max_tokens: options.maxTokens ?? 2048,
      messages: options.systemPrompt
        ? [{ role: 'system', content: options.systemPrompt }, ...messages.filter((m) => m.role !== 'system')]
        : messages,
      stream: false,
    };
    if (options.temperature !== undefined) payload.temperature = options.temperature;

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`ollama ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json() as {
      model?: string;
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    return {
      content: data.choices?.[0]?.message?.content ?? '',
      model: data.model || (payload.model as string),
      provider: this.name,
      usage: data.usage ? {
        inputTokens: data.usage.prompt_tokens ?? 0,
        outputTokens: data.usage.completion_tokens ?? 0,
      } : undefined,
    };
  }
}
