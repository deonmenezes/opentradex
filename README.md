<div align="center">

# OpenTradex

**The open-source trading cockpit.**
One harness. Every market. Paper by default. Your keys, your rules.

[![License: MIT](https://img.shields.io/badge/License-MIT-3FB68B.svg?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/Node-%E2%89%A520-3FB68B?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Electron](https://img.shields.io/badge/Electron-31-47848F?style=flat-square&logo=electron&logoColor=white)](https://www.electronjs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Tailwind](https://img.shields.io/badge/Tailwind-3-38BDF8?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Platforms](https://img.shields.io/badge/platforms-win%20%7C%20mac%20%7C%20linux%20%7C%20ios%20%7C%20android-8B97A8?style=flat-square)](#install)
[![Status](https://img.shields.io/badge/status-paper--first-F59E0B?style=flat-square)](#trading-modes)

![Dashboard Preview](docs/dashboard-preview.png)

</div>

---

## Why OpenTradex

Every serious trader ends up juggling ten tabs, three terminals, a TradingView chart,
a half-broken Polymarket script, and a Slack channel full of signals nobody has time to read.

**OpenTradex is the command cockpit that replaces the tab sprawl.**
A single dashboard that speaks to prediction markets, equities, crypto, and forex
through one AI-driven harness — local-first, paper-by-default, and fully yours.

```
 scan markets -> AI filters signal -> you approve trade -> paper fill -> review
```

No SaaS. No account. No telemetry. Your API keys stay on your machine.

---

## Highlights

| | |
|---|---|
| **12 connectors** | Polymarket · Kalshi · TradingView · Alpaca · IBKR · Binance · Coinbase · OANDA · MetaTrader 5 · Dukascopy · Robinhood · DraftKings |
| **Houston-style cockpit** | Resizable 3-pane dark terminal inspired by pro trading desks |
| **AI harness** | Bring your own model — Anthropic, Google, OpenAI-compatible, or local CLIs |
| **Real-time wire** | Native WebSocket with SSE fallback for positions, trades, and news |
| **Paper-first safety** | Live trading is gated behind a 24h lock + explicit mode flip |
| **Ships everywhere** | npm CLI · Web dashboard · Electron desktop · iOS SwiftUI · Expo mobile |
| **Your keys only** | All creds in `~/.opentradex/config.json` — nothing leaves the machine |

---

## Install

### One-line (CLI + gateway + web UI)

```bash
npx opentradex onboard --paper-only && npx opentradex run
```

### Desktop (Windows / macOS / Linux)

Grab the installer from [**Releases**](https://github.com/deonmenezes/opentradex/releases)
or build it yourself:

```bash
git clone https://github.com/deonmenezes/opentradex.git
cd opentradex
npm install
npm run build:all
npm run build:desktop:win   # or :mac / :linux
```

Installer lands in `packages/desktop/release/`.

### Mobile

```bash
# iOS (SwiftUI, native)
open packages/ios/OpenTradex/OpenTradex.xcodeproj

# Android / iOS (Expo)
cd packages/mobile && npm install && npx expo start
```

---

## Quickstart

```bash
# 1. First-time setup — pick your rails, set paper mode, drop in API keys
opentradex onboard

# 2. Boot the gateway (HTTP + WS on :3210)
opentradex run

# 3. Open the cockpit
npm run ui                  # web
npm run desktop             # Electron
```

Then tell it what to do:

```
> scan all markets and propose the best trade under $50 risk
> close BTC-EOY-120K on kalshi
> analyze "Fed cut September" news from reuters
> panic
```

---

## The Cockpit

<div align="center">

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  OPENTRADEX  Live  PAPER          PORTFOLIO $15,238   DAY +$184.27   [Run]▶   │
├────────────────┬──────────────────────────────────────────┬───────────────────┤
│ POSITIONS   2  │       What should we trade next?         │  Live feed   12  │
│ BTC-EOY-120K   │                                          │  Reuters    14m   │
│ FED-SEP-CUT    │   ⚡ Connector Audit                      │  Bloomberg  28m   │
│                │   ⚡ Cross-Market Scan                    │  FT         45m   │
│ MARKET SCANNER │   ⚡ TradingView Pass                     │  CNBC       33m   │
│ FED-SEP 43¢    │                                          │  WSJ        48m   │
│ BTC-EOY 38¢    │   COMMAND · _                            │  CoinDesk   62m   │
└────────────────┴──────────────────────────────────────────┴───────────────────┘
```

</div>

- **Left rail** — open positions, recent fills, live market scanner
- **Center** — chat interface to the AI harness with quick-start missions
- **Right rail** — unified news + social feed with `$TICKER` tagging
- **Top bar** — capital, day P&L, run cycle, auto-loop cron (1/2/5/10/15/30 min)
- **Markets page** — the Houston-style **Connectors** grid with logos, status pills, and one-click `Connect`

---

## Connectors

| Connector | Category | Type | Status |
|---|---|---|---|
| **Polymarket** | Prediction markets | USDC / CLOB | Built-in |
| **Kalshi** | Prediction markets | CFTC-regulated | Built-in |
| **TradingView** | Charts & signals | Webhook + MCP bridge | Built-in |
| **Alpaca** | Equities & options | Paper + live | Bring key |
| **Interactive Brokers** | Equities & options | TWS API | Bring key |
| **Binance** | Crypto | Spot + perp | Bring key |
| **Coinbase** | Crypto | Advanced Trade | Bring key |
| **OANDA** | Forex | 70+ pairs | Bring key |
| **MetaTrader 5** | Forex | MT5 Python bridge | Beta |
| **Dukascopy** | Forex | Tick-level JForex | Bring key |
| **Robinhood** | Equities, options, crypto | Unofficial API | Beta |
| **DraftKings** | Sportsbook | Odds feed | Bring key |

Want to wire a new one? Drop a file into `src/markets/<name>.ts` that exports `scan`, `quote`, and
`send` — the harness auto-discovers it.

---

## AI Providers

The harness speaks to whichever model you already have:

| Provider | Where it runs | File |
|---|---|---|
| Anthropic Claude | Cloud API | `src/ai/providers/anthropic.ts` |
| Google Gemini | Cloud API | `src/ai/providers/google.ts` |
| OpenAI-compatible | OpenAI, Groq, OpenRouter, Ollama, LM Studio | `src/ai/providers/openai-compatible.ts` |
| Claude CLI | Local (Claude Code) | `src/ai/providers/claude-cli.ts` |
| OpenCode CLI | Local | `src/ai/providers/opencode-cli.ts` |

Configure in `~/.opentradex/config.json`:

```jsonc
{
  "ai": {
    "provider": "anthropic",
    "model":    "claude-opus-4-7",
    "apiKey":   "sk-ant-..."
  }
}
```

---

## Monorepo map

```
opentradex/
├── src/                        # The harness — the thing that actually trades
│   ├── agent/                  # scanner, executor, risk, runner, logger
│   ├── ai/                     # provider registry + adapters
│   ├── markets/                # per-exchange connectors
│   ├── gateway/                # HTTP + WebSocket + SSE server (:3210)
│   ├── mcp/                    # MCP bridge for TradingView etc.
│   ├── risk.ts                 # Kelly sizing, daily-loss caps, kill switches
│   ├── config.ts               # Config + mode lock
│   ├── onboard.ts              # Interactive setup wizard
│   └── bin/cli.ts              # `opentradex` CLI entry
│
├── packages/
│   ├── dashboard/              # React + Vite + Tailwind cockpit
│   │   └── src/components/     #   TopBar · LeftSidebar · ChatCockpit · RightSidebar
│   │       ConnectorLogo.tsx   #   Branded SVG marks for all 12 rails
│   │
│   ├── desktop/                # Electron shell (Windows / macOS / Linux)
│   │   ├── src/main.ts         #   Boots gateway + loads dashboard
│   │   └── electron-builder    #   NSIS · APPX · DMG · MAS · AppImage · deb · snap
│   │
│   ├── ios/                    # Native SwiftUI client
│   └── mobile/                 # Expo React Native (iOS + Android)
│
└── docs/                       # Screenshots, design notes
```

---

## Gateway API

The gateway is the only thing the dashboard, desktop, and mobile clients talk to.
It's a plain HTTP server — you can curl it, hit it from another app, or wire it into n8n.

| | |
|---|---|
| `GET /api/` | Harness status + health |
| `GET /api/scan` | `?exchange=kalshi&limit=20` — markets list |
| `GET /api/search` | `?q=bitcoin` — search across all rails |
| `GET /api/quote` | `?exchange=&symbol=` — orderbook snapshot |
| `GET /api/risk` | Current risk state + caps |
| `GET /api/config` | Sanitized config (no secrets) |
| `POST /api/command` | `{"command":"scan markets"}` — send AI instruction |
| `POST /api/panic` | Flatten everything, halt trading |
| `WS  /ws` | Live event stream — primary transport |
| `GET /api/events` | SSE fallback — same events as `/ws` |

**Event types on the wire:** `position` · `trade` · `feed` · `market` · `command` · `panic` · `heartbeat`

```javascript
const ws = new WebSocket('ws://localhost:3210/ws');
ws.onmessage = (e) => {
  const { type, payload } = JSON.parse(e.data);
  // type: 'position' | 'trade' | 'feed' | 'market' | ...
};
```

---

## Trading modes

| Mode | Behaviour | Flip to live |
|---|---|---|
| `paper-only` | Everything routes to paper endpoints. Live calls throw. | **Not possible** — must re-onboard |
| `paper-default` | Paper by default. Can flip after 24h lock. | CLI + email confirmation |
| `live-allowed` | Trades live immediately when called. | Direct |

The mode is persisted in `~/.opentradex/config.json` and enforced by `src/config.ts` on
**every** outbound order. There is no runtime override.

---

## Remote access

Want to run the harness on a VM and drive it from your laptop / phone?

```bash
opentradex onboard         # pick "lan" or "tunnel" bind mode
```

That generates a bearer token — printed once, never stored elsewhere. Pass it on every call:

```bash
curl -H "Authorization: Bearer $OPENTRADEX_TOKEN" http://vm.lan:3210/api/
```

The mobile apps prompt for host + token on first launch.

---

## Design tokens

The cockpit is calibrated for 8-hour sessions in a dark room:

| Token | Hex | Role |
|---|---|---|
| `--bg`        | `#0B0F14` | App background |
| `--surface`   | `#121821` | Cards |
| `--surface-2` | `#1A2230` | Inset panels |
| `--border`    | `#222C3B` | Hairlines |
| `--text`      | `#E6EDF3` | Primary text |
| `--text-dim`  | `#8B97A8` | Secondary text |
| `--accent`    | `#3FB68B` | Positive · brand · "live" |
| `--warning`   | `#F59E0B` | Beta · caution |
| `--danger`    | `#E5484D` | Negative P&L · panic |

---

## Develop

```bash
npm install                  # root workspaces install everything

npm run build                # compile src/  -> dist/
npm run build:dashboard      # Vite build
npm run dev:dashboard        # HMR dashboard on :5173
npm run desktop              # Electron dev with live gateway
npm run ui                   # Web-only (no Electron)
```

`packages/desktop` talks to `:3210` whether it spawns the gateway itself or finds one already running.
`packages/dashboard` is served by the gateway at `/` in production — single source of truth, no double port.

---

## Shipping your own fork

This repo is the public, ready-to-fork mirror. Clone it, wire your own keys, and you're live on paper
in under a minute:

```bash
git clone https://github.com/deonmenezes/opentradex.git
cd opentradex
npm install && npm run build:all
npx opentradex onboard --paper-only
npx opentradex run
```

---

## License

MIT. Trade responsibly. No warranty — this is paper-first for a reason.

<div align="center">

**Built by [@deonmenezes](https://github.com/deonmenezes).**
Pull requests welcome. Stars even more.

</div>
