# PRD: OpenTradex Trading Plugin for Claude Code

## Introduction

A **standalone, publishable Claude Code plugin** that lets anyone trade across Kalshi, Polymarket, Alpaca (stocks), and Coinbase (crypto) directly from a Claude Code session. After a one-time onboarding that just collects API keys, the user can scan, buy, sell, check risk, and panic-flatten through slash commands — no separate OpenTradex gateway required.

Version 1 is **paper-only**. Live trading comes in a follow-up milestone.

The plugin is designed to be installed from a Claude Code plugin marketplace. It ships a thin Node helper (`bin/tradex.js`) that does the actual exchange work; skills are lightweight wrappers.

## Goals

- One-command install: `claude plugin install opentradex-trade`.
- Zero infra: no gateway, no database, no Docker. Keys in `~/.claude/opentradex/keys.json` (0600). Paper ledger in `~/.claude/opentradex/ledger.json`.
- Cover 4 rails in v1: Kalshi, Polymarket, Alpaca, Coinbase Advanced Trade.
- One mega-skill (`/opentradex-trade:trade <cmd>`) plus granular skills for power users.
- Three subagents: Scout, Risk Officer, Coach.
- Paper trading only in v1. Live trading is a non-goal until v2.
- Publishable to the Claude Code marketplace with a README, LICENSE, and keywords.

## User Stories

### US-001: Scaffold plugin manifest and bin helper
**Description:** As a developer, I need the plugin directory structure and Node helper entry point so every later skill has something to call.

**Acceptance Criteria:**
- [ ] `opentradex-trade/.claude-plugin/plugin.json` exists with name, description, version 1.0.0, author, keywords.
- [ ] `opentradex-trade/bin/tradex.js` exists, is executable (`#!/usr/bin/env node`), takes `<command> [args...]` and dispatches via a switch.
- [ ] Running `node bin/tradex.js help` prints usage listing all subcommands.
- [ ] Typecheck passes (if TS) / `node --check` passes (if JS).

### US-002: Key storage module
**Description:** As a developer, I need a small module that reads and writes `~/.claude/opentradex/keys.json` with 0600 perms so subsequent adapters have a standard way to fetch credentials.

**Acceptance Criteria:**
- [ ] `opentradex-trade/lib/keys.js` exports `readKeys()`, `writeKey(rail, fields)`, `deleteKey(rail)`.
- [ ] On write, file is created with mode 0600 and parent dir 0700.
- [ ] Reads return `{}` if the file doesn't exist; never throw.
- [ ] Unit test covers: round-trip, missing file, permission mode.
- [ ] Tests pass.
- [ ] Typecheck passes.

### US-003: Onboarding skill
**Description:** As a user, I want one slash command that walks me through adding API keys for each rail so I can start trading without editing files.

**Acceptance Criteria:**
- [ ] `skills/onboard/SKILL.md` exists with `disable-model-invocation: false`.
- [ ] The skill calls `node bin/tradex.js onboard` which prompts for each rail (Kalshi, Polymarket, Alpaca, Coinbase) and writes to keys.json.
- [ ] User can skip a rail by pressing Enter; skipped rails stay absent from keys.json.
- [ ] After onboarding, the skill prints which rails are enabled and that mode is paper-only.
- [ ] Running it twice is idempotent — prior keys stay unless the user enters a new value.
- [ ] Typecheck passes.

### US-004: Paper ledger module
**Description:** As a developer, I need an in-process paper ledger so trades in paper mode produce realistic positions + P&L without hitting live exchanges.

**Acceptance Criteria:**
- [ ] `opentradex-trade/lib/ledger.js` exports `openPosition(rail, symbol, side, qty, price)`, `closePosition(id)`, `listPositions()`, `markToMarket(rail, symbol, price)`.
- [ ] Positions persist to `~/.claude/opentradex/ledger.json`.
- [ ] Each position has: id, rail, symbol, side, qty, entry, mark, unrealizedPnl, openedAt.
- [ ] Close produces a realized P&L entry in a `trades` array on the ledger.
- [ ] Unit tests cover: open, mark, close, listPositions.
- [ ] Tests pass.
- [ ] Typecheck passes.

### US-005: Kalshi adapter (scan + paper-order)
**Description:** As a user, I want to pull live Kalshi markets and place paper orders against them so I can practise on real order books.

