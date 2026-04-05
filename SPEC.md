# Open Trademaxxxing - EF Hackathon Spec

## What It Is

An autonomous trading agent for Kalshi prediction markets that uses real-time news intelligence to find and exploit mispriced markets. The signal is the news - the agent listens to fast-moving information, figures out what it means for prediction markets, and trades before the crowd catches up.

**Key design decision:** Claude Code IS the agent. No Anthropic API calls. We spawn the `claude` CLI as a subprocess (Paperclip pattern), which means zero API cost if you have a Claude Max subscription. The Python modules are CLI tools that Claude Code invokes — not an orchestrator that calls an LLM.

## Core Thesis

Kalshi's retail crowd is slow to react to breaking news and public data. An agent that:
1. Scrapes news continuously (Apify — Google News, Twitter, RSS)
2. Matches news to active Kalshi markets
3. Estimates how the news shifts the true probability
4. Trades when market price is stale vs the news

...should consistently find edge on event markets that are news-driven (politics, economics, companies, world events).

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   OPEN TRADEMAXXXING                     │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              CLAUDE CODE (the brain)                  │  │
│  │  Spawned via: claude --print --output-format          │  │
│  │    stream-json --resume <sessionId>                   │  │
│  │                                                       │  │
│  │  • Reads news (shells out to gossip/news.py)          │  │
│  │  • Scans markets (shells out to gossip/kalshi.py)     │  │
│  │  • Reasons about probability (native LLM thinking)    │  │
│  │  • Decides trades (shells out to gossip/trader.py)    │  │
│  │  • Maintains context across cycles via --resume       │  │
│  └─────────────────────────────────────────────────────┘  │
│       │              │               │                    │
│       ▼              ▼               ▼                    │
│  ┌─────────┐    ┌──────────┐    ┌─────────┐              │
│  │  NEWS    │    │ MARKETS  │    │ TRADER  │              │
│  │ (Apify)  │    │ (Kalshi) │    │ (Paper) │              │
│  └─────────┘    └──────────┘    └─────────┘              │
│       │              │               │                    │
│       ▼              ▼               ▼                    │
│  news articles   market data     trades.json              │
│  + summaries     orderbooks      positions                │
│                  prices          P&L                       │
│                                                           │
│  ┌────────────────────────────────────────┐               │
│  │           DASHBOARD (Streamlit)         │               │
│  │  Live markets · News feed · Positions   │               │
│  │  Trade log · P&L · Agent reasoning      │               │
│  └────────────────────────────────────────┘               │
└──────────────────────────────────────────────────────────┘
```

## Claude Code as Agent (Paperclip Pattern)

Instead of calling the Anthropic API, we spawn the `claude` CLI as a subprocess. This is the same pattern used by Paperclip (github.com/paperclipai/paperclip).

### How it works

**`main.py`** is a thin Python loop that:
1. Spawns `claude --print - --output-format stream-json --resume <session_id>` as a subprocess
2. Pipes a prompt via stdin: "Scan markets, scrape news, find mispriced opportunities, trade."
3. Parses JSON output from stdout
4. Saves the session ID for context persistence across cycles
5. Sleeps, then repeats

**Claude Code** receives the prompt and:
1. Runs `python3 gossip/news.py` to scrape news via Apify
2. Runs `python3 gossip/kalshi.py scan` to get active markets
3. Thinks about which markets are mispriced given the news (this is the LLM reasoning — no API call, it's native)
4. Runs `python3 gossip/trader.py trade TICKER --side yes --contracts 3 --estimate 0.72 --reasoning "..."` to execute
5. Returns a summary of what it did

**Cost model:**
- Claude Max/Pro subscription → $0 per cycle (rides on subscription auth)
- ANTHROPIC_API_KEY set → API billing (fallback)

### Session persistence

`--resume <sessionId>` keeps the full conversation context across cycles. The agent remembers:
- What it researched last cycle
- What positions it holds and why
- What news it already processed (avoids duplicate analysis)
- Its evolving thesis on each market

### Spawning Claude Code (main.py)

```python
import subprocess
import json

def run_agent_cycle(session_id: str | None, prompt: str) -> dict:
    cmd = ["claude", "--print", "-", "--output-format", "stream-json", "--verbose"]
    if session_id:
        cmd.extend(["--resume", session_id])

    result = subprocess.run(
        cmd,
        input=prompt,
        capture_output=True,
        text=True,
        timeout=300,
        env={**os.environ}  # inherits Claude auth
    )

    # Parse stream-json output for session_id and result
    for line in result.stdout.strip().split("\n"):
        msg = json.loads(line)
        if msg.get("type") == "system" and "session_id" in msg:
            new_session_id = msg["session_id"]
        if msg.get("type") == "result":
            return {"session_id": new_session_id, "result": msg}

    return {"session_id": session_id, "result": None}
