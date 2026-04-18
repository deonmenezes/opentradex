/** Interactive onboarding wizard for OpenTradex */

import { createInterface, type Interface as ReadlineInterface } from 'node:readline';
import { networkInterfaces } from 'node:os';
import {
  ensureConfigDir,
  saveConfig,
  writeModeLock,
  generateAuthToken,
  saveAuthToken,
  defaultConfig,
  isOnboarded,
  loadConfig,
  CONFIG_DIR,
  type TradingMode,
  type BindMode,
  type OpenTradexConfig,
} from './config.js';
import { PROVIDER_ENV, saveProviderKey } from './ai/ai-keys.js';

// Lazy readline so importing this module in tests doesn't hold stdin open.
let rl: ReadlineInterface | null = null;
function getRL(): ReadlineInterface {
  if (!rl) {
    rl = createInterface({ input: process.stdin, output: process.stdout });
  }
  return rl;
}
function closeRL(): void {
  if (rl) { try { rl.close(); } catch { /* noop */ } rl = null; }
}

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    getRL().question(question, (answer) => resolve(answer.trim()));
  });
}

function print(msg: string): void {
  console.log(msg);
}

function header(title: string): void {
  print('\n' + '='.repeat(50));
  print(`  ${title}`);
  print('='.repeat(50) + '\n');
}

async function selectOption<T extends string>(
  prompt: string,
  options: { value: T; label: string; description?: string }[],
  defaultValue?: T
): Promise<T> {
  print(prompt + '\n');
  options.forEach((opt, i) => {
    const marker = opt.value === defaultValue ? ' (default)' : '';
    print(`  ${i + 1}. ${opt.label}${marker}`);
    if (opt.description) print(`     ${opt.description}`);
  });
  print('');

  const answer = await ask(`Enter choice [1-${options.length}]: `);
  const idx = parseInt(answer) - 1;

  if (isNaN(idx) || idx < 0 || idx >= options.length) {
    if (defaultValue) return defaultValue;
    return options[0].value;
  }

  return options[idx].value;
}

async function askYesNo(prompt: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? '[Y/n]' : '[y/N]';
  const answer = await ask(`${prompt} ${hint}: `);
  if (!answer) return defaultYes;
  return answer.toLowerCase().startsWith('y');
}

async function askNumber(prompt: string, defaultValue: number): Promise<number> {
  const answer = await ask(`${prompt} [${defaultValue}]: `);
  if (!answer) return defaultValue;
  const num = parseFloat(answer);
  return isNaN(num) ? defaultValue : num;
}

