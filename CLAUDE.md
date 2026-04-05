# Open Trademaxxxing - LLM Context

Read this file at the start of every session. This is everything you need to operate on this codebase.

## What This Is

An autonomous prediction market trading agent for Kalshi. Claude Code is the brain — it's spawned as a subprocess by `main.py`, reads market data and news, reasons about probabilities, and paper trades.

## How to Run

```bash
# Single cycle
python3 main.py

# Continuous loop
python3 main.py --loop --interval 900

# Research a user thesis
python3 main.py --rationale "I think tariffs will escalate"

# Dashboard
cd web && npm run dev  # http://localhost:3000
```

## Architecture

- `main.py` spawns `claude --print --dangerously-skip-permissions` as subprocess
- Claude Code runs tools (Bash, WebSearch, etc.) to scan markets, scrape news, trade
- All state in SQLite (`data/gossip.db`) + JSON (`data/trades.json`)
- `SOUL.md` defines agent personality/strategy — every spawned agent reads it
- `data/strategy_notes.md` is agent-maintained memory across sessions
- `web/` is a Next.js dashboard reading from the same SQLite

## Key Files

| File | Purpose |
|------|---------|
| `SOUL.md` | Agent personality, strategy, risk rules |
| `SPEC.md` | Full technical spec |
| `main.py` | Orchestrator — spawns Claude Code, handles prompts, streams output |
| `gossip/kalshi.py` | Kalshi API: `quick` (fast scan), `scan` (deep), `market`, `orderbook`, `search`, `order` |
| `gossip/news.py` | Apify: Google News, Twitter, web search, article extraction |
| `gossip/trader.py` | Paper trading, Kelly sizing, portfolio, risk checks |
| `gossip/db.py` | SQLite schema + queries for trades, news, snapshots, agent logs |
| `web/src/app/page.tsx` | Dashboard main page |
| `web/src/lib/db.ts` | SQLite connection for Next.js API routes |
| `web/src/app/api/` | REST endpoints: portfolio, trades, news, markets, agent, agent/stream |

## CLI Tools (used by the agent)

Always prefix with `PYTHONPATH=.`:

```bash
PYTHONPATH=. python3 gossip/kalshi.py quick --limit 40          # fast market scan (~5s)
PYTHONPATH=. python3 gossip/kalshi.py market TICKER             # market details + orderbook
PYTHONPATH=. python3 gossip/kalshi.py orderbook TICKER          # full orderbook
PYTHONPATH=. python3 gossip/kalshi.py search "query"            # search events

PYTHONPATH=. python3 gossip/news.py --keywords "bitcoin,tariff" # Google News
PYTHONPATH=. python3 gossip/news.py --source twitter --keywords "crypto"

PYTHONPATH=. python3 gossip/trader.py portfolio                 # positions + P&L
PYTHONPATH=. python3 gossip/trader.py trade TICKER --side yes --estimate 0.72 --confidence high --reasoning "..."
PYTHONPATH=. python3 gossip/trader.py exit TICKER --reasoning "..."
PYTHONPATH=. python3 gossip/trader.py settle TICKER --outcome yes
PYTHONPATH=. python3 gossip/trader.py size TICKER --estimate 0.72  # dry-run sizing
PYTHONPATH=. python3 gossip/trader.py history
```

## Known Issues & Lessons Learned

1. **Always use `PYTHONPATH=.`** when running gossip/ modules — they import from `gossip.*`
2. **Always use prod API** — demo API has stale/fake data. `get_base_url()` returns PROD_BASE.
3. **Use `quick` not `scan`** — `quick` uses /events endpoint (~5s), `scan` iterates series (~3min)
4. **Orderbook fields are `yes_dollars` / `no_dollars`** — not `yes` / `no`
5. **DB connections must be fresh** per request in Next.js — singleton caches stale reads
6. **Sports markets are efficiently priced** — skip them, focus on politics/economics/weather
7. **Legislative markets have the best edge** — retail doesn't read bill text
8. **Look for "confusion premium"** — headlines create more uncertainty than details warrant
9. **Check if events already resolved** — markets lag real-world resolution (e.g., Bondi fired but market still trading)
10. **Agent prompt must say "be decisive"** — without it, the agent loops polling/searching

## References Used to Build This

- **Paperclip** (github.com/paperclipai/paperclip) — Claude Code subprocess pattern
- **prediction-market-assistant** (github.com/hackingthemarkets/prediction-market-assistant) — Kalshi API patterns
- **kalshi-trading-bot-cli** (github.com/OctagonAI/kalshi-trading-bot-cli) — RSA auth, Kelly sizing
- **Casket Trader** (wicktastic/raghav/agent/) — Our own research agent patterns
- **Hermes Agent** (github.com/nousresearch/hermes-agent) — Session/memory architecture
- **OpenClaw** (github.com/openclaw/openclaw) — File-based memory patterns

## Current State (April 4, 2026)

- Paper trading with $15 bankroll
- DB wiped, clean slate — starting fresh
- Agent writes strategy notes after each cycle
- Dashboard at http://localhost:3000 with live streaming
- Quick scan works (~5s), trades execute with real orderbook prices