```

## The Loop (main.py)

Runs continuously on a configurable interval (default: 15 min):

```python
AGENT_PROMPT = """
You are Open Trademaxxxing, an autonomous prediction market trader.

Your tools (run these as shell commands):
- python3 gossip/news.py [--keywords "k1,k2"] [--hours 4]  → scrape recent news
- python3 gossip/kalshi.py scan [--categories "Economics,Politics"] [--days 14]  → active markets
- python3 gossip/kalshi.py market TICKER  → market details + orderbook
- python3 gossip/trader.py portfolio  → current positions + P&L
- python3 gossip/trader.py trade TICKER --side yes/no --contracts N --estimate 0.XX --reasoning "..."
- python3 gossip/trader.py exit TICKER --reasoning "..."

Your job each cycle:
1. Scrape news for topics relevant to active Kalshi markets
2. Scan active markets and compare prices to what the news implies
3. For any market where you see 10pp+ edge, place a trade
4. Check existing positions — exit if thesis invalidated by new news
5. Log your reasoning for every decision

Think step by step. Be specific about probability estimates.
Don't trade on noise — only trade when you can articulate WHY the market is wrong.
"""

async def main():
    session_id = load_session_id()
    while True:
        result = run_agent_cycle(session_id, AGENT_PROMPT)
        session_id = result["session_id"]
        save_session_id(session_id)
        await asyncio.sleep(CYCLE_INTERVAL)
```

## Module Breakdown

### `gossip/news.py` — News Intelligence Layer (CLI tool)

Invoked by Claude Code as: `python3 gossip/news.py --keywords "bitcoin,tariff" --hours 4`

**Apify actors:**
- `apify/google-search-scraper` — Google News results by keyword
- Twitter/X scraper (community actor) — trending topics, keyword monitoring
- RSS reader — for specific sources (Reuters, AP, Bloomberg, Fed releases)

**CLI interface:**
```
python3 gossip/news.py                           # scrape default keywords
python3 gossip/news.py --keywords "bitcoin,cpi"  # specific keywords
python3 gossip/news.py --hours 2                  # last 2 hours only
python3 gossip/news.py --trending                 # just trending topics
```

**Output:** JSON to stdout — list of articles with title, url, source, published_at, snippet.

**Keyword generation:**
- Base keywords: ["inflation", "CPI", "GDP", "bitcoin", "trump", "tariff", "fed rate", "unemployment", ...]
- Claude Code dynamically picks keywords based on what markets it sees

### `gossip/kalshi.py` — Kalshi API Client (CLI tool)

Invoked by Claude Code as: `python3 gossip/kalshi.py scan` or `python3 gossip/kalshi.py market TICKER`

Port from Casket Trader's scanner.py + trade.py, plus patterns from kalshi-trading-bot-cli.

**CLI interface:**
```
python3 gossip/kalshi.py scan                          # all active markets
python3 gossip/kalshi.py scan --categories "Economics"  # filtered
python3 gossip/kalshi.py scan --days 7                  # closing within 7 days
python3 gossip/kalshi.py market KXCPI-26MAY-T0.5       # single market details
python3 gossip/kalshi.py orderbook KXCPI-26MAY-T0.5    # orderbook depth
python3 gossip/kalshi.py search "bitcoin"               # search by keyword
```

**Output:** JSON to stdout.

**Market dataclass:**
- ticker, title, category, rules, close_time, yes_bid, yes_ask, volume, open_interest, spread

**Filtering:**
- Skip 15-min crypto (not news-tradeable)
- Skip sports/esports
- Focus on: Economics, Politics, Companies, World, Science/Tech, Climate
- Minimum volume/OI thresholds

**Auth:**
- Unauthenticated for market data (public API)
- RSA key-based auth for real trading (from kalshi-trading-bot-cli pattern)
- Demo API support: `KALSHI_USE_DEMO=true` → `https://demo-api.kalshi.co/trade-api/v2`

### `gossip/trader.py` — Execution Engine (CLI tool)

Invoked by Claude Code as: `python3 gossip/trader.py trade TICKER --side yes --contracts 3 --estimate 0.72 --reasoning "..."`

**CLI interface:**
```
python3 gossip/trader.py portfolio                    # show positions + P&L
python3 gossip/trader.py trade TICKER --side yes --contracts 3 --estimate 0.72 --confidence high --reasoning "..."
python3 gossip/trader.py exit TICKER --reasoning "..."
python3 gossip/trader.py settle TICKER --outcome yes  # settle resolved market
python3 gossip/trader.py history                      # trade log
```

