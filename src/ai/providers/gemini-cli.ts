import { spawn } from 'node:child_process';
import type { AIProvider, AIMessage, ChatOptions, AIResponse } from './types.js';
import { detectBinary } from './detect.js';

/**
 * Google Gemini CLI provider — uses the locally-installed `gemini` binary and
 * whatever auth the user already configured for it (`gemini auth login`). No
 * API key required when the CLI is logged in.
 */
export class GeminiCLIProvider implements AIProvider {
  readonly name = 'gemini-cli';
  readonly defaultModel = 'gemini-2.0-flash';
  private cachedPath: string | null | undefined;

  isConfigured(): boolean {
    if (this.cachedPath === undefined) this.cachedPath = detectBinary('gemini');
    return this.cachedPath !== null;
  }

  async chat(messages: AIMessage[], options: ChatOptions = {}): Promise<AIResponse> {
    if (!this.isConfigured() || !this.cachedPath) {
      throw new Error('gemini-cli: binary not found on PATH');
    }

    const parts: string[] = [];
    const systemText = options.systemPrompt
      ?? messages.find((m) => m.role === 'system')?.content;
    if (systemText) parts.push(systemText, '---');
    for (const m of messages) {
      if (m.role === 'system') continue;
      parts.push(m.role === 'user' ? m.content : `[assistant]: ${m.content}`);
    }
    const prompt = parts.join('\n\n');

    const args = ['-p', prompt];
    if (options.model) args.unshift('-m', options.model);

    const content = await new Promise<string>((resolve, reject) => {
      const child = spawn(this.cachedPath!, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: process.platform === 'win32',
        windowsHide: true,
      });
      let stdout = '';
      let stderr = '';
      child.stdout?.on('data', (c) => { stdout += c.toString(); });
      child.stderr?.on('data', (c) => { stderr += c.toString(); });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) resolve(stdout.trim());
        else reject(new Error(`gemini CLI exited ${code}: ${(stderr || stdout).slice(0, 500)}`));
      });
    });

    return { content, model: options.model || this.defaultModel, provider: this.name };
  }
}