**Acceptance Criteria:**
- [ ] `opentradex-trade/rails/kalshi.js` exports `scan(limit)` and `order({symbol, side, qty})`.
- [ ] `scan` calls Kalshi public markets endpoint with the user's API key from keys.json; returns `[{exchange:'kalshi', symbol, price, yesAsk, noAsk}, ...]`.
- [ ] `order` in paper mode calls `ledger.openPosition('kalshi', ...)` with the current yes/no ask price.
- [ ] If the user has no Kalshi key, `scan` returns `[]` and `order` throws `KEY_MISSING`.
- [ ] Tests use recorded fixtures (no live network in test).
- [ ] Tests pass.
- [ ] Typecheck passes.

### US-006: Polymarket adapter
**Description:** As a user, I want the same scan + paper-order capability on Polymarket.

**Acceptance Criteria:**
- [ ] `rails/polymarket.js` exports `scan(limit)` and `order({symbol, side, qty})`.
- [ ] Scan pulls from Polymarket's public CLOB API for top-volume markets.
- [ ] Order in paper mode writes to the ledger at the current midpoint.
- [ ] Missing key → `scan` empty, `order` throws `KEY_MISSING`.
- [ ] Tests pass.
- [ ] Typecheck passes.

### US-007: Alpaca adapter
**Description:** As a user, I want scan + paper-order on Alpaca stocks.

