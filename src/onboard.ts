/** Interactive onboarding wizard for OpenTradex */

import { createInterface } from 'node:readline';
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

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
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
      rl.close();
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

  rl.close();
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
