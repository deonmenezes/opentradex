#!/usr/bin/env node
/** OpenTradex CLI - Multi-market AI trading harness */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { OpenTradex } from '../index.js';
import { createGateway } from '../gateway/index.js';
import { runOnboard, runFastOnboard, runX402Onboard, showStatus } from '../onboard.js';
import {
  isOnboarded,
  loadConfig,
  getModeBadge,
  CONFIG_DIR,
  readModeLock,
} from '../config.js';
import {
  panicFlatten,
  getRiskState,
  isTradingHalted,
} from '../risk.js';
import { initializeAI, getAI } from '../ai/index.js';
import { startMCPServer } from '../mcp/index.js';
import type { Exchange } from '../types.js';

const VERSION = '0.1.0';

function print(msg: string): void {
  console.log(msg);
}

function printError(msg: string): void {
  console.error(`\x1b[31mError:\x1b[0m ${msg}`);
}

function printWarning(msg: string): void {
  console.error(`\x1b[33mWarning:\x1b[0m ${msg}`);
}

function printSuccess(msg: string): void {
  console.log(`\x1b[32m${msg}\x1b[0m`);
}

function printBadge(): void {
  const badge = getModeBadge();
  const colors = { green: '\x1b[42m\x1b[30m', amber: '\x1b[43m\x1b[30m', red: '\x1b[41m\x1b[37m' };
  const reset = '\x1b[0m';
  print(`${colors[badge.color]} ${badge.text} ${reset}\n`);
}

function loadDotEnv(): void {
  const envPath = join(CONFIG_DIR, '.env');
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, 'utf-8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && process.env[key] === undefined) process.env[key] = val;
  }
}