**Acceptance Criteria:**
- [ ] `rails/alpaca.js` exports `scan(limit)` (top movers from Alpaca) and `order`.
- [ ] If Alpaca key is a paper key (detected from URL), scan uses `paper-api.alpaca.markets`.
- [ ] Order in paper mode writes to our own ledger (not Alpaca's paper — keep one source of truth).
- [ ] Tests pass.
- [ ] Typecheck passes.

### US-008: Coinbase Advanced Trade adapter
**Description:** As a user, I want scan + paper-order on Coinbase.

**Acceptance Criteria:**
- [ ] `rails/coinbase.js` exports `scan(limit)` (top-volume products) and `order`.
- [ ] Scan uses the public products endpoint (no key needed for scan).
- [ ] Order requires the user's Coinbase API key + secret; in paper mode writes to the ledger.
- [ ] Tests pass.
- [ ] Typecheck passes.

### US-009: Unified scan command
**Description:** As a user, I want one scan call that aggregates across all enabled rails and returns a short ranked list.

**Acceptance Criteria:**
- [ ] `node bin/tradex.js scan [rail] [limit]` runs all enabled rail `scan()`s in parallel (or one rail if specified).
- [ ] Returns JSON: `{candidates: [{exchange, symbol, price, thesis?}]}` capped at `limit` total (default 10).
- [ ] Rails that error (network, key problem) are skipped with a warning on stderr — never fail the whole scan.
- [ ] Tests pass.
- [ ] Typecheck passes.

### US-010: Unified order routing
**Description:** As a user, I want `buy` / `sell` commands that route to the right rail by exchange prefix.

**Acceptance Criteria:**
- [ ] `node bin/tradex.js buy <rail>:<symbol> <qty>` dispatches to the right rail adapter.
- [ ] `node bin/tradex.js sell <rail>:<symbol> <qty>` closes or shorts; symmetric to buy.
- [ ] Invalid rail returns non-zero exit + JSON error.
- [ ] All orders in v1 default to paper; live mode is a non-goal for v1.
- [ ] Tests pass.
- [ ] Typecheck passes.

### US-011: Positions + risk aggregation
**Description:** As a user, I want to see everything I'm holding across rails with a single command plus a risk snapshot.

**Acceptance Criteria:**
- [ ] `node bin/tradex.js positions` prints a JSON array of all open ledger positions, marked to latest prices.
- [ ] `node bin/tradex.js risk` prints `{dailyPnl, openPositions, maxOpenPositions, atCap}`.
- [ ] Mark-to-market pulls latest prices from each rail's scan endpoint (cached 30s to avoid rate limits).
- [ ] Tests pass.
- [ ] Typecheck passes.

### US-012: Panic flatten
**Description:** As a user, I want a single command that closes every open position.

**Acceptance Criteria:**
- [ ] `node bin/tradex.js panic` closes every open ledger position at the latest mark.
- [ ] Emits a 10-second cooldown in memory — subsequent panics within 10s return `cooldown` without re-closing.
- [ ] Prints `{closed: N, realizedPnl: X}`.
- [ ] Tests pass.
- [ ] Typecheck passes.

### US-013: `/opentradex-trade:scan` skill
**Description:** As a user, I want a slash command that scans and formats the result.

**Acceptance Criteria:**
- [ ] `skills/scan/SKILL.md` has `name: scan`, `description` that auto-invokes on intents like "scan markets" / "what's moving".
- [ ] Skill body calls `node bin/tradex.js scan $1 $2` and renders ≤5 candidates with one-line thesis each.
- [ ] `allowed-tools: Bash(node *)` pre-approves the helper.
- [ ] Typecheck passes.

### US-014: `/opentradex-trade:positions` skill
**Description:** As a user, I want a blotter slash command.

**Acceptance Criteria:**
- [ ] `skills/positions/SKILL.md` calls `node bin/tradex.js positions`.
- [ ] Renders a markdown table with Exchange, Symbol, Side, Qty, Entry, Mark, P&L.
- [ ] Empty state: "No open positions".
- [ ] Typecheck passes.

### US-015: `/opentradex-trade:risk` skill
**Description:** As a user, I want a quick risk read.

**Acceptance Criteria:**
- [ ] `skills/risk/SKILL.md` calls `node bin/tradex.js risk`.
- [ ] Renders Risk Officer voice: 3–4 short lines, caps + halted flag.
- [ ] Typecheck passes.

### US-016: `/opentradex-trade:buy` and `/opentradex-trade:sell` skills
**Description:** As a user, I want slash commands for orders.

**Acceptance Criteria:**
- [ ] `skills/buy/SKILL.md` and `skills/sell/SKILL.md` exist.
- [ ] Both accept `<rail>:<symbol> <qty>` as args.
- [ ] Both pre-flight check risk caps and refuse with "VETO" if over.
- [ ] Both default to paper (v1 constraint).
- [ ] Typecheck passes.

### US-017: `/opentradex-trade:panic` skill (manual-only)
**Description:** As a user, I want the kill switch as a slash command.

**Acceptance Criteria:**
- [ ] `skills/panic/SKILL.md` has `disable-model-invocation: true`.
- [ ] Skill prompts user "type `yes flatten` to confirm" and only runs `node bin/tradex.js panic` on that exact confirmation.
- [ ] Prints the flatten result.
- [ ] Typecheck passes.

### US-018: `/opentradex-trade:trade` mega-skill
**Description:** As a user, I want one skill that dispatches the whole flow from a single slash command.

**Acceptance Criteria:**
- [ ] `skills/trade/SKILL.md` accepts `<subcommand> [args...]` (scan, buy, sell, positions, risk, panic, status).
- [ ] Subcommand routing happens inside the skill body — delegates to the same helper.
- [ ] Unknown subcommand prints a short usage list.
- [ ] Typecheck passes.

### US-019: Scout subagent
**Description:** As a user, I want a specialized agent Claude can spawn for market reconnaissance.

**Acceptance Criteria:**
- [ ] `agents/scout.md` exists with `name: scout`, `model: sonnet`, tools limited to Bash + Read.
- [ ] Persona: scan 4 rails in parallel, return 3–5 candidates max, no fabrication.
- [ ] Typecheck passes.

### US-020: Risk Officer subagent
**Description:** As a user, I want a gatekeeper agent that refuses over-cap trades.

**Acceptance Criteria:**
- [ ] `agents/risk-officer.md` exists with veto voice from the existing `agents.md` persona.
- [ ] Pulls `bin/tradex.js risk` state before any ruling.
- [ ] Typecheck passes.

### US-021: Coach subagent
**Description:** As a user, I want post-trade pattern review.

**Acceptance Criteria:**
- [ ] `agents/coach.md` exists with the coach voice.
- [ ] Reads ledger `trades` array for realized history.
- [ ] Typecheck passes.

### US-022: Plugin README
**Description:** As a potential user, I want a README that explains install, what it does, and the safety model.

**Acceptance Criteria:**
- [ ] `opentradex-trade/README.md` covers install, onboard, 4 supported rails, slash command list, paper-only disclaimer, troubleshooting.
- [ ] Explicit "v1 is paper-only; live trading is a non-goal for this version".
- [ ] Includes a one-glance command cheatsheet.

### US-023: LICENSE + keywords for marketplace
**Description:** As a maintainer, I want the plugin ready to publish — legal + discoverability covered.

**Acceptance Criteria:**
- [ ] `opentradex-trade/LICENSE` exists (MIT).
- [ ] `plugin.json` has a `keywords` array including `trading`, `kalshi`, `polymarket`, `alpaca`, `crypto`, `paper-trading`, `claude-code-plugin`.
- [ ] `plugin.json` has `homepage` + `repository`.

### US-024: End-to-end smoke test
**Description:** As a maintainer, I want an automated test that wires the whole thing together.

**Acceptance Criteria:**
- [ ] A single test spec boots the plugin helper, stubs each rail's network call, runs onboard → scan → buy → positions → risk → panic sequence, asserts final state.
- [ ] Runs in <5s.
- [ ] CI green.
- [ ] Tests pass.
- [ ] Typecheck passes.

## Functional Requirements

- FR-1: The plugin must live in its own top-level folder `opentradex-trade/` inside the repo, separate from the existing `claude-plugin/`.
- FR-2: All network work must go through the Node helper at `bin/tradex.js` — skills never curl exchanges directly (so we have one place to add auth, rate limiting, paper-mode gating).
- FR-3: Keys must be stored with file mode 0600, inside a parent dir with mode 0700.
- FR-4: Paper-mode is the only execution path in v1. The helper must never hit live order endpoints.
- FR-5: Every rail adapter must degrade gracefully on missing keys — return empty scan, throw `KEY_MISSING` on order.
- FR-6: The mega-skill and granular skills must share the same helper backend — no code duplication.
- FR-7: All skills must have `allowed-tools: Bash(node *)` so the helper runs without permission prompts.
- FR-8: `panic` skill must have `disable-model-invocation: true` and require literal `yes flatten` confirmation.

## Non-Goals

- **Live trading.** v1 is paper-only. Flipping to live is a future milestone with its own 24-hour mode-lock + onboarding.
- **Web dashboard.** The existing harness has one; this plugin is slash-commands only.
- **Mobile app integration.** Out of scope.
- **Leverage or margin.** Only cash/cash-equivalent products.
- **Options and futures.** Only spot / yes-no contracts in v1.
- **Oanda FX, Interactive Brokers, Binance, Deribit.** Post-v1.
- **Automatic strategy execution (trading bots).** Plugin responds to explicit slash commands only — no background loops.
- **Replacing the existing local gateway.** The harness and this plugin are independent; users can run both.

## Design Considerations

- **CLI over MCP for v1.** Using Bash + a Node helper keeps the install trivial (no MCP server to configure). MCP can be layered on top in v2.
- **Persona inheritance.** Reuse the tone rules from `src/ai/persona/soul.md` — warm, direct, short — by embedding condensed versions into each skill body.
- **Ledger format compatibility.** The `ledger.json` schema should be trivially portable so a future live-mode implementation can reconcile paper history against live fills.

## Technical Considerations

- Node 18+ (no external compile step; helper is plain CommonJS or ESM).
- Zero runtime dependencies beyond `fetch` (built-in on Node 18+). No Express, no SDKs. Hand-rolled HTTP clients per rail to stay small.
- File permissions on Windows: use `fs.chmodSync` best-effort; document that Windows ACLs differ.
- Rate limiting: each rail adapter caches its last scan for 30s.
- Error shape: helper exits non-zero on error and emits `{error: string, code: string}` on stdout so skills can parse.

## Success Metrics

- **Install-to-first-trade** under 2 minutes, including onboarding.
- **Zero runtime crashes** for a user who didn't enter any keys — the plugin should still load and guide them.
- **Fresh install tarball** under 1 MB (it's a thin plugin, no heavy deps).
- **Published** to at least one public marketplace with >100 weekly downloads within 30 days of release.

## Open Questions

- Should the plugin also expose an MCP server as an alternative to the Bash helper? (Would give structured tool calls, but adds install complexity.)
- For Alpaca paper trading — do we honor Alpaca's own paper ledger or keep our own? Current PRD says "keep our own" for consistency across rails.
- Do we need per-rail kill-switches (e.g., disable Kalshi temporarily) in v1, or is the global panic enough?
- Should the Coach subagent be able to read the journal across sessions, or only the current run's ledger?
