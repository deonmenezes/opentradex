# Open Trademaxxxing

**An autonomous AI agent that trades prediction markets by reading the news before the crowd.**

---

## How It Works

A human submits a thesis, or the agent self-discovers opportunities. It scrapes news, reads primary sources, estimates probabilities, and trades when it finds edge. No rules engine. No hardcoded strategies. Pure reasoning.

```
"Bondi was fired April 2. Market still at 82¢ YES for 'leaves before Apr 5.'
 That's near-arbitrage. Buying 10 contracts." - Open Trademaxxxing, Cycle 1
```

The agent found this on its first run. Bondi's firing was confirmed by CNN, Fox, NPR, NBC, WaPo — but the prediction market hadn't caught up. The agent bought YES at 82¢ for a near-certain $1.00 payout.

---

## Architecture: The Paperclip Pattern

The core insight: **Claude Code IS the agent.** We don't call the Anthropic API. We spawn the `claude` CLI as a subprocess, which gives us a full reasoning agent with built-in tool use — web search, file I/O, bash execution — at zero marginal LLM cost on a Max subscription.

```
                           ┌──────────────────────────────────┐
                           │         ORCHESTRATOR             │
                           │           main.py                │
                           │                                  │
                           │  Spawns Claude Code subprocess   │
                           │  Pipes prompt → streams output   │
                           │  Manages cycle lifecycle         │
                           └────────────┬─────────────────────┘
                                        │
                                   stdin/stdout
                                  (stream-json)
                                        │
┌───────────────────────────────────────▼───────────────────────────────────────┐
│                                                                              │
│                        CLAUDE CODE  (the reasoning engine)                   │
│                                                                              │
│   Reads SOUL.md for identity, risk rules, and strategy principles            │
│   Reads strategy_notes.md for accumulated experience across sessions         │
│   Decides what to research, what to trade, when to exit                      │
│                                                                              │
│   ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│   │WebSearch│  │ WebFetch │  │   Bash   │  │  Read/   │  │    Write     │   │
│   │(native) │  │ (native) │  │ (native) │  │  Glob    │  │   (native)   │   │
│   └────┬────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘   │
│        │            │             │              │               │           │
│        │    Searches Google,      │     Reads    │      Writes   │           │
│        │    reads articles,       │    SOUL.md,  │   strategy    │           │
│        │    follows links         │    notes,    │    notes,     │           │
│        │                          │    data      │   rationale   │           │
│        │                          │              │   responses   │           │
│        │            ┌─────────────▼──────────────┤               │           │
│        │            │     Python CLI Tools        │               │           │
│        │            │  (invoked via Bash tool)    │               │           │
│        │            │                             │               │           │
│        │            │  gossip/kalshi.py            │               │           │
│        │            │    → scan, search, market    │               │           │
│        │            │    → orderbook, order        │               │           │
│        │            │    → positions, balance      │               │           │
│        │            │                             │               │           │
│        │            │  gossip/trader.py            │               │           │
│        │            │    → trade, exit, settle     │               │           │
│        │            │    → portfolio, prices       │               │           │
│        │            │    → Kelly sizing, risk      │               │           │
│        │            │                             │               │           │
│        │            │  gossip/news.py              │               │           │
│        │            │    → Google News, Twitter    │               │           │
│        │            │    → article extraction      │               │           │
│        │            └──────────────┬──────────────┘               │           │
│        │                           │                              │           │
└────────┼───────────────────────────┼──────────────────────────────┼───────────┘
         │                           │                              │
         │              ┌────────────▼────────────┐                 │
         │              │       DATA LAYER        │                 │
         │              │                         │                 │
         │              │  SQLite (WAL mode)      │                 │
         │              │  trades.json            │                 │
         │              │  strategy_notes.md      │◄────────────────┘
         │              │  user_rationales.json   │
         │              └────────────┬────────────┘
         │                           │
         │              ┌────────────▼────────────┐
         │              │    NEXT.JS DASHBOARD    │
         │              │                         │
         │              │  Live agent stream      │
         │              │  Portfolio + P&L        │
         │              │  Position management    │
         │              │  Market scanner         │
         │              │  News feed (RSS)        │
         │              │  Thesis submission      │
         │              └─────────────────────────┘
```

### Why This Architecture Is Different

| Traditional AI Trading Bot | Open Trademaxxxing |
|---|---|
| API calls per inference ($$$) | Claude Code subprocess (zero marginal cost) |
| Hardcoded strategy rules | LLM reasons about each market independently |
| Fixed data sources | Agent decides what to search, follows links |
| Stateless between runs | strategy_notes.md = persistent memory |
| No self-improvement | Agent writes lessons learned, reads them next cycle |
| Rule-based entry/exit | Bayesian reasoning with probabilistic edge estimation |