async function main(): Promise<void> {
  loadDotEnv();
  const [cmd, ...args] = process.argv.slice(2);

  switch (cmd) {
    // ============ SETUP ============
    case 'onboard': {
      const paperOnly = args.includes('--paper-only');
      const full = args.includes('--full');
      if (full) {
        await runOnboard(paperOnly);
      } else {
        await runFastOnboard({ paperOnly });
      }
      break;
    }

    case 'status': {
      await showStatus();
      break;
    }

    // ============ RUNNING ============
    case 'run':
    case 'serve':
    case 'gateway': {
      if (!isOnboarded()) {
        printError('OpenTradex is not configured.');
        print('Run: opentradex onboard');
        process.exit(1);
      }

      const config = loadConfig()!;
      printBadge();

      // Check if trading is halted
      const haltStatus = isTradingHalted();
      if (haltStatus.halted) {
        printWarning(`Trading halted: ${haltStatus.reason}`);
      }

      const harness = new OpenTradex({
        kalshi: config.rails.kalshi.enabled ? {
          apiKey: config.rails.kalshi.apiKey,
          privateKey: config.rails.kalshi.privateKey,
          demo: config.rails.kalshi.demo,
        } : undefined,
        alpaca: config.rails.alpaca.enabled ? {
          apiKey: config.rails.alpaca.apiKey,
          secretKey: config.rails.alpaca.secretKey,
          paper: config.rails.alpaca.demo,
        } : undefined,
      });

      const port = parseInt(args[0]) || config.port;
      const host = config.bindMode === 'local' ? '127.0.0.1' : '0.0.0.0';

      const gateway = createGateway(harness, { port, host });
      await gateway.start();

      print(`\nMode: ${config.tradingMode}`);
      print(`Rails: ${Object.entries(config.rails).filter(([, v]) => v.enabled).map(([k]) => k).join(', ')}`);
      print(`Risk: $${config.risk.maxPositionUsd} max position, ${config.risk.maxOpenPositions} max concurrent`);
      print('\nPress Ctrl+C to stop, or run: opentradex panic');
      break;
    }

    // ============ EMERGENCY ============
    case 'panic': {
      print('\x1b[41m\x1b[37m PANIC - EMERGENCY STOP \x1b[0m\n');

      const result = panicFlatten();

      if (result.flattened.length > 0) {
        print(`Flattened ${result.flattened.length} position(s):`);
        for (const pos of result.flattened) {
          print(`  ${pos.exchange}:${pos.symbol} - P&L: $${pos.pnl.toFixed(2)}`);
        }
        print(`\nTotal P&L: $${result.totalPnL.toFixed(2)}`);
      } else {
        print('No open positions to flatten.');
      }

      print('\nTrading halted. Restart with: opentradex run');
      break;
    }

    // ============ MARKET DATA ============
    case 'scan': {
      const harness = new OpenTradex();
      const exchange = args[0] as Exchange | undefined;
      const limit = parseInt(args[1] || '20');

      if (exchange) {
        const markets = await harness.exchange(exchange).scan(limit);
        print(JSON.stringify(markets, null, 2));
      } else {
        const markets = await harness.scanAll(limit);
        print(JSON.stringify(markets, null, 2));
      }
      break;
    }

    case 'search': {
      const harness = new OpenTradex();
      const query = args[0];
      const exchange = args[1] as Exchange | undefined;

      if (!query) {
        printError('Usage: opentradex search <query> [exchange]');
        process.exit(1);
      }

      if (exchange) {
        const markets = await harness.exchange(exchange).search(query);
        print(JSON.stringify(markets, null, 2));
      } else {
        const markets = await harness.searchAll(query);
        print(JSON.stringify(markets, null, 2));
      }
      break;
    }

    case 'quote': {
      const harness = new OpenTradex();
      const exchange = args[0] as Exchange;
      const symbol = args[1];

      if (!exchange || !symbol) {
        printError('Usage: opentradex quote <exchange> <symbol>');
        process.exit(1);
      }

      const quote = await harness.exchange(exchange).quote(symbol);
      print(JSON.stringify(quote, null, 2));
      break;
    }

    case 'exchanges': {
      const harness = new OpenTradex();
      print(JSON.stringify(harness.exchanges, null, 2));
      break;
    }

    // ============ RISK ============
    case 'risk': {
      if (!isOnboarded()) {
        printError('OpenTradex is not configured.');
        process.exit(1);
      }

      const config = loadConfig()!;
      const state = getRiskState();
      const halted = isTradingHalted();

      printBadge();

      print('Risk State:');
      print(`  Daily P&L:       $${state.dailyPnL.toFixed(2)}`);
      print(`  Daily Trades:    ${state.dailyTrades}`);
      print(`  Open Positions:  ${state.openPositions.length}`);
      print(`  Trading Halted:  ${halted.halted ? `YES - ${halted.reason}` : 'No'}`);

      print('\nRisk Limits:');
      print(`  Max Position:    $${config.risk.maxPositionUsd}`);
      print(`  Max Daily Loss:  $${config.risk.maxDailyLossUsd}`);
      print(`  Max Positions:   ${config.risk.maxOpenPositions}`);

      if (state.openPositions.length > 0) {
        print('\nOpen Positions:');
        for (const pos of state.openPositions) {
          const pnlColor = pos.pnl >= 0 ? '\x1b[32m' : '\x1b[31m';
          print(`  ${pos.exchange}:${pos.symbol} ${pos.side} ${pos.size} @ $${pos.avgPrice.toFixed(2)} | ${pnlColor}$${pos.pnl.toFixed(2)}\x1b[0m`);
        }
      }
      break;
    }

    // ============ CONFIG ============
    case 'config': {
      const subCmd = args[0];

      if (subCmd === 'path') {
        print(CONFIG_DIR);
      } else if (subCmd === 'show') {
        const config = loadConfig();
        print(JSON.stringify(config, null, 2));
      } else if (subCmd === 'mode') {
        print(readModeLock() || 'not set');
      } else {
        print('Usage: opentradex config <path|show|mode>');
      }
      break;
    }

    // ============ MCP SERVER ============
    case 'mcp': {
      await startMCPServer();
      break;
    }

    // ============ AI ============
    case 'ai': {
      const subCmd = args[0];

      if (subCmd === 'status') {
        const ai = getAI();
        const config = ai.getConfig();
        print(`AI Status: ${ai.isAvailable() ? '\x1b[32mAvailable\x1b[0m' : '\x1b[31mNot configured\x1b[0m'}`);
        print(`Model: ${config.model}`);
        print(`API Key: ${config.hasApiKey ? 'Configured' : 'Not set'}`);
      } else if (subCmd === 'init') {
        const apiKey = args[1] || process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          printError('Usage: opentradex ai init <api-key>');
          printError('Or set ANTHROPIC_API_KEY environment variable');
          process.exit(1);
        }
        const success = initializeAI(apiKey);
        if (success) {
          printSuccess('AI initialized successfully!');
        } else {
          printError('Failed to initialize AI');
        }
      } else if (subCmd === 'chat') {
        const message = args.slice(1).join(' ');
        if (!message) {
          printError('Usage: opentradex ai chat <message>');
          process.exit(1);
        }
        const ai = getAI();
        if (!ai.isAvailable()) {
          printError('AI not configured. Run: opentradex ai init <api-key>');
          process.exit(1);
        }
        print('Thinking...\n');
        const response = await ai.chat(message);
        print(response.content);
      } else {
        print('Usage: opentradex ai <status|init|chat>');
        print('');
        print('  status         Check AI availability');
        print('  init <key>     Initialize with API key');
        print('  chat <msg>     Send a message to the AI');
      }
      break;
    }

    // ============ x402 PAYMENTS ============
    case 'x402': {
      const subCmd = args[0];
      const { loadX402Settings, saveX402Settings, addressFromKey, readLedger } =
        await import('../x402/index.js');

      if (!subCmd || subCmd === 'setup') {
        await runX402Onboard();
      } else if (subCmd === 'status') {
        const s = loadX402Settings();
        print(`x402 Payments: ${s.enabled ? '\x1b[32mENABLED\x1b[0m' : '\x1b[33mdisabled\x1b[0m'}`);
        print(`  Chain:         ${s.chain}`);
        print(`  Max per call:  $${s.maxPaymentUsd}`);
        if (s.enabled && s.privateKey) {
          const address = await addressFromKey(s.privateKey);
          print(`  Address:       ${address}`);
          if (s.chain === 'base-sepolia') {
            print(`  Faucet:        https://faucet.circle.com`);
          }
        }
      } else if (subCmd === 'ledger') {
        const limit = parseInt(args[1] || '20');
        const entries = readLedger(limit);
        if (entries.length === 0) {
          print('No x402 payments recorded yet.');
        } else {
          print(`Last ${entries.length} payments:`);
          for (const e of entries) {
            const amt = `$${e.amountUsd.toFixed(4)}`.padStart(9);
            const tx = e.txHash ? e.txHash.slice(0, 12) + '…' : 'pending';
            print(`  ${e.timestamp.slice(11, 19)} ${e.direction.padEnd(3)} ${amt} ${tx}  ${e.url.slice(0, 48)}`);
          }
        }
      } else if (subCmd === 'disable') {
        saveX402Settings({ privateKey: null });
        printSuccess('x402 disabled. Outbound calls fall back to plain fetch.');
      } else {
        print('Usage: opentradex x402 <setup|status|ledger|disable>');
        print('');
        print('  setup         Interactive wizard (chain, max, key)');
        print('  status        Show current x402 configuration');
        print('  ledger [n]    Show last N payments (default 20)');
        print('  disable       Clear the private key and turn payments off');
      }
      break;
    }

    // ============ VERSION ============
    case 'version':
    case '-v':
    case '--version': {
      print(`opentradex v${VERSION}`);
      break;
    }

    // ============ HELP ============
    default: {
      print(`
\x1b[1mOpenTradex\x1b[0m v${VERSION} - Multi-market AI trading harness

\x1b[1mSETUP\x1b[0m
  opentradex onboard [--paper-only]   Quick setup (5 prompts; --full for the long flow)
  opentradex status                   Show current configuration

\x1b[1mRUNNING\x1b[0m
  opentradex run [port]               Start the gateway (default: 3210)
  opentradex panic                    Emergency stop - flatten all positions

\x1b[1mMARKET DATA\x1b[0m
  opentradex scan [exchange] [n]      Scan markets (all or specific)
  opentradex search <query> [exch]    Search markets
  opentradex quote <exchange> <sym>   Get quote with orderbook
  opentradex exchanges                List available exchanges

\x1b[1mRISK\x1b[0m
  opentradex risk                     Show risk state and positions

\x1b[1mAI\x1b[0m
  opentradex ai status                Check AI availability
  opentradex ai init <api-key>        Initialize with Anthropic API key
  opentradex ai chat <message>        Send a message to the AI

\x1b[1mx402 PAYMENTS\x1b[0m
  opentradex x402 setup               Configure agentic USDC payments
  opentradex x402 status              Show wallet address + chain
  opentradex x402 ledger [n]          Show last N payments
  opentradex x402 disable             Turn payments off

\x1b[1mINTEGRATIONS\x1b[0m
  opentradex mcp                      Start MCP server for Claude Code

\x1b[1mCONFIG\x1b[0m
  opentradex config path              Show config directory
  opentradex config show              Dump full configuration
  opentradex config mode              Show trading mode lock

\x1b[1mEXCHANGES\x1b[0m
  kalshi       Prediction markets (elections, events)
  polymarket   Prediction markets (crypto-native)
  alpaca       US stocks, ETFs, options, crypto
  tradingview  Stock data via Yahoo Finance
  crypto       Cryptocurrency via CoinGecko + Kraken

\x1b[1mEXAMPLES\x1b[0m
  opentradex onboard --paper-only     # Safe setup, paper trading only
  opentradex run                      # Start gateway
  opentradex scan kalshi 10           # Scan top 10 Kalshi markets
  opentradex search "bitcoin"         # Search across all exchanges
  opentradex quote crypto BTC         # Get Bitcoin quote
`);
    }
  }
}

main().catch((err) => {
  printError(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
