/**
 * AI → Agent/Harness intent router.
 *
 * Two input styles accepted:
 *   - Slash commands: "/autotrade on", "/buy 10 AAPL"
 *   - Natural language: "start trading random stocks"
 *
 * Deterministic by design — regex beats LLM tool-calling here because every
 * provider (openai, anthropic, ollama, gemini-cli, claude-cli, opencode-cli)
 * speaks a different tool-calling dialect and many don't speak it at all.
 */

import { getAgent, AgentConfig } from '../agent/index.js';
import { getRiskState, panicFlatten, getOpenPositions } from '../risk.js';
import { getAI } from './index.js';
import type { OpenTradex } from '../index.js';

export interface IntentContext {
  harness: OpenTradex;
  broadcast: (event: string, data: unknown) => void;
}

export interface IntentResult {
  action: string;
  reply: string;
  data?: unknown;
}

type Handler = (
  match: RegExpMatchArray,
  command: string,
  ctx: IntentContext
) => Promise<IntentResult> | IntentResult;

interface Intent {
  name: string;
  help: string;
  pattern: RegExp;
  handler: Handler;
}

function fmtPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

const INTENTS: Intent[] = [
  // HELP — /help, /commands
  {
    name: 'help',
    help: '/help — list available commands',
    pattern: /^\s*\/?(help|commands|\?)\s*$/i,
    handler: () => ({
      action: 'help',
      reply:
        'OpenTradex commands (slash or natural language):\n\n' +
        INTENTS.filter((i) => i.name !== 'help')
          .map((i) => `  ${i.help}`)
          .join('\n') +
        '\n\nExamples:\n  "start trading"  → autonomous mode\n  "/buy 10 AAPL"   → manual buy\n  "panic"          → flatten everything',
    }),
  },

  // AUTOTRADE — /autotrade, /autotrade on, /autotrade off
  {
    name: 'autotrade',
    help: '/autotrade [on|off] — toggle autonomous trading (default: on)',
    pattern: /^\s*\/autotrade(?:\s+(on|off|enable|disable|true|false))?\s*$/i,
    handler: async (match, _c, ctx) => {
      const arg = (match[1] || 'on').toLowerCase();
      const turnOn = /^(on|enable|true)$/.test(arg);
      const agent = getAgent();
      if (turnOn) {
        agent.updateConfig({ autoLoop: true });
        if (!agent.getStatus().running) await agent.start();
        else agent.setAutoLoop(true);
        ctx.broadcast('agent', { event: 'started', status: agent.getStatus() });
        return {
          action: 'autotrade.on',
          reply: 'Autonomous trading ON. Agent will scan → risk-check → execute every cycle.',
          data: agent.getStatus(),
        };
      }
      agent.stop();
      ctx.broadcast('agent', { event: 'stopped', status: agent.getStatus() });
      return { action: 'autotrade.off', reply: 'Autonomous trading OFF.', data: agent.getStatus() };
    },
  },

  // START — natural language
  {
    name: 'agent.start',
    help: 'start trading / begin trading — start autonomous agent',
    pattern: /\b(start|begin|go|enable|activate|run|kick.?off)\b[^.]{0,40}?\b(trad(e|ing)?|auto(?:-?loop)?|agent|bot)\b/i,
    handler: async (_m, command, ctx) => {
      const agent = getAgent();
      const wantsLoop = !/\b(once|single|one.?shot|no.?loop|manual)\b/i.test(command);
      agent.updateConfig({ autoLoop: wantsLoop });
      await agent.start();
      ctx.broadcast('agent', { event: 'started', status: agent.getStatus() });
      return {
        action: 'agent.start',
        reply: `Autonomous trading started${wantsLoop ? ' (auto-loop on)' : ' (single cycle)'}. Mode: ${agent.getConfig().mode}.`,
        data: agent.getStatus(),
      };
    },
  },

  // STOP — natural language
  {
    name: 'agent.stop',
    help: 'stop trading / pause — stop autonomous agent',
    pattern: /\b(stop|halt|pause|kill|shut.?down)\b[^.]{0,40}?\b(trad(e|ing)?|auto(?:-?loop)?|agent|bot)\b/i,
    handler: (_m, _c, ctx) => {
      const agent = getAgent();
      agent.stop();
      ctx.broadcast('agent', { event: 'stopped', status: agent.getStatus() });
      return {
        action: 'agent.stop',
        reply: `Autonomous trading stopped. Cycles: ${agent.getStatus().cycles}.`,
        data: agent.getStatus(),
      };
    },
  },

  // INTERVAL — /interval 30
  {
    name: 'interval',
    help: '/interval <seconds> — set scan cadence',
    pattern: /^\s*\/interval\s+(\d+)\s*$/i,
    handler: (match, _c, ctx) => {
      const seconds = parseInt(match[1], 10);
      if (seconds < 5 || seconds > 3600) {
        return { action: 'interval.invalid', reply: 'Interval must be between 5 and 3600 seconds.' };
      }
      const agent = getAgent();
      agent.updateConfig({ scanInterval: seconds * 1000 });
      ctx.broadcast('agent', { event: 'config-updated', config: agent.getConfig() });
      return {
        action: 'interval.set',
        reply: `Scan interval set to ${seconds}s. ${agent.getStatus().running ? 'Restarting auto-loop...' : ''}`,
        data: agent.getConfig(),
      };
    },
  },

  // FOCUS — /focus AAPL MSFT
  {
    name: 'focus',
    help: '/focus <SYM1 SYM2 ...> — restrict scanner to these symbols',
    pattern: /^\s*\/focus\s+(.+?)\s*$/i,
    handler: (match, _c, ctx) => {
      const symbols = match[1]
        .split(/[\s,]+/)
        .filter(Boolean)
        .map((s) => s.toUpperCase());
      if (!symbols.length) {
        return { action: 'focus.empty', reply: 'Provide at least one symbol.' };
      }
      const agent = getAgent();
      agent.getScanner().setWatchlist(symbols);
      ctx.broadcast('agent', { event: 'watchlist-updated', watchlist: symbols });
      return {
        action: 'focus.set',
        reply: `Scanner focused on: ${symbols.join(', ')}`,
        data: symbols,
      };
    },
  },

  // UNFOCUS — /unfocus
  {
    name: 'unfocus',
    help: '/unfocus — clear focus, scanner uses default watchlist',
    pattern: /^\s*\/unfocus\s*$/i,
    handler: (_m, _c, ctx) => {
      const agent = getAgent();
      agent.getScanner().setWatchlist([]);
      const list = agent.getScanner().getWatchlist();
      ctx.broadcast('agent', { event: 'watchlist-updated', watchlist: list });
      return {
        action: 'unfocus',
        reply: `Focus cleared. Scanner using default watchlist (${list.length} symbols).`,
        data: list,
      };
    },
  },

  // JOURNAL — /journal
  {
    name: 'journal',
    help: '/journal — summary of today\'s trading activity',
    pattern: /^\s*\/?(journal|today|summary|recap)\s*$/i,
    handler: async () => {
      const agent = getAgent();
      const journal = agent.getJournal();
      const status = agent.getStatus();
      const risk = getRiskState();
      if (!journal.length) {
        return { action: 'journal.empty', reply: 'No cycles recorded yet. Start the agent with "/autotrade on".' };
      }
      const totalOpps = journal.reduce((s, j) => s + j.opportunities, 0);
      const totalExec = journal.reduce((s, j) => s + j.executed, 0);
      const last = journal[journal.length - 1];
      const base =
        `Session journal:\n` +
        `- Cycles: ${journal.length}\n` +
        `- Opportunities found: ${totalOpps}\n` +
        `- Trades executed: ${totalExec}\n` +
        `- Open positions: ${status.openPositions}\n` +
        `- Daily P&L: $${risk.dailyPnL.toFixed(2)}\n` +
        `- Last cycle: #${last.cycle} @ ${last.ts.toLocaleTimeString()} (${last.executed}/${last.opportunities} executed)`;

      // Try to layer AI narration on top, but never fail on it.
      const ai = getAI();
      if (ai.isAvailable()) {
        try {
          const narration = await ai.chat(
            `You are a trading coach. In 2 short sentences, narrate today's session:\n${base}\n\nKeep it tight, no fluff.`,
            { role: 'reasoning', maxTokens: 120 }
          );
          return { action: 'journal', reply: `${base}\n\n${narration.content}`, data: journal };
        } catch {
          /* fall through */
        }
      }
      return { action: 'journal', reply: base, data: journal };
    },
  },

  // EXPLAIN — /explain
  {
    name: 'explain',
    help: '/explain — why did the last cycle do what it did?',
    pattern: /^\s*\/?(explain|why|reasoning)\s*$/i,
    handler: async () => {
      const agent = getAgent();
      const journal = agent.getJournal();
      if (!journal.length) {
        return { action: 'explain.empty', reply: 'No cycles yet. Start the agent first.' };
      }
      const last = journal[journal.length - 1];
      const base = `Last cycle (#${last.cycle}, ${last.ts.toLocaleTimeString()}): scanner found ${last.opportunities} opportunities, risk manager approved ${last.executed}.`;
      const ai = getAI();
      if (ai.isAvailable()) {
        try {
          const narration = await ai.chat(
            `In one short paragraph, explain what the trading agent is doing given: ${base}. Current open positions: ${agent.getStatus().openPositions}. Be concrete.`,
            { role: 'reasoning', maxTokens: 150 }
          );
          return { action: 'explain', reply: `${base}\n\n${narration.content}`, data: last };
        } catch {
          /* fall through */
        }
      }
      return { action: 'explain', reply: base, data: last };
    },
  },

  // STATUS — /status
  {
    name: 'status',
    help: '/status — combined agent + risk snapshot',
    pattern: /^\s*\/?(status|state|health)\s*$/i,
    handler: () => {
      const agent = getAgent();
      const s = agent.getStatus();
      const r = getRiskState();
      const wl = agent.getScanner().getWatchlist();
      return {
        action: 'status',
        reply:
          `Agent: ${s.running ? 'RUNNING' : 'stopped'}${agent.getConfig().autoLoop ? ' (auto-loop on)' : ''}\n` +
          `Cycles: ${s.cycles} · Errors: ${s.errors}\n` +
          `Watchlist: ${wl.slice(0, 8).join(', ')}${wl.length > 8 ? ` (+${wl.length - 8})` : ''}\n` +
          `Scan cadence: ${agent.getConfig().scanInterval / 1000}s\n` +
          `Open positions: ${r.openPositions.length}\n` +
          `Daily P&L: $${r.dailyPnL.toFixed(2)} · Trades today: ${r.dailyTrades}`,
        data: { agent: s, risk: r, watchlist: wl },
      };
    },
  },

  // AUTOLOOP — legacy
  {
    name: 'agent.autoloop',
    help: 'autoloop on/off — toggle loop without stopping agent',
    pattern: /\bauto.?loop\b.*\b(on|off|enable|disable|true|false)\b/i,
    handler: (_m, command, ctx) => {
      const enabled = /\b(on|enable|true)\b/i.test(command);
      const agent = getAgent();
      agent.setAutoLoop(enabled);
      ctx.broadcast('agent', { event: 'autoloop', enabled, status: agent.getStatus() });
      return {
        action: 'agent.autoloop',
        reply: `Auto-loop ${enabled ? 'enabled' : 'disabled'}.`,
        data: { enabled, status: agent.getStatus() },
      };
    },
  },

  // PANIC — /panic, natural
  {
    name: 'risk.panic',
    help: '/panic — flatten all positions, stop agent',
    pattern: /^\s*\/?(panic|flatten|close\s+all|emergency|liquidate|dump\s+everything)\s*$/i,
    handler: (_m, _c, ctx) => {
      const agent = getAgent();
      if (agent.getStatus().running) agent.stop();
      const result = panicFlatten();
      ctx.broadcast('panic', result);
      ctx.broadcast('agent', { event: 'stopped', status: agent.getStatus() });
      return {
        action: 'risk.panic',
        reply: `PANIC executed. Flattened ${result.flattened.length} position(s). Realized P&L: $${result.totalPnL.toFixed(2)}.`,
        data: result,
      };
    },
  },

  // SCAN — /scan, natural
  {
    name: 'scan',
    help: '/scan — one-shot market scan',
    pattern: /(?:^\s*\/?scan\s*$)|\b(scan|find|search|show\s+me)\b[^.]{0,40}\b(market|opportunit|trade|setup|signal)/i,
    handler: async (_m, _c, ctx) => {
      const markets = await ctx.harness.scanAll(10);
      ctx.broadcast('scan', { markets });
      const top = markets.slice(0, 5);
      const lines = top.map((m) => `- ${m.exchange}: ${m.symbol} @ $${Number(m.price).toFixed(2)}`);
      return {
        action: 'scan',
        reply: `Scanned ${markets.length} markets. Top 5:\n${lines.join('\n')}`,
        data: markets,
      };
    },
  },

  // RISK
  {
    name: 'risk',
    help: '/risk — daily P&L, trades, win rate',
    pattern: /(?:^\s*\/?risk\s*$)|\bp[&n]l\b|\bpnl\b|\bdaily(?:\s+loss)?\b|\bexposure\b|\bdrawdown\b/i,
    handler: () => {
      const state = getRiskState();
      return {
        action: 'risk',
        reply:
          `Risk State:\n` +
          `- Daily P&L: $${state.dailyPnL.toFixed(2)}\n` +
          `- Open Positions: ${state.openPositions.length}\n` +
          `- Trades Today: ${state.dailyTrades}\n` +
          `- Win Rate: ${state.dailyTrades > 0 ? fmtPct((state.dailyWins / state.dailyTrades) * 100) : 'n/a'}`,
        data: state,
      };
    },
  },

  // POSITIONS
  {
    name: 'positions',
    help: '/positions — list open positions',
    pattern: /^\s*\/?(positions?|holdings?)\s*$|\bwhat\s+am\s+i\s+(in|holding)\b/i,
    handler: () => {
      const positions = getOpenPositions();
      if (positions.length === 0) return { action: 'positions', reply: 'No open positions.', data: [] };
      const lines = positions.map(
        (p) =>
          `- ${p.symbol} (${p.exchange}) ${p.side} ${p.size} @ $${p.avgPrice.toFixed(2)} · now $${p.currentPrice.toFixed(2)} · P&L ${fmtPct(p.pnlPercent)}`
      );
      return {
        action: 'positions',
        reply: `${positions.length} open position(s):\n${lines.join('\n')}`,
        data: positions,
      };
    },
  },

  // BUY — /buy 10 AAPL, "buy 10 AAPL"
  {
    name: 'trade.buy',
    help: '/buy <qty> <SYMBOL> — manual market buy',
    pattern: /^\s*\/?(buy|long|go\s+long)\s+(?:(\d+(?:\.\d+)?)\s+)?([A-Za-z][A-Za-z0-9/-]{0,15})\s*$/i,
    handler: async (match, _c, ctx) => {
      const qty = match[2] ? parseFloat(match[2]) : 1;
      const symbol = match[3].toUpperCase();
      try {
        const result = await getAgent().manualTrade({ symbol, side: 'buy', quantity: qty, type: 'market' });
        ctx.broadcast('trade', { symbol, side: 'buy', quantity: qty, price: result?.price ?? 0 });
        return { action: 'trade.buy', reply: `Bought ${qty} ${symbol} at market.`, data: result };
      } catch (err) {
        return { action: 'trade.buy.rejected', reply: `Buy rejected: ${(err as Error).message}` };
      }
    },
  },

  // SELL — /sell 10 AAPL
  {
    name: 'trade.sell',
    help: '/sell <qty> <SYMBOL> — manual market sell (or close)',
    pattern: /^\s*\/?(sell|short|close)\s+(?:(\d+(?:\.\d+)?)\s+)?([A-Za-z][A-Za-z0-9/-]{0,15})\s*$/i,
    handler: async (match, _c, ctx) => {
      const qty = match[2] ? parseFloat(match[2]) : 1;
      const symbol = match[3].toUpperCase();
      try {
        const result = await getAgent().manualTrade({ symbol, side: 'sell', quantity: qty, type: 'market' });
        ctx.broadcast('trade', { symbol, side: 'sell', quantity: qty, price: result?.price ?? 0 });
        return { action: 'trade.sell', reply: `Sold ${qty} ${symbol} at market.`, data: result };
      } catch (err) {
        return { action: 'trade.sell.rejected', reply: `Sell rejected: ${(err as Error).message}` };
      }
    },
  },
];

export async function routeIntent(command: string, ctx: IntentContext): Promise<IntentResult | null> {
  for (const intent of INTENTS) {
    const match = command.match(intent.pattern);
    if (match) {
      try {
        return await intent.handler(match, command, ctx);
      } catch (err) {
        return { action: `${intent.name}.error`, reply: `Action "${intent.name}" failed: ${(err as Error).message}` };
      }
    }
  }
  return null;
}