### The Agentic Loop

Each cycle, the agent:

1. **Reads its soul** — `SOUL.md` defines identity, risk discipline, and thinking framework
2. **Recalls past experience** — `strategy_notes.md` contains lessons from every previous cycle
3. **Auto-settles resolved markets** — checks Kalshi for markets that have resolved, returns capital
4. **Reviews open positions** — fetches live prices, calculates unrealized P&L, re-evaluates theses
5. **Discovers opportunities** — scans Kalshi events, searches for specific topics it knows have edge
6. **Researches deeply** — web search, news scraping, primary source analysis
7. **Estimates probability** — Bayesian reasoning: base rate → evidence → posterior
8. **Sizes and executes** — Half-Kelly position sizing with hard risk limits
9. **Writes memory** — records what it learned for the next cycle

The agent is not following a script. It decides what to research, which markets to skip, when to exit positions, and what's worth remembering. The Python tools are capabilities, not instructions.

### Session Architecture: Fresh Context, Persistent Memory

Every cycle spawns a fresh Claude Code session. No conversation history bloat. But state persists through three mechanisms:

- **SQLite** — trades, portfolio, market snapshots, news, agent logs
- **strategy_notes.md** — agent-written free-form memory (lessons, observations, market regimes)
- **SOUL.md** — immutable identity and risk rules the agent reads every session

This gives us the best of both worlds: clean reasoning context + accumulated trading intelligence.

---

## The SOUL

Every agent session reads [`SOUL.md`](SOUL.md) first. It defines:

- **Identity** — "You think like a quant at a prop trading firm. You don't guess."
- **Edge theory** — why the agent beats the crowd (speed, primary sources, math, non-obvious connections)
- **Thinking framework** — base rates first, Bayesian updating, counterfactual reasoning
- **Risk discipline** — hard limits the agent cannot override
- **Anti-patterns** — what the agent explicitly does NOT do (trade on vibes, chase FOMO, hold losers)

The SOUL ensures consistent behavior across sessions without carrying conversation context.

---

## Risk Engine

The agent operates within hard guardrails it cannot override:

| Rule | Value | Why |
|------|-------|-----|
| Max position size | 30% of bankroll | No single bet can blow up the account |
| Max concurrent positions | 5 | Diversification, capital allocation |
| Minimum edge to enter | 10 percentage points | Only trade clear mispricings |
| Position sizing | Half-Kelly | Kelly criterion with 50% haircut for estimation error |
| Exit trigger | Thesis invalidated | Don't hold losers out of stubbornness |
| Profit-taking | Edge < 5pp | Lock in gains when the market catches up |

---

## Dashboard

Real-time Next.js dashboard with:

- **Live agent stream** — watch the agent think, search, and trade in real-time with rendered markdown
- **Portfolio metrics** — bankroll, realized P&L, unrealized P&L, win rate, trade count
- **Position cards** — expandable reasoning, live mark-to-market prices, Kalshi links
- **Market scanner** — sortable table of active Kalshi markets
- **News feed** — live Google News RSS with source favicons
- **Thesis input** — submit a trading thesis for the agent to research
- **Agent control** — run cycles, start loops, configure interval

---

## Quick Start

```bash
# Install
pip install -r requirements.txt
cd web && npm install && cd ..

# Configure
cp .env.example .env
# Set: KALSHI_API_KEY_ID, KALSHI_PRIVATE_KEY_PATH, APIFY_API_TOKEN

# Run one cycle
python3 main.py

# Run continuous loop
python3 main.py --loop --interval 900

# Submit a thesis
python3 main.py --rationale "Tariffs on China will escalate next week"

# Dashboard
cd web && npm run dev
# → http://localhost:3000
```

## Stack

| Layer | Technology |
|-------|-----------|
| Reasoning engine | Claude Code CLI (Paperclip pattern) |
| Market data | Kalshi REST API (RSA-PSS authenticated) |
| News ingestion | Google News RSS, Apify scrapers, native web search |
| Trading engine | Python — Kelly sizing, orderbook pricing, risk checks |
| Persistence | SQLite (WAL mode) + JSON + Markdown |
| Dashboard | Next.js 16, React 19, Tailwind CSS, TypeScript |
| Agent memory | SOUL.md (identity) + strategy_notes.md (experience) |

---
