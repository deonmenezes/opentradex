/**
 * Tests for runFastOnboard — the ≤5-prompt onboarding flow (US-008).
 *
 * config.ts resolves CONFIG_DIR once at module-load, so the tests share one
 * tmp HOME across the whole suite. Between tests we reset the OPENTRADEX_*
 * env vars and wipe the tmp dir so each test starts from a clean slate.
 */

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmpHome = '';
let prevHome: string | undefined;
let prevUserprofile: string | undefined;
let runFastOnboard: typeof import('./onboard.js').runFastOnboard;

before(async () => {
  tmpHome = mkdtempSync(join(tmpdir(), 'opentradex-onboard-'));
  prevHome = process.env.HOME;
  prevUserprofile = process.env.USERPROFILE;
  process.env.HOME = tmpHome;
  process.env.USERPROFILE = tmpHome;
  // HOME is set BEFORE first import so config.js / ai-keys.js bind CONFIG_DIR
  // to our tmp dir rather than the real ~/.opentradex.
  ({ runFastOnboard } = await import('./onboard.js'));
});

after(() => {
  if (prevHome === undefined) delete process.env.HOME; else process.env.HOME = prevHome;
  if (prevUserprofile === undefined) delete process.env.USERPROFILE; else process.env.USERPROFILE = prevUserprofile;
  try { rmSync(tmpHome, { recursive: true, force: true }); } catch { /* noop */ }
});

beforeEach(() => {
  // Wipe persisted state + env vars so tests can't leak into each other.
  const cfgDir = join(tmpHome, '.opentradex');
  try { rmSync(cfgDir, { recursive: true, force: true }); } catch { /* noop */ }
  mkdirSync(cfgDir, { recursive: true });
  delete process.env.OPENTRADEX_MODE;
  delete process.env.OPENTRADEX_AI_PROVIDER;
  delete process.env.OPENTRADEX_AI_KEY;
  delete process.env.OPENTRADEX_CAPITAL;
  delete process.env.OPENTRADEX_BIND;
});

function captureIO() {
  const lines: string[] = [];
  return {
    lines,
    io: {
      ask: async (_q: string): Promise<string> => {
        throw new Error(`ask() should not be called in non-interactive mode. asked: ${_q}`);
      },
      print: (m: string): void => { lines.push(m); },
    },
  };
}

test('--paper-only writes paper-only mode + local bind without prompts', async () => {
  const { io, lines } = captureIO();
  const result = await runFastOnboard({
    paperOnly: true,
    forceNonInteractive: true,
    ioOverride: io,
  });
  assert.equal(result.config.tradingMode, 'paper-only');
  assert.equal(result.config.bindMode, 'local');
  assert.equal(result.authToken, undefined);
  assert.ok(result.summary.gatewayUrl.includes('localhost'));
  assert.ok(lines.some((l) => l.includes('Setup complete')));
  assert.ok(existsSync(join(tmpHome, '.opentradex', 'config.json')));
  assert.ok(existsSync(join(tmpHome, '.opentradex', 'mode.lock')));
  assert.equal(readFileSync(join(tmpHome, '.opentradex', 'mode.lock'), 'utf8'), 'paper-only');
});

test('env-var driven flow: OPENTRADEX_MODE + OPENTRADEX_AI_PROVIDER/KEY + capital + bind', async () => {
  process.env.OPENTRADEX_MODE = 'paper-default';
  process.env.OPENTRADEX_AI_PROVIDER = 'openai';
  process.env.OPENTRADEX_AI_KEY = 'sk-test-envvar-12345678';
  process.env.OPENTRADEX_CAPITAL = '25000';
  process.env.OPENTRADEX_BIND = 'lan';

  const { io, lines } = captureIO();
  const result = await runFastOnboard({ forceNonInteractive: true, ioOverride: io });

  assert.equal(result.config.tradingMode, 'paper-default');
  assert.equal(result.config.bindMode, 'lan');
  assert.equal(result.config.risk.startingCapital, 25000);
  assert.equal(result.aiProviderConfigured, 'openai');
  assert.ok(result.authToken && result.authToken.length > 20, 'lan mode should issue a token');
  assert.ok(result.summary.pairInfo, 'lan mode should expose pair info');

  const aiKeysPath = join(tmpHome, '.opentradex', 'ai-keys.json');
  assert.ok(existsSync(aiKeysPath), `ai-keys.json should exist at ${aiKeysPath}`);
  const keys = JSON.parse(readFileSync(aiKeysPath, 'utf8')) as { keys: Record<string, string> };
  assert.equal(keys.keys.openai, 'sk-test-envvar-12345678');
  assert.ok(!lines.some((l) => l.includes('sk-test-envvar-12345678')));
});

test('inputs overrides win over env vars', async () => {
  process.env.OPENTRADEX_MODE = 'paper-default';
  process.env.OPENTRADEX_CAPITAL = '50000';

  const { io } = captureIO();
  const result = await runFastOnboard({
    forceNonInteractive: true,
    ioOverride: io,
    inputs: { mode: 'paper-only', startingCapital: 1234 },
  });
  assert.equal(result.config.tradingMode, 'paper-only');
  assert.equal(result.config.risk.startingCapital, 1234);
});

test('unknown provider from env is skipped gracefully', async () => {
  process.env.OPENTRADEX_AI_PROVIDER = 'bogus';
  process.env.OPENTRADEX_AI_KEY = 'sk-whatever-longenough';

  const { io, lines } = captureIO();
  const result = await runFastOnboard({
    paperOnly: true,
    forceNonInteractive: true,
    ioOverride: io,
  });
  assert.equal(result.aiProviderConfigured, null);
  assert.ok(lines.some((l) => l.toLowerCase().includes('unknown ai provider')));
});

test('lan bind without explicit token env still generates a token', async () => {
  const { io } = captureIO();
  const result = await runFastOnboard({
    forceNonInteractive: true,
    ioOverride: io,
    inputs: { mode: 'paper-default', bindMode: 'lan', startingCapital: 5000 },
  });
  assert.equal(result.config.bindMode, 'lan');
  assert.ok(result.authToken && result.authToken.length > 0);
  assert.ok(existsSync(join(tmpHome, '.opentradex', 'auth.json')));
});