/** Pick the first non-internal IPv4 address on the box (for pair URL hints). */
function getLanIp(): string | null {
  const ifaces = networkInterfaces();
  for (const list of Object.values(ifaces)) {
    if (!list) continue;
    for (const net of list) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return null;
}

export interface FastOnboardOptions {
  /** Skip all prompts except AI provider — forces paper-only + local bind. */
  paperOnly?: boolean;
  /**
   * Override inputs (bypass prompts). When set, takes precedence over env vars.
   * Exposed so tests can drive the flow deterministically.
   */
  inputs?: Partial<{
    mode: TradingMode;
    aiProvider: string;         // provider id in PROVIDER_ENV, or "skip"
    aiKey: string;
    startingCapital: number;
    bindMode: BindMode;
  }>;
  /** Force non-TTY behaviour (env-var only) for tests / CI. */
  forceNonInteractive?: boolean;
  /** Inject a readline.Interface for testing (otherwise uses the module-level rl). */
  ioOverride?: { ask: (q: string) => Promise<string>; print: (m: string) => void };
}

export interface FastOnboardResult {
  config: OpenTradexConfig;
  authToken?: string;
  aiProviderConfigured: string | null;
  summary: {
    gatewayUrl: string;
    nextStepCommand: string;
    pairInfo?: { host: string; token: string };
    /** Absolute path of pair.svg written when bindMode != local. */
    pairSvgPath?: string;
    /** JSON payload embedded in the QR (v1 envelope). */
    pairEncoded?: string;
  };
}

/**
 * Streamlined onboarding: 5 prompts for the default flow, 1 prompt for
 * --paper-only, 0 prompts for CI (env-var driven). Writes the same config
 * files as the full flow but skips the rail / x402 / MCP questions — users
 * who need those can run `opentradex onboard --full` later.
 */
export async function runFastOnboard(opts: FastOnboardOptions = {}): Promise<FastOnboardResult> {
  const envMode = (process.env.OPENTRADEX_MODE || '').toLowerCase();
  const envProvider = process.env.OPENTRADEX_AI_PROVIDER;
  const envKey = process.env.OPENTRADEX_AI_KEY;
  const envBind = (process.env.OPENTRADEX_BIND || '').toLowerCase();
  const envCapitalRaw = process.env.OPENTRADEX_CAPITAL;

  // Decide interactivity: env-driven when explicitly forced, when there's no
  // TTY on stdin, or when every answer already comes from env vars / opts.
  const hasTTY = !!(process.stdin.isTTY && process.stdout.isTTY);
  const allInputsViaEnv =
    (opts.paperOnly || envMode || opts.inputs?.mode)
    && (envProvider || opts.inputs?.aiProvider);
  const interactive = !opts.forceNonInteractive && hasTTY && !allInputsViaEnv;

  const io = opts.ioOverride ?? { ask, print };

  io.print('');
  io.print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  io.print('  OpenTradex — quick setup');
  io.print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  io.print('');

  const config = defaultConfig();

  // --- Prompt 1 of 5: trading mode -----------------------------------------
  let mode: TradingMode;
  if (opts.paperOnly) {
    mode = 'paper-only';
    io.print('Mode: paper-only (locked by --paper-only flag)');
  } else if (opts.inputs?.mode) {
    mode = opts.inputs.mode;
  } else if (envMode === 'paper-only' || envMode === 'paper-default' || envMode === 'live-allowed') {
    mode = envMode as TradingMode;
  } else if (!interactive) {
    mode = 'paper-only';
  } else {
    const stayPaper = await askYesNoVia(io.ask, 'Paper-only mode? (safest, no real money ever)', true);
    mode = stayPaper ? 'paper-only' : 'paper-default';
  }
  config.tradingMode = mode;

  // --- Prompt 2 of 5: AI provider -----------------------------------------
  const inputProvider = opts.inputs?.aiProvider ?? envProvider ?? undefined;
  const inputKey = opts.inputs?.aiKey ?? envKey ?? undefined;
  let aiProviderConfigured: string | null = null;
  if (inputProvider && inputProvider !== 'skip') {
    if (!PROVIDER_ENV[inputProvider]) {
      io.print(`Unknown AI provider: ${inputProvider} — skipping`);
    } else if (!inputKey) {
      io.print(`OPENTRADEX_AI_KEY not set for provider ${inputProvider} — skipping`);
    } else {
      try {
        saveProviderKey(inputProvider, inputKey);
        aiProviderConfigured = inputProvider;
        io.print(`AI: ${inputProvider} key saved`);
      } catch (e) {
        io.print(`AI key save failed: ${e instanceof Error ? e.message : 'unknown error'}`);
      }
    }
  } else if (!interactive) {
    io.print('AI: skipped (set OPENTRADEX_AI_PROVIDER + OPENTRADEX_AI_KEY to auto-configure)');
  } else {
    const knownProviders = Object.keys(PROVIDER_ENV);
    const list = knownProviders.join(', ');
    io.print('');
    io.print(`AI providers: ${list}`);
    const provider = (await io.ask(`AI provider (or Enter to skip) [openai]: `)).trim().toLowerCase();
    if (provider && provider !== 'skip') {
      if (!PROVIDER_ENV[provider]) {
        io.print(`Unknown provider: ${provider} — skipping`);
      } else {
        const key = (await io.ask(`${provider} API key (hidden): `)).trim();
        if (!key) {
          io.print('No key — skipping.');
        } else {
          try {
            saveProviderKey(provider, key);
            aiProviderConfigured = provider;
            io.print(`AI: ${provider} key saved`);
          } catch (e) {
            io.print(`AI key save failed: ${e instanceof Error ? e.message : 'unknown error'}`);
          }
        }
      }
    }
  }

  // --- Prompt 3 of 5: starting capital (skipped on --paper-only) -----------
  if (!opts.paperOnly) {
    if (typeof opts.inputs?.startingCapital === 'number') {
      config.risk.startingCapital = opts.inputs.startingCapital;
    } else if (envCapitalRaw && !Number.isNaN(Number(envCapitalRaw))) {
      config.risk.startingCapital = Number(envCapitalRaw);
    } else if (!interactive) {
      config.risk.startingCapital = 10000;
    } else {
      config.risk.startingCapital = await askNumberVia(io.ask, 'Starting capital (USD)', 10000);
    }
  } else {
    config.risk.startingCapital = config.risk.startingCapital ?? 10000;
  }

  // --- Prompt 4 of 5: bind mode (skipped on --paper-only) ------------------
  if (!opts.paperOnly) {
    if (opts.inputs?.bindMode) {
      config.bindMode = opts.inputs.bindMode;
    } else if (envBind === 'local' || envBind === 'lan' || envBind === 'tunnel') {
      config.bindMode = envBind as BindMode;
    } else if (!interactive) {
      config.bindMode = 'local';
    } else {
      const answer = (await io.ask('Network: [1] local (default)  [2] lan  [3] tunnel: ')).trim();
      config.bindMode = answer === '2' ? 'lan' : answer === '3' ? 'tunnel' : 'local';
    }
  } else {
    config.bindMode = 'local';
  }

  // Generate + save auth token when we're not local.
  let authToken: string | undefined;
  if (config.bindMode !== 'local') {
    authToken = generateAuthToken();
    saveAuthToken(authToken);
  }

  // --- Persist -------------------------------------------------------------
  ensureConfigDir();
  writeModeLock(config.tradingMode);
  saveConfig(config);

  // --- Prompt 5 of 5: done summary ----------------------------------------
  const lanIp = getLanIp();
  const hostForPair = config.bindMode === 'local'
    ? `http://127.0.0.1:${config.port}`
    : `http://${lanIp ?? '<your-lan-ip>'}:${config.port}`;
  const gatewayUrl = config.bindMode === 'local'
    ? `http://localhost:${config.port}`
    : hostForPair;

  io.print('');
  io.print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  io.print('  Setup complete');
  io.print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  io.print(`  Mode:        ${config.tradingMode}`);
  io.print(`  Network:     ${config.bindMode} on port ${config.port}`);
  io.print(`  Gateway URL: ${gatewayUrl}`);
  if (aiProviderConfigured) io.print(`  AI provider: ${aiProviderConfigured}`);
  if (!opts.paperOnly) {
    io.print(`  Capital:     $${(config.risk.startingCapital ?? 0).toLocaleString()}`);
  }
  let pairSvgPath: string | undefined;
  let pairEncoded: string | undefined;
  if (authToken) {
    io.print('');
    io.print('  Auth token (save — shown once):');
    io.print(`    ${authToken}`);
    io.print('');
    try {
      const { makePairArtifacts } = await import('./pair-qr.js');
      const artifacts = await makePairArtifacts(
        { host: hostForPair, token: authToken },
        CONFIG_DIR
      );
      pairSvgPath = artifacts.svgPath;
      pairEncoded = artifacts.encoded;
      io.print('  Scan this QR on your phone to pair:');
      io.print('');
      for (const line of artifacts.ascii.split('\n')) io.print(line);
      io.print(`  (also saved as SVG: ${artifacts.svgPath})`);
      io.print('');
      io.print('  QR payload (if scanner cannot read it):');
      io.print(`    ${artifacts.encoded}`);
    } catch (e) {
      io.print(`  QR render failed: ${e instanceof Error ? e.message : 'unknown error'}`);
      io.print(`  Pair JSON: {"host":"${hostForPair}","token":"${authToken}"}`);
    }
  }
  io.print('');
  io.print('  Next step:');
  io.print('    opentradex run');
  io.print('');

  // Close the shared readline when we own it — otherwise Node keeps stdin
  // open and the CLI hangs after the summary prints.
  if (!opts.ioOverride) {
    closeRL();
  }

  return {
    config,
    authToken,
    aiProviderConfigured,
    summary: {
      gatewayUrl,
      nextStepCommand: 'opentradex run',
      pairInfo: authToken ? { host: hostForPair, token: authToken } : undefined,
      pairSvgPath,
      pairEncoded,
    },
  };
}

/** Readline-backed helper used when ioOverride is not supplied. */
async function askYesNoVia(asker: (q: string) => Promise<string>, prompt: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? '[Y/n]' : '[y/N]';
  const answer = (await asker(`${prompt} ${hint}: `)).trim();
  if (!answer) return defaultYes;
  return answer.toLowerCase().startsWith('y');
}

async function askNumberVia(asker: (q: string) => Promise<string>, prompt: string, defaultValue: number): Promise<number> {
  const answer = (await asker(`${prompt} [${defaultValue}]: `)).trim();
  if (!answer) return defaultValue;
  const num = parseFloat(answer);
  return Number.isNaN(num) ? defaultValue : num;
}

export async function runOnboard(paperOnly = false): Promise<void> {
  header('OpenTradex Onboarding');

  // Check if already onboarded
  if (isOnboarded()) {
    const existing = loadConfig();
    print(`Found existing configuration at ${CONFIG_DIR}`);
    print(`Trading mode: ${existing?.tradingMode || 'unknown'}`);
    print('');

    const proceed = await askYesNo('Reconfigure OpenTradex?', false);
    if (!proceed) {
      print('\nOnboarding cancelled. Existing config preserved.');
      closeRL();
      return;
    }
  }

  ensureConfigDir();
  const config = defaultConfig();

  // Step 1: Trading Mode
  header('Step 1: Trading Mode');

  if (paperOnly) {
    print('Paper-only mode selected via --paper-only flag.');
    print('All trades will be routed to demo/paper endpoints.');
    print('This cannot be changed without re-running onboard.\n');
    config.tradingMode = 'paper-only';
  } else {
    config.tradingMode = await selectOption<TradingMode>(
      'Select your trading mode:',
      [
        {
          value: 'paper-only',
          label: 'Paper Only',
          description: 'All trades go to paper. Cannot switch to live.',
        },
        {
          value: 'paper-default',
          label: 'Paper Default',
          description: 'Start paper, can switch to live after 24h demo.',
        },
        {
          value: 'live-allowed',
          label: 'Live Allowed',
          description: 'Power user mode. Can trade live immediately.',
        },
      ],
      'paper-only'
    );
  }

  // Write mode lock immediately
  writeModeLock(config.tradingMode);
  print(`\nTrading mode locked: ${config.tradingMode}`);

  // Step 2: Network Bind Mode
  header('Step 2: Network Access');

  config.bindMode = await selectOption<BindMode>(
    'How will you access the dashboard?',
    [
      {
        value: 'local',
        label: 'Local Only',
        description: 'http://localhost - same machine only',
      },
      {
        value: 'lan',
        label: 'LAN / VPS',
        description: 'http://<ip>:port - accessible on network',
      },
      {
        value: 'tunnel',
        label: 'Tunnel (Cloudflare/Tailscale)',
        description: 'https:// - accessible anywhere, no port forward',
      },
    ],
    'local'
  );

  config.port = await askNumber('Gateway port', 3210);

  // Generate auth token for non-local modes
  let authToken: string | undefined;
  if (config.bindMode !== 'local') {
    authToken = generateAuthToken();
    saveAuthToken(authToken);
    print('\nAuth token generated (keep this safe - shown once):');
    print(`  ${authToken}\n`);
  }

  // Step 3: Rail Credentials
  header('Step 3: Market Rails');

  // Kalshi
  print('Kalshi (Prediction Markets)');
  config.rails.kalshi.enabled = await askYesNo('  Enable Kalshi?', true);
  if (config.rails.kalshi.enabled) {
    config.rails.kalshi.demo = true; // Always demo first
    const hasKeys = await askYesNo('  Do you have Kalshi API keys?', false);
    if (hasKeys) {
      config.rails.kalshi.apiKey = await ask('  API Key: ');
      config.rails.kalshi.privateKey = await ask('  Private Key (path or PEM): ');
    }
  }

  // Polymarket
  print('\nPolymarket (Prediction Markets)');
  config.rails.polymarket.enabled = await askYesNo('  Enable Polymarket?', true);
  if (config.rails.polymarket.enabled) {
    config.rails.polymarket.demo = true;
    print('  Note: Polymarket uses Mumbai testnet for paper trading.');
  }

  // Alpaca
  print('\nAlpaca (Stocks/ETFs)');
  config.rails.alpaca.enabled = await askYesNo('  Enable Alpaca?', false);
  if (config.rails.alpaca.enabled) {
    config.rails.alpaca.demo = true;
    const hasKeys = await askYesNo('  Do you have Alpaca API keys?', false);
    if (hasKeys) {
      config.rails.alpaca.apiKey = await ask('  API Key ID: ');
      config.rails.alpaca.secretKey = await ask('  Secret Key: ');
    }
    print('  Paper trading enabled by default.');
  }

  // OANDA
  print('\nOANDA (Forex) - Optional');
  config.rails.oanda.enabled = await askYesNo('  Enable OANDA?', false);
  if (config.rails.oanda.enabled) {
    config.rails.oanda.demo = true;
    const hasKeys = await askYesNo('  Do you have OANDA API keys?', false);
    if (hasKeys) {
      config.rails.oanda.apiKey = await ask('  API Token: ');
    }
  }

  // Step 4: Risk Profile
  header('Step 4: Risk Profile');

  print('Set your risk limits (these are enforced by the risk engine):\n');

  config.risk.maxPositionUsd = await askNumber(
    'Max position size (USD)',
    config.risk.maxPositionUsd
  );

  config.risk.maxDailyLossUsd = await askNumber(
    'Max daily loss (USD)',
    config.risk.maxDailyLossUsd
  );

  config.risk.maxOpenPositions = await askNumber(
    'Max concurrent positions',
    config.risk.maxOpenPositions
  );

  config.risk.perTradePercent = await askNumber(
    'Max per-trade % of capital',
    config.risk.perTradePercent
  );

  config.risk.dailyDDKill = await askNumber(
    'Daily drawdown % to halt trading',
    config.risk.dailyDDKill
  );

  // Step 5: Model Selection
  header('Step 5: AI Model');

  config.model = await selectOption(
    'Select default AI model for the Think loop:',
    [
      { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (recommended)' },
      { value: 'claude-opus-4-7', label: 'Claude Opus 4.7 (most capable)' },
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'local', label: 'Local model (via Ollama)' },
    ],
    'claude-sonnet-4-6'
  );

  // Step 6: AI API Key
  header('Step 6: AI Integration');

  print('Connect your AI for intelligent trading assistance.\n');
  print('The AI can:');
  print('  - Analyze markets and suggest trades');
  print('  - Explain risk and portfolio state');
  print('  - Process natural language commands');
  print('  - Provide reasoning for decisions\n');

  const configureAI = await askYesNo('Configure Claude AI now?', true);

  if (configureAI) {
    print('\nGet your API key from: https://console.anthropic.com/settings/keys\n');

    const apiKey = await ask('Anthropic API Key (or press Enter to skip): ');

    if (apiKey) {
      // Save to environment file
      const { writeFileSync, existsSync, readFileSync } = await import('node:fs');
      const { join } = await import('node:path');
      const envPath = join(CONFIG_DIR, '.env');

      let envContent = '';
      if (existsSync(envPath)) {
        envContent = readFileSync(envPath, 'utf-8');
        // Remove existing ANTHROPIC_API_KEY if present
        envContent = envContent.replace(/^ANTHROPIC_API_KEY=.*$/m, '').trim();
      }

      envContent = envContent ? `${envContent}\nANTHROPIC_API_KEY=${apiKey}` : `ANTHROPIC_API_KEY=${apiKey}`;
      writeFileSync(envPath, envContent + '\n', { mode: 0o600 });

      print('\nAPI key saved to ' + envPath);
      print('AI features will be available when you start the gateway.\n');

      // Also store in config (encrypted reference)
      (config as any).ai = {
        provider: 'anthropic',
        model: config.model,
        configured: true,
      };
    } else {
      print('\nSkipped. You can set ANTHROPIC_API_KEY environment variable later.');
      print('Or run: npx opentradex onboard\n');
    }
  }

  // Step 7: x402 Agentic Payments
  header('Step 7: x402 Agentic Payments (Optional)');

  print('Let the AI agent auto-pay 402-gated APIs with USDC micropayments.');
  print('Useful for premium data providers, paid news APIs, and MCP tools.\n');
  print('Safe defaults:');
  print('  - Base Sepolia testnet (free test USDC via CDP faucet)');
  print('  - Max $1 per call');
  print('  - Key stored at ~/.opentradex/config.json (chmod 600)\n');

  await runX402Onboard();

  // Step 8: Claude Code MCP Integration
  header('Step 8: Claude Code Integration (Optional)');

  print('Connect OpenTradex as an MCP server for Claude Code CLI.\n');
  print('This allows Claude Code to:');
  print('  - Scan markets directly from your IDE');
  print('  - Execute trades via natural language');
  print('  - Monitor your portfolio in real-time\n');

  const setupMCP = await askYesNo('Set up Claude Code MCP integration?', false);

  if (setupMCP) {
    const { writeFileSync, existsSync, readFileSync, mkdirSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { homedir } = await import('node:os');

    // Create MCP server config
    const mcpConfig = {
      mcpServers: {
        opentradex: {
          command: 'npx',
          args: ['opentradex', 'mcp'],
          env: {
            OPENTRADEX_PORT: String(config.port),
          },
        },
      },
    };

    // Claude Code config location
    const claudeDir = join(homedir(), '.claude');
    if (!existsSync(claudeDir)) {
      mkdirSync(claudeDir, { recursive: true });
    }

    const mcpPath = join(claudeDir, 'claude_desktop_config.json');
    let existingConfig: any = {};

    if (existsSync(mcpPath)) {
      try {
        existingConfig = JSON.parse(readFileSync(mcpPath, 'utf-8'));
      } catch {
        // Start fresh
      }
    }

    // Merge MCP server config
    existingConfig.mcpServers = {
      ...existingConfig.mcpServers,
      ...mcpConfig.mcpServers,
    };

    writeFileSync(mcpPath, JSON.stringify(existingConfig, null, 2));

    print('\nMCP configuration added to: ' + mcpPath);
    print('Restart Claude Code to activate the OpenTradex tools.\n');
    print('Available MCP tools:');
    print('  - opentradex_scan: Scan markets');
    print('  - opentradex_quote: Get price quotes');
    print('  - opentradex_trade: Execute trades');
    print('  - opentradex_portfolio: View positions');
    print('  - opentradex_risk: Check risk state\n');
  }

  // Save configuration
  saveConfig(config);

  // Summary
  header('Setup Complete!');

  print(`Configuration saved to: ${CONFIG_DIR}\n`);
  print('Summary:');
  print(`  Trading Mode: ${config.tradingMode}`);
  print(`  Network:      ${config.bindMode} on port ${config.port}`);
  print(`  Rails:        ${Object.entries(config.rails).filter(([, v]) => v.enabled).map(([k]) => k).join(', ') || 'none'}`);
  print(`  Risk:         $${config.risk.maxPositionUsd} max position, $${config.risk.maxDailyLossUsd} daily loss limit`);
  print(`  Model:        ${config.model}`);

  print('\nNext steps:');
  print('  1. Start the gateway:  opentradex run');
  print('  2. Open dashboard:     http://localhost:' + config.port);
  if (authToken) {
    print(`  3. Dashboard URL with auth: http://localhost:${config.port}?token=${authToken}`);
  }
  print('\nCommands:');
  print('  opentradex run      Start the trading harness');
  print('  opentradex status   Show current configuration');
  print('  opentradex panic    Emergency stop all trading');

  closeRL();
}

/**
 * Interactive x402 setup — prompts for chain, max payment, and key source.
 * Can be re-run independently via `opentradex x402 setup`.
 */
export async function runX402Onboard(): Promise<void> {
  const { loadX402Settings, saveX402Settings, generatePrivateKey, addressFromKey } =
    await import('./x402/index.js');

  const existing = loadX402Settings();
  if (existing.enabled) {
    print(`x402 already enabled on ${existing.chain} (max $${existing.maxPaymentUsd} per call).`);
    const reconfigure = await askYesNo('Reconfigure?', false);
    if (!reconfigure) return;
  }

  const enable = await askYesNo('Enable x402 payments now?', false);
  if (!enable) {
    print('Skipped. You can enable later with: opentradex x402 setup\n');
    return;
  }

  const chain = await selectOption<'base-sepolia' | 'base'>(
    'Which chain?',
    [
      { value: 'base-sepolia', label: 'Base Sepolia (testnet, free USDC)' },
      { value: 'base', label: 'Base mainnet (real USDC)' },
    ],
    'base-sepolia'
  );

  const maxPaymentUsd = await askNumber('Max payment per call (USD)', 1);

  const source = await selectOption<'generate' | 'paste'>(
    'Wallet key:',
    [
      { value: 'generate', label: 'Generate a new wallet now (recommended for testnet)' },
      { value: 'paste', label: 'Paste an existing 0x private key' },
    ],
    'generate'
  );

  let privateKey: `0x${string}`;
  if (source === 'generate') {
    privateKey = await generatePrivateKey();
    print('\nGenerated fresh key. Public address will be shown below.');
  } else {
    const raw = await ask('Private key (0x...): ');
    if (!raw.startsWith('0x') || raw.length !== 66) {
      print('\nInvalid key. Skipping — run `opentradex x402 setup` to retry.\n');
      return;
    }
    privateKey = raw as `0x${string}`;
  }

  const saved = saveX402Settings({ chain, maxPaymentUsd, privateKey });
  const address = await addressFromKey(privateKey);

  print('\nx402 configured:');
  print(`  Chain:    ${saved.chain}`);
  print(`  Max/call: $${saved.maxPaymentUsd}`);
  print(`  Address:  ${address}`);
  if (chain === 'base-sepolia') {
    print('\nFund this address with test USDC: https://faucet.circle.com');
  } else {
    print('\nFund this address with USDC on Base mainnet before making paid calls.');
  }
  print('');
}

export async function showStatus(): Promise<void> {
  const config = loadConfig();

  if (!config) {
    print('OpenTradex is not configured. Run: opentradex onboard');
    return;
  }

  header('OpenTradex Status');

  print(`Config Directory: ${CONFIG_DIR}\n`);

  print('Trading Mode:');
  const modeColors: Record<TradingMode, string> = {
    'paper-only': '\x1b[32m', // green
    'paper-default': '\x1b[33m', // yellow
    'live-allowed': '\x1b[31m', // red
  };
  const reset = '\x1b[0m';
  print(`  ${modeColors[config.tradingMode]}${config.tradingMode.toUpperCase()}${reset}`);

  print('\nNetwork:');
  print(`  Bind: ${config.bindMode}`);
  print(`  Port: ${config.port}`);

  print('\nRails:');
  for (const [name, rail] of Object.entries(config.rails)) {
    const status = rail.enabled ? (rail.demo ? 'paper' : 'live') : 'disabled';
    print(`  ${name}: ${status}`);
  }

  print('\nRisk Profile:');
  print(`  Max Position:    $${config.risk.maxPositionUsd}`);
  print(`  Max Daily Loss:  $${config.risk.maxDailyLossUsd}`);
  print(`  Max Positions:   ${config.risk.maxOpenPositions}`);
  print(`  Per-Trade %:     ${config.risk.perTradePercent}%`);
  print(`  DD Kill Switch:  ${config.risk.dailyDDKill}%`);

  print('\nModel: ' + config.model);
  print(`\nLast Updated: ${config.updatedAt}`);
}
