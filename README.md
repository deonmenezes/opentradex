# OpenTradex

Lightweight AI trading harness for prediction markets, stocks, and crypto. Includes a beautiful Command Cockpit dashboard and cross-platform desktop app. Paper-first design, runs anywhere.

![Dashboard Preview](docs/dashboard-preview.png)

## Features

- **Command Cockpit Dashboard** - Dark-themed trading interface inspired by professional terminals
- **Desktop App** - Native Windows/Mac app for Microsoft Store and Mac App Store
- **Multi-Market Support** - Kalshi, Polymarket, Alpaca (stocks), crypto via CoinGecko/Kraken
- **Paper-First** - Default to paper trading, easily switchable to live
- **Risk Engine** - Hard-coded caps, daily loss limits, kill switches
- **IP-Enabled Gateway** - Remote access with bearer token auth for VMs/servers
- **Real-time Updates** - SSE-based live feed for positions, trades, and news

## Install

### NPM Package (CLI + Gateway + Web UI)

```bash
npm install -g opentradex
opentradex onboard --paper-only
opentradex run
```

### Desktop App

Download from:
- **Windows**: Microsoft Store or [GitHub Releases](https://github.com/deonmenezes/opentradex/releases)
- **macOS**: Mac App Store or [GitHub Releases](https://github.com/deonmenezes/opentradex/releases)
- **Linux**: AppImage, deb, or snap

### From Source

```bash
git clone https://github.com/deonmenezes/opentradex.git
cd opentradex
npm install
npm run build:all
npm run ui
```

## Quick Start

### 1. Onboard (first time setup)

```bash
opentradex onboard --paper-only  # Safe mode - paper only forever
opentradex onboard               # Interactive setup
```

### 2. Run the Gateway

```bash
opentradex run
# Gateway at http://localhost:3210
```

### 3. Launch Dashboard

```bash
npm run ui
# Dashboard at http://localhost:3000
```

Or use the desktop app for a native experience.

## Dashboard

The Command Cockpit dashboard provides:

- **Top Bar**: Status indicators, capital/P&L, cycle controls, auto-loop
- **Left Sidebar**: Open positions, recent trades, market scanner
- **Center**: Messaging channels with AI chat interface
- **Right Sidebar**: Live feed from news sources and social media

### Mission Cards

Quick-start prompts to interact with the harness:
- **Connector Audit** - Check which rails and feeds are configured
- **Cross-Market Scan** - Find overlapping setups across exchanges
- **TradingView Pass** - Focus on specific watchlist symbols

## Remote Access

OpenTradex supports IP-enabled remote access for running on VMs or servers:

```bash
# During onboard, select "lan" or "tunnel" bind mode
opentradex onboard

# Or configure manually in ~/.opentradex/config.json
{
  "bindMode": "lan",  // or "tunnel"
  "port": 3210
}
```

When bind mode is not `local`, a bearer token is required:
- Generated during onboard and printed once
- Pass via `Authorization: Bearer <token>` header
- Or via `?token=<token>` query parameter

## Desktop App

Build the desktop app locally:

```bash
# Windows
npm run build:desktop:win

# macOS
npm run build:desktop:mac

# All platforms
npm run build:desktop
```

Output in `packages/desktop/release/`.

### Store Publishing

The app is configured for:
- **Microsoft Store** - via APPX package
- **Mac App Store** - via MAS target with entitlements
- **Linux** - AppImage, deb, snap

## API Reference

### Gateway Endpoints

| Endpoint | Method | Params | Description |
|----------|--------|--------|-------------|
| `GET /` | GET | - | Health + status |
| `GET /events` | GET | - | SSE stream for real-time updates |
| `GET /scan` | GET | `exchange?`, `limit?` | Scan markets |
| `GET /search` | GET | `q`, `exchange?` | Search markets |
| `GET /quote` | GET | `exchange`, `symbol` | Quote + orderbook |
| `GET /risk` | GET | - | Risk state |
| `POST /command` | POST | `{command}` | Send command to harness |
| `POST /panic` | POST | - | Emergency stop |
| `GET /config` | GET | - | Current config (no secrets) |

### SSE Events

Connect to `/events` for real-time updates:

```javascript
const es = new EventSource('http://localhost:3210/events');
es.onmessage = (e) => {
  const { type, payload } = JSON.parse(e.data);
  // type: 'position' | 'trade' | 'feed' | 'command' | 'panic' | 'heartbeat'
};
```

## Architecture

```
opentradex/
├── src/
│   ├── index.ts          # Main harness class
│   ├── types.ts          # TypeScript types
│   ├── config.ts         # Config management + mode lock
│   ├── risk.ts           # Risk engine + Kelly sizing
│   ├── onboard.ts        # Interactive setup wizard
│   ├── markets/          # Exchange connectors
│   │   ├── kalshi.ts
│   │   ├── polymarket.ts
│   │   ├── alpaca.ts
│   │   ├── tradingview.ts
│   │   └── crypto.ts
│   ├── gateway/
│   │   └── index.ts      # HTTP gateway with SSE
│   └── bin/
│       └── cli.ts        # CLI entry point
├── packages/
│   ├── dashboard/        # React + Vite + Tailwind dashboard
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── TopBar.tsx
│   │   │   │   ├── LeftSidebar.tsx
│   │   │   │   ├── ChatCockpit.tsx
│   │   │   │   └── RightSidebar.tsx
│   │   │   └── hooks/
│   │   │       └── useHarness.ts
│   │   └── package.json
│   └── desktop/          # Electron desktop app
│       ├── src/
│       │   ├── main.ts
│       │   └── preload.ts
│       └── package.json
```

## Trading Modes

| Mode | Behavior | Live Flip |
|------|----------|-----------|
| `paper-only` | All trades go to paper endpoints | None - must re-onboard |
| `paper-default` | Starts paper, can flip after 24h | CLI + email code |
| `live-allowed` | Can trade live immediately | Direct |

## Supported Exchanges

| Exchange | Type | Features |
|----------|------|----------|
| `kalshi` | Prediction Market | Events, elections, orderbook |
| `polymarket` | Prediction Market | Crypto-native, CLOB |
| `alpaca` | Stocks/ETFs | Paper + live, US markets |
| `tradingview` | Stocks | Yahoo Finance data |
| `crypto` | Cryptocurrency | CoinGecko + Kraken orderbook |

## Color Palette

The dashboard uses a dark theme optimized for trading:

| Token | Hex | Use |
|-------|-----|-----|
| `--bg` | `#0B0F14` | App background |
| `--surface` | `#121821` | Cards |
| `--surface-2` | `#1A2230` | Inset panels |
| `--border` | `#222C3B` | Hairlines |
| `--text` | `#E6EDF3` | Primary text |
| `--text-dim` | `#8B97A8` | Secondary |
| `--accent` | `#3FB68B` | Positive / brand |
| `--danger` | `#E5484D` | Negative P&L |

## Development

```bash
# Install dependencies
npm install

# Build core
npm run build

# Build dashboard
npm run build:dashboard

# Run dashboard in dev mode
npm run dev:dashboard

# Run desktop app in dev mode
npm run desktop
```

## License

MIT
