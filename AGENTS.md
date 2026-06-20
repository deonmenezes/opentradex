# OpenTradex

An open-source AI trading cockpit that connects to prediction markets, equities, and crypto through a single harness. Paper-first by default (live trading is gated behind a 24h lock). Ships as an npm CLI, web dashboard, Electron desktop app, and mobile (iOS SwiftUI + Expo).

## Tech Stack

- **Language:** TypeScript (compiled to `dist/`)
- **Runtime:** Node.js >= 18
- **AI:** Anthropic SDK (`@anthropic-ai/sdk`)
- **Bundler/build:** TypeScript compiler (`tsc`)
- **Workspaces:** npm workspaces (`packages/dashboard`, `packages/desktop`, `packages/ios`, `packages/mobile`)
- **Web dashboard:** React + Tailwind (in `packages/dashboard`)
- **Desktop:** Electron 31 (in `packages/desktop`)
- **Testing:** Node.js built-in test runner (`tsx --test`)

## Setup

```bash
npm install

# Build the TypeScript source
npm run build

# (Optional) Build all packages including dashboard
npm run build:all
```

## Build / Run / Test

```bash
# Build core TypeScript
npm run build

# Build everything (core + dashboard)
npm run build:all

# Build desktop app (current platform)
npm run build:desktop

# Watch mode (TypeScript only)
npm run dev

# Start web dashboard (build first, then serve)
npm run ui

# Start desktop app (dev mode)
npm run desktop

# Start dashboard in dev mode
npm run dev:dashboard

# Run CLI gateway
npm start
# or: npm run gateway

# Onboarding wizard
npm run onboard

# Run tests
npm test

# Live/integration tests (requires real exchange credentials)
npm run test:live

# Clean all build artifacts
npm run clean
```

## Project Structure

```
src/
  index.ts           # Library entry point
  bin/cli.js         # CLI entry point (opentradex command)
  gateway/           # Gateway core logic + tests
  agent/             # AI agent strategies
  markets/           # Market connector implementations
  scraper/           # Exchange scrapers (incl. live tests)
  ai/                # AI/LLM integration
  mcp/               # MCP tool definitions
  config.ts          # Configuration loading
  risk.ts            # Risk management
  onboard.ts         # Onboarding wizard
  types.ts           # Shared TypeScript types
  x402/              # x402 payment protocol integration
packages/
  dashboard/         # React web dashboard
  desktop/           # Electron desktop app
  ios/               # iOS SwiftUI app
  mobile/            # Expo mobile app
landing/             # Marketing landing page
claude-plugin/       # Claude Code plugin
ralph/               # Ralph agent config
tasks/               # Task definitions
docs/                # Documentation and dashboard preview
tsconfig.json        # TypeScript config
```

## Architecture & Key Files

- `src/gateway/` — core trading gateway; handles market connections, order routing
- `src/agent/strategies/` — AI-driven trading strategy implementations
- `src/markets/` — one file per market connector (Polymarket, Kalshi, Alpaca, etc.)
- `src/config.ts` — loads and validates env vars and config files
- `src/risk.ts` — position sizing, risk limits; checked before every order
- `packages/dashboard/` — React dashboard with its own `package.json` and build
- `packages/desktop/` — Electron wrapper with `secrets.test.ts` for credential validation
- Live trading requires explicit mode flip; paper mode is the safe default

## Conventions & Notes for Agents

- Always build before running: `npm run build` then `npm start`
- Tests use `tsx --test` (no Jest/Vitest) — match this pattern for new tests
- API keys for exchanges must be set as environment variables; check `src/config.ts` for names
- Live trading is gated behind a 24h lock — do not remove this safety mechanism
- `x402` integration handles crypto micropayments — touch with care
- `packages/desktop/src/secrets.test.ts` tests credential loading; run before desktop builds
- The monorepo uses npm workspaces; run `npm install` from root, not from individual packages
