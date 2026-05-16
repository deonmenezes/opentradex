# Contributing to OpenTradex

Thanks for your interest in contributing! OpenTradex is a fast-moving project and all kinds of contributions are welcome — bug fixes, new market connectors, AI provider adapters, UI improvements, documentation, and tests.

---

## Table of Contents

- [Setup](#setup)
- [Project Layout](#project-layout)
- [Branch Naming](#branch-naming)
- [Making Changes](#making-changes)
- [Running Tests](#running-tests)
- [Opening a PR](#opening-a-pr)
- [Adding a Market Connector](#adding-a-market-connector)
- [Adding an AI Provider](#adding-an-ai-provider)
- [Code Style](#code-style)

---

## Setup

You need **Node ≥ 18** and `npm`.

```bash
git clone https://github.com/deonmenezes/opentradex.git
cd opentradex
npm install          # installs root + all workspace packages
npm run build        # compiles src/ → dist/
npm run dev          # watch mode — recompiles on change
npm run dev:dashboard  # HMR dashboard on :5173
```

---

## Project Layout

```
opentradex/
├── src/                   # Core harness (TypeScript)
│   ├── agent/             # scanner, executor, risk, runner, skills-registry
│   ├── ai/                # provider registry + adapters
│   ├── markets/           # per-exchange connectors (add new ones here)
│   ├── gateway/           # HTTP + WebSocket + SSE server (:3210)
│   └── config.ts          # Config + mode lock
│
├── packages/
│   ├── dashboard/         # React + Vite + Tailwind web cockpit
│   ├── desktop/           # Electron shell
│   ├── ios/               # Native SwiftUI client
│   └── mobile/            # Expo React Native
│
└── docs/                  # Screenshots and design notes
```

---

## Branch Naming

Use one of these prefixes:

| Prefix | When to use |
|--------|-------------|
| `feat/` | New features (connectors, skills, providers) |
| `fix/` | Bug fixes |
| `docs/` | Documentation only |
| `chore/` | Dependency updates, config, tooling |
| `refactor/` | Code changes with no behaviour change |
| `test/` | Adding or improving tests |

Example: `feat/binance-connector`, `fix/executor-live-fallback`, `docs/contributing`.

---

## Making Changes

1. Fork the repo and create a branch off `main`.
2. Make your changes — keep commits focused and descriptive.
3. Run the test suite before opening a PR.
4. Update `CHANGELOG.md` under an `[Unreleased]` heading if your change is user-visible.

---

## Running Tests

```bash
npm run test          # full test suite (unit + integration stubs)
npm run test:live     # live exchange tests (requires API keys, skip in CI)
```

Tests live next to the source file they cover (e.g. `src/risk.test.ts`, `src/agent/strategies/strategies.test.ts`). Add a `*.test.ts` file alongside any new module you write.

---

## Opening a PR

- Target the `main` branch.
- Fill in the PR description template:
  - **What** changed and **why**
  - **How to test** (manual steps or automated)
  - Relevant issue numbers (`Closes #123`)
- Keep PRs small and focused — one logical change per PR is easiest to review.
- Screenshots are very welcome for UI changes.

---

## Adding a Market Connector

Market connectors live in `src/markets/`. Each one exports a factory that returns a `MarketConnector`:

```ts
// src/markets/my-exchange.ts
import type { Market, MarketConnector, Quote } from '../types.js';
import { httpGet, retry } from './base.js';

export function createMyExchangeConnector(): MarketConnector {
  return {
    name: 'my-exchange' as any,  // add to Exchange union in types.ts
    async scan(limit = 40): Promise<Market[]> { /* ... */ },
    async search(query: string): Promise<Market[]> { /* ... */ },
    async quote(symbol: string): Promise<Quote> { /* ... */ },
  };
}
```

Then:
1. Export it from `src/markets/index.ts`.
2. Add a corresponding logo entry in `packages/dashboard/src/components/ConnectorLogo.tsx`.
3. Add a `buy-<exchange>` skill entry in `src/agent/skills-registry.ts`.
4. Wire it up in `src/agent/scanner.ts` if it should be auto-discovered.

---

## Adding an AI Provider

AI providers live in `src/ai/providers/`. Each one implements the `AIProvider` interface:

```ts
// src/ai/providers/my-provider.ts
import type { AIProvider, AIMessage, ChatOptions, AIResponse } from './types.js';

export class MyProvider implements AIProvider {
  readonly name = 'my-provider';
  readonly defaultModel = 'my-model-1';

  isConfigured(): boolean {
    return !!process.env.MY_PROVIDER_API_KEY;
  }

  async chat(messages: AIMessage[], options: ChatOptions = {}): Promise<AIResponse> {
    // ... call the API and return { content, model, provider, usage? }
  }
}
```

Then:
1. Register it in `src/ai/providers/registry.ts`.
2. Add the env var key to `PROVIDER_ENV` in `src/ai/ai-keys.ts` so it appears in the setup wizard.

---

## Code Style

- **TypeScript strict mode** — all new code should be type-safe (no `any` unless truly necessary and commented).
- **ESM only** — the project uses `"type": "module"`. Import with `.js` extensions (TypeScript resolves them to `.ts` at compile time).
- **No unused imports** — the TypeScript compiler is configured to error on these.
- **Keep files focused** — a connector file does connector things; agent logic stays in `src/agent/`.
- **No external runtime dependencies for connectors** — use the `httpGet`/`retry` helpers from `src/markets/base.ts` rather than adding new HTTP clients.

---

## Questions?

Open an issue or start a discussion on GitHub — [@deonmenezes](https://github.com/deonmenezes) is the maintainer.