**Sizing (Kelly criterion):**
```
edge = estimated_prob - market_price  (for YES side)
kelly_fraction = edge / (1 - market_price)
bet_size = bankroll * kelly_fraction * 0.5  (half-Kelly for safety)
contracts = floor(bet_size / market_price)
```

**Risk rules:**
- Max 30% of bankroll on one position
- Max 5 concurrent positions
- Min edge: 10pp (configurable)
- Min confidence: medium
- Paper mode by default — no real money without explicit `--live` flag

**Trade logging:**
- Every trade saved to `data/trades.json` with full context: news trigger, LLM reasoning, probability estimate, entry price, timestamp
- Portfolio state in `data/portfolio.json`

### `gossip/dashboard.py` — Streamlit Demo Dashboard

For the hackathon live demo. Shows:

1. **Active Markets** — Kalshi markets the agent is watching, with current prices
2. **News Feed** — Latest scraped articles, color-coded by relevance to markets
3. **Trade Signals** — Agent's analysis: market, news trigger, estimated prob vs market price, edge
4. **Positions** — Current paper portfolio with P&L
5. **Agent Log** — Running log of agent reasoning (what it researched, why it traded/passed)

Run with: `streamlit run gossip/dashboard.py`

## Demo Strategy (Hackathon Day)

For the live demo, focus on markets that resolve quickly and have active news:

1. **Crypto markets** (daily/weekly BTC/ETH price targets) — fast-moving, news-driven
2. **Politics/tariffs** — Trump administration moves, tariff announcements
3. **Economic data** — CPI, jobs numbers, GDP if timing aligns
4. **Company earnings** — if any earnings calls happen during the hackathon

Pre-seed the agent with a few positions before the demo so there's a portfolio to show.

## Tech Stack

- Python 3.11+, asyncio
- Claude Code CLI as the LLM brain (zero API cost on Max subscription)
- Apify (news scraping) — free tier, Google News + Twitter + web search + article extraction
- Kalshi REST API (markets + trading) with RSA auth
- SQLite (data/gossip.db) — trades, news, market snapshots, agent logs. Single file, zero config.
- Streamlit (real-time dashboard)
- JSON files as secondary persistence (trader.py dual-writes)

## File Map

```
open-trademaxxxing/
├── SPEC.md              ← this file
├── main.py              ← thin loop: spawn Claude Code, sleep, repeat
├── requirements.txt
├── .env.example
├── .gitignore
├── gossip/
│   ├── __init__.py
│   ├── db.py             ← SQLite database layer (trades, news, snapshots, logs)
│   ├── news.py           ← CLI tool: Apify news scraping
│   ├── kalshi.py          ← CLI tool: Kalshi API client
│   ├── trader.py          ← CLI tool: trade execution + sizing
│   └── dashboard.py       ← Streamlit real-time dashboard
├── data/
│   ├── gossip.db          ← SQLite database (source of truth for dashboard)
│   ├── trades.json        ← trade log with reasoning (secondary)
│   └── session_id.txt     ← Claude Code session persistence
└── references/           ← (gitignored) cloned repos for reference
    ├── prediction-market-assistant/
    └── kalshi-trading-bot-cli/
```

## Build Order (Hackathon Timeline)

1. **kalshi.py** — Get markets loading, filtering, search working. Port from Casket Trader + kalshi-trading-bot-cli patterns.
2. **news.py** — Apify integration, scrape Google News for market keywords. CLI tool outputting JSON.
3. **trader.py** — Paper trading, Kelly sizing, trade logging. CLI tool.
4. **main.py** — Wire the Claude Code subprocess loop. One end-to-end cycle.
5. **dashboard.py** — Streamlit UI showing everything. Polish for demo.

Steps 1-3 can be parallelized across team members. Step 4 is where it all comes together — Claude Code as the brain tying news to markets to trades.

## References

- **Paperclip** (github.com/paperclipai/paperclip) — Claude Code subprocess pattern, session persistence, skills injection
- **prediction-market-assistant** (github.com/hackingthemarkets/prediction-market-assistant) — Kalshi API pagination, Perplexity-for-research pattern
- **kalshi-trading-bot-cli** (github.com/OctagonAI/kalshi-trading-bot-cli) — RSA auth, Kelly sizing, risk gates, market search, demo mode
- **Casket Trader** (wicktastic/raghav/agent/) — Our own research agent patterns, market scanner, paper trading
