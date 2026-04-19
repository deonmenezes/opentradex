# PRD: Agent Command Center — Interactive Skills View in Dashboard

## User-Confirmed Decisions

- **Scope (1-C,D):** Unified Agent Command Center covers all nine plugin skills + all harness intents + strategy/analysis modules (`prediction-edge`, `crypto-momentum`, `stock-gap`, `aggregator`).
- **Integration (2):** Ship inside the existing `packages/dashboard` + `packages/desktop` apps. No new app. Components register into the current `App.tsx` routing with a new `#skills` view and augment existing `LeftSidebar` / `RightSidebar` / `TopBar`.
- **Agent knowledge (3-D):** Agent sees live dashboard state, a DAG of harness flow, and proactive "what next" suggestions.
- **Execution (4-B):** Chains run autonomously after a one-time approval; each step may still gate on destructive confirmation but approval of the chain allows non-destructive steps to proceed without re-prompting.
- **Safety (5-B + button):** Destructive skills require BOTH a type-to-confirm text match AND a distinct "Confirm" button click. Escape or 5s inactivity cancels.

## Introduction / Overview

The OpenTradex harness exposes nine first-class trading skills (`buy`, `sell`, `scan`, `panic`, `trade`, `positions`, `onboard`, `dashboard`, `risk`) and a deterministic intent router that maps natural-language commands to harness actions. Today these are only reachable through the chat cockpit's free-text input or the CLI — users cannot see what the agent *can* do, and the agent has no structured surface inside the dashboard to propose its next move.

This feature introduces an **Agent Command Center**: a unified, interactive view inside the dashboard that (a) surfaces every skill the agent can execute, (b) shows the agent what the dashboard is currently showing so it can reason over shared state, (c) lets the user trigger, chain, and inspect skill executions with safety rails, and (d) gives the agent a persistent console for proactive suggestions.

The outcome: the agent is no longer a text box — it becomes a first-class operator of the harness with a visible, clickable, chainable surface.

## Goals

- Surface all nine plugin skills + all harness intents in a single, discoverable UI with live state per skill.
- Give the agent read-access to the dashboard's current view, selection, filters, and panel state so recommendations are context-aware.
- Let users trigger any skill in ≤ 2 clicks, and chain multiple skills into a single reviewable playbook before execution.
- Enforce type-to-confirm gates on destructive skills (panic, sell, reduce) and an always-visible audit log.
- Render a live flow diagram (DAG) showing: data sources → scrapers → strategies → signals → risk check → execution → ledger.
- Deliver a command palette (⌘K / Ctrl+K) that matches against skills, intents, symbols, and recent actions.
- Keep everything paper-mode-safe: no skill in this feature may place a live order.

## User Stories

### US-001: Agent skills registry endpoint
**Description:** As a developer, I need a single source of truth the dashboard can query to list all executable skills and their metadata, so the UI doesn't hard-code skill names.

**Acceptance Criteria:**
- [ ] `GET /api/agent/skills` returns `{ skills: Skill[] }` where `Skill = { id, name, category: 'trade' | 'inspect' | 'setup' | 'safety', description, argsSchema, destructive: boolean, requiresConfirmation: boolean, exampleInvocations: string[] }`
- [ ] Registry is populated from a single constant in `src/agent/skills-registry.ts` mirroring the nine plugin skills + harness-only intents (`analyze`, `add to position`, `reduce position`, `close position`, `kalshi buy`)
- [ ] Adding a new skill requires only editing that registry file — no UI changes
- [ ] Endpoint is covered by a gateway test that asserts all nine plugin skills are present with `argsSchema` shapes
- [ ] Typecheck passes

### US-002: Agent context feed endpoint
**Description:** As the agent, I need to know what the user is currently looking at (active view, selected position/market, open panels, sort order, recent commands) so my suggestions reference real on-screen state.

**Acceptance Criteria:**
- [ ] Dashboard emits a `dashboard-context` event over WS every time the view, selection, or filter changes, debounced to 500ms
- [ ] Payload shape: `{ view: 'cockpit'|'trades'|'markets'|'payments', activePanel: 'left'|'right'|'center', selection: { positionId?, marketId?, feedId? }, filters: { feedTab, positionSort }, recentCommands: string[] }`
- [ ] Gateway stores the latest context per session and exposes `GET /api/agent/context` for agent reads
- [ ] Intent router injects this context into the LLM system prompt when generating responses
- [ ] Unit test: context updates within 600ms of a view change
- [ ] Typecheck passes

### US-003: Command palette (⌘K / Ctrl+K)
**Description:** As a user, I want a global command palette so I can trigger any skill or jump to any view without hunting through menus.

**Acceptance Criteria:**
- [ ] Cmd+K on mac / Ctrl+K on win/linux opens a centered, searchable overlay at z-index above everything
- [ ] Fuzzy matches skill names, intent phrases, position ids, market symbols, view names, and last 10 commands
- [ ] Each result shows: icon, name, category chip, one-line description, keyboard shortcut (if any)
- [ ] Enter executes; Tab previews the full skill card; Esc closes
- [ ] Arrow keys navigate; match count shown at bottom; empty state shows "No matches — try scan, buy, panic, risk"
- [ ] Live-updates ranking as the user types (under 16ms per keystroke on a 200-item list)
- [ ] Persists last 10 commands in localStorage under `opentradex.palette.history`
- [ ] New file: `packages/dashboard/src/components/CommandPalette.tsx`
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-004: Skills panel (dedicated route)
**Description:** As a user, I want a dedicated view that shows every skill as a rich card so I can see what's possible, read examples, and launch from one place.

**Acceptance Criteria:**
- [ ] Nav entry "Skills" in `TopBar` routes to `#skills` view (follows existing hash-router pattern in `App.tsx`)
- [ ] Four category tabs: Trade / Inspect / Setup / Safety
- [ ] Each card shows: skill name, description, argument schema (form with validated inputs), destructive badge if applicable, last-invoked timestamp, last-result summary
- [ ] "Run" button on each card validates args client-side, then POSTs to `/api/agent/skills/:id/invoke`
- [ ] Destructive skills show a red border and require type-to-confirm (US-008)
- [ ] Cards show real-time execution state: idle / running / success / failed, with a 2s success flash
- [ ] New file: `packages/dashboard/src/pages/SkillsPage.tsx`
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-005: Skill invocation endpoint
**Description:** As a developer, I need a unified gateway endpoint that routes skill invocations through the existing intent router so both the UI and the plugin skills share one execution path.

**Acceptance Criteria:**
- [ ] `POST /api/agent/skills/:id/invoke` with body `{ args: object, chainId?: string, confirmed?: boolean }` returns `{ runId, status: 'ok'|'blocked'|'failed', output: string, emitted: { positions?, trades?, messages? }, durationMs }`
- [ ] Destructive skills return `status: 'blocked'` + `reason: 'confirmation_required'` unless `confirmed === true`
- [ ] Non-destructive skills execute immediately via existing intent router (`src/ai/intents.ts`)
- [ ] Every invocation writes to an in-memory run log (last 200 entries) exposed at `GET /api/agent/runs`
- [ ] Blocks and errors never throw 500s — all failures return `{ status: 'failed', output: <human-readable> }`
- [ ] Unit tests: `buy` routes correctly, `panic` blocks without confirmation, unknown skill id returns 404
- [ ] Typecheck passes

### US-006: Floating Agent Console
**Description:** As a user, I want a persistent console in the corner of the dashboard that shows the agent's current recommendation, recent skill runs, and a one-click "apply" button, so I never have to ask "what should I do next?".

**Acceptance Criteria:**
- [ ] Collapsed: 48px circular button bottom-right with status dot (green=idle, amber=thinking, blue=suggestion-ready, red=blocked-action)
- [ ] Expanded: 360px wide panel showing: current agent status line, latest ranked candidate (from `/api/agent/candidates`), 3 most recent skill runs with status, "Apply suggestion" button
- [ ] Panel is draggable; position persists in localStorage under `opentradex.console.position`
- [ ] Refreshes every 10s or on WS `candidate` event, whichever first
- [ ] "Apply suggestion" routes through the skill invocation endpoint and shows inline result
- [ ] Does not intercept clicks when collapsed (pointer-events contained)
- [ ] Hidden in `setup` and `onboarding` flows so it doesn't obscure the wizard
- [ ] New file: `packages/dashboard/src/components/AgentConsole.tsx`
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-007: Agent flow visualizer (DAG)
**Description:** As a user, I want a live graph showing how data moves through the harness — scrapers → strategies → risk → execution — so I understand what the agent is actually doing.

**Acceptance Criteria:**
- [ ] New tab "Flow" inside Skills page, or standalone route `#flow`
- [ ] Renders nodes for: 6 scrapers (Kalshi, Polymarket, Binance, Coinbase, PredictIt, Manifold), 3 strategy modules (prediction-edge, crypto-momentum, stock-gap), signal aggregator, risk gate, executor, ledger
- [ ] Edges show data flow direction; pulse animation when data is flowing in the last 5s
- [ ] Node color: green (healthy), amber (stale ≤120s / partial data), red (stale >300s / errored)
- [ ] Click a node to see: last update timestamp, sample payload (first 3 events), error messages, linked skills that consume it
- [ ] Data sourced from `/api/scraper/health`, `/api/agent/candidates`, `/api/risk`, and the run log (US-005)
- [ ] Uses a lightweight SVG layout — no heavy graph libs; accept simple left-to-right tiered layout
- [ ] New file: `packages/dashboard/src/components/FlowVisualizer.tsx`
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-008: Type-to-confirm gate for destructive skills
**Description:** As a user, I want a deliberate type-to-confirm step on panic, sell, close, and reduce so I never flatten my book by accident.

**Acceptance Criteria:**
- [ ] Modal dialog shown before `panic`, `sell`, `close position`, `reduce position` invocations
- [ ] User must type the literal word shown in red (`PANIC`, `CLOSE`, `REDUCE`, `SELL`) — case-sensitive
- [ ] "Confirm" button is disabled until the typed string exactly matches
- [ ] Dialog lists exactly what will happen: "This will close 3 positions: KXBTC-25-Y, AAPL-long, SOL-USD. Net realized impact: -$47.30."
- [ ] 5s auto-cancel if user does nothing (reverts to idle)
- [ ] Escape or clicking outside cancels without side effects
- [ ] Successful confirmation attaches `confirmed: true` to the invoke POST
- [ ] New file: `packages/dashboard/src/components/ConfirmDestructive.tsx`
- [ ] Unit test: component renders correct position list, disables confirm until exact match, auto-cancels after 5s
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-009: Chained execution playbooks
**Description:** As a user, I want to queue a multi-step playbook — "scan crypto, then buy top candidate, then check risk" — and have the agent execute it one step at a time with previews.

**Acceptance Criteria:**
- [ ] "Chain" button in the Skills page lets the user add 2–6 skill invocations in order
- [ ] Each step shows a preview of its args with outputs from the previous step available as `{previous.output}` template tokens
- [ ] "Dry run" button shows what each step would invoke with resolved args, without executing
- [ ] "Run" button executes sequentially, aborting on first failure; shows per-step status line
- [ ] Destructive steps still trigger US-008 confirmation individually (not batched)
- [ ] `POST /api/agent/chains/run` with `{ steps: Array<{ skillId, args }> }` returns a `chainId` + streams step updates via WS
- [ ] WS events: `chain:step:start`, `chain:step:end`, `chain:complete`, `chain:aborted`
- [ ] Last 20 chains persist in-memory at gateway for `/api/agent/chains`
- [ ] New file: `packages/dashboard/src/components/ChainBuilder.tsx`
- [ ] Integration test: a 3-step chain (scan → analyze → no-op) completes end-to-end under 10s
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-010: Audit log panel
**Description:** As a user, I want an always-visible audit trail of every skill invocation so I can review what the agent did and when.

**Acceptance Criteria:**
- [ ] New section in `RightSidebar` (below existing feed) titled "Agent Log"
- [ ] Shows last 20 skill runs: timestamp, skill id, args summary, status badge, duration
- [ ] Click a row to expand full args + output
- [ ] "Filter: me / agent / all" toggle — agent-initiated runs (from chains or auto-loop) vs user-initiated
- [ ] "Export" button dumps last 200 to a downloadable JSON file
- [ ] Data source: `/api/agent/runs` + WS `run` events
- [ ] Edit file: `packages/dashboard/src/components/RightSidebar.tsx`
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-011: Agent-initiated skill suggestions
**Description:** As a user, I want the agent to proactively surface skill suggestions based on what I'm looking at (e.g., looking at a position in the red → suggest sell or reduce).

**Acceptance Criteria:**
- [ ] When user selects a position in `LeftSidebar`, the Agent Console shows 2–3 ranked suggestions drawn from: close-if-PnL-below-threshold, add-if-thesis-intact, monitor
- [ ] When a scan completes, console surfaces top candidate + "paper buy" shortcut
- [ ] Suggestion logic lives in `src/agent/suggestions.ts` with unit-tested thresholds (default: PnL < −5% → suggest reduce; PnL > +15% → suggest take profit 50%)
- [ ] Each suggestion exposes `skillId` + prefilled `args` so "Apply" is one click
- [ ] Suggestions never fire during panic cooldown or for skills that would be blocked by risk
- [ ] Typecheck passes

### US-012: Dashboard context → agent system prompt
**Description:** As the agent reasoning over commands, I need the dashboard's current state injected into my system prompt so my answers reference what the user actually sees.

**Acceptance Criteria:**
- [ ] `src/ai/intents.ts` (or its LLM-fallback handler) prepends a short `[Dashboard Context]` block to the LLM system prompt containing: active view, selected entity, open positions count, today's P&L, panic cooldown status, the 5 most recent skill runs
- [ ] Context is fetched from `/api/agent/context` (US-002) at each command
- [ ] Kept under 600 tokens; older/less relevant fields dropped first
- [ ] Flag `OPENTRADEX_DISABLE_CONTEXT_INJECT=1` disables it for debugging
- [ ] Unit test: a command issued while viewing `#trades` with 2 open positions yields a system prompt containing "view: trades" and "open positions: 2"
- [ ] Typecheck passes

### US-013: Keyboard shortcuts for top skills
**Description:** As a power user, I want one-keystroke shortcuts to trigger the most common skills so I don't need the palette every time.

**Acceptance Criteria:**
- [ ] `g` then `s` → scan all markets
- [ ] `g` then `r` → risk snapshot
- [ ] `g` then `p` → positions view
- [ ] `!` → opens panic confirmation (still requires type-to-confirm)
- [ ] `/` → focuses chat input
- [ ] `?` → opens shortcut help overlay
- [ ] Shortcuts only active when focus is outside input/textarea
- [ ] New file: `packages/dashboard/src/hooks/useKeyboardShortcuts.ts`
- [ ] Help overlay lists all shortcuts with their skill mapping
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-014: Skills live status badges in TopBar
**Description:** As a user, I want small status badges in the top bar showing at-a-glance: auto-loop state, panic cooldown, unacknowledged agent suggestions, pending chain.

**Acceptance Criteria:**
- [ ] Auto-loop badge: shows "AUTO" green when active, gray when off; click toggles (existing behavior preserved)
- [ ] Panic cooldown badge: appears only if cooldown > now; shows minutes remaining; click shows cooldown source
- [ ] Suggestion pill: appears only if Agent Console has unread suggestions; shows count; click expands console
- [ ] Chain pill: appears while a chain is mid-execution; shows "2/4" step progress; click scrolls to ChainBuilder
- [ ] All badges subscribe to WS events; no polling for UI state
- [ ] Edit file: `packages/dashboard/src/components/TopBar.tsx`
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-015: E2E test — complete command-center flow
**Description:** As a developer, I need an end-to-end test that exercises the full Command Center flow so regressions are caught before release.

**Acceptance Criteria:**
- [ ] Test spins up gateway with a seeded paper ledger (2 open positions)
- [ ] Opens dashboard in a headless browser (Playwright or Puppeteer)
- [ ] Steps: press Ctrl+K → type "scan kalshi" → Enter → assert scan results render
- [ ] Then: navigate to Skills page → click "Buy" card → fill args → submit → assert success flash + new position in LeftSidebar
- [ ] Then: click the new position → click "Close" in hover menu → assert type-to-confirm modal → type CLOSE → confirm → assert position removed from UI
- [ ] Then: open Agent Console → assert a suggestion appears within 3s → click Apply → assert skill run logged
- [ ] Test file: `packages/dashboard/e2e/command-center.spec.ts`
- [ ] CI runs this under `npm run test:e2e` (added to package.json)
- [ ] Typecheck passes

### US-016: Documentation for skill authors
**Description:** As a developer adding a new skill, I need a short guide so I know how the skill surfaces in the Command Center.

**Acceptance Criteria:**
- [ ] New file: `docs/adding-a-skill.md`
- [ ] Covers: registry shape in `src/agent/skills-registry.ts`, destructive vs non-destructive flags, argsSchema format, how to expose via the plugin (`opentradex-trade/skills/<name>/SKILL.md`), how to add a keyboard shortcut
- [ ] Includes a worked example adding a hypothetical `stop-loss` skill end-to-end
- [ ] Links from README

## Functional Requirements

- FR-1: All nine plugin skills (`buy`, `sell`, `scan`, `panic`, `trade`, `positions`, `onboard`, `dashboard`, `risk`) plus all harness intents from `src/ai/intents.ts` MUST be enumerable via `GET /api/agent/skills`.
- FR-2: The dashboard MUST show a Cmd+K / Ctrl+K command palette that matches skills, intents, symbols, view names, and history.
- FR-3: The dashboard MUST have a dedicated `#skills` route with category tabs and a runnable card per skill.
- FR-4: Every skill invocation MUST go through `POST /api/agent/skills/:id/invoke` so there is one execution path.
- FR-5: Destructive skills (`panic`, `sell`, `close position`, `reduce position`) MUST require type-to-confirm and MUST NOT execute without `confirmed: true`.
- FR-6: A floating Agent Console MUST be available on the cockpit view showing current suggestion and recent runs.
- FR-7: A flow visualizer MUST render the data path from scrapers through strategies to execution, with live health colors.
- FR-8: The agent MUST receive a dashboard-context snapshot in its system prompt for every command.
- FR-9: Users MUST be able to queue 2–6 skills into a chain with dry-run preview before execution.
- FR-10: An audit log MUST persist the last 200 skill runs in-memory at the gateway and be exposed via `/api/agent/runs`.
- FR-11: The feature MUST be paper-only: no skill in this feature may send a live order. Live-mode code paths must be behind `OPENTRADEX_LIVE=1` and explicitly excluded from Command Center invocations in v1.
- FR-12: The feature MUST NOT break existing flows: chat input, position actions in LeftSidebar, existing routes, setup wizard, WS reconnection.
- FR-13: Keyboard shortcuts MUST be disabled when focus is inside an input or textarea.
- FR-14: All network failures MUST degrade gracefully — palette still opens offline, cached skills registry still renders, invocations queue and retry.
- FR-15: All destructive confirmations MUST auto-cancel after 5s of inactivity.

## Non-Goals (Out of Scope)

- No live-mode execution. Command Center is paper-first; live-mode wiring is a follow-on PRD.
- No multi-user accounts, team permissions, or role-based access. Single-operator only.
- No mobile-native UI. The existing mobile package gets the command palette only; Skills page and Flow visualizer are desktop/web-only in v1.
- No recording/replay of chains. A chain runs once; no scheduled chain execution. (Scheduled strategies are tracked separately in PRD #1 US-017.)
- No LLM-generated custom skills. Skills are hard-coded in `src/agent/skills-registry.ts`.
- No external skill marketplace. The plugin's nine skills + internal intents only.
- No undo for destructive actions post-confirmation. Type-to-confirm is the safety net; after confirmation, actions are final.
- No new charting beyond the flow visualizer. P&L and position charts are separate.

## Design Considerations

- Palette overlay uses the existing `surface`, `border`, `accent` design tokens — no new colors.
- Skills page reuses `hs-section-header` / `hs-row` / `hs-section-label` classes already in the codebase.
- Agent Console's "thinking" state reuses the three-dot pulse animation from `ChatCockpit` for visual consistency.
- Flow visualizer pulse animation reuses the `animate-pulse` on status dots in `RightSidebar`.
- All new components memoized like existing ones (`memo(function ...)` — match the pattern in `LeftSidebar` and `RightSidebar`).
- Destructive red borders use existing `border-danger` token; success flashes use `accent`; warning amber uses `warning`.
- Type-to-confirm modal styled to match `SetupWizard` (backdrop, centered card, escape-to-close).

## Technical Considerations

- Reuse the existing intent router in `src/ai/intents.ts` — don't fork logic. The invoke endpoint is a thin wrapper that formats a command string and calls the router.
- `GET /api/agent/candidates` already exists (see recent gateway changes) — Agent Console and suggestions consume it directly.
- WS path is already established (`/ws`) with reconnection logic in `useHarness.ts` — extend the message type union, don't add new sockets.
- In-memory run log keeps the gateway stateless — no DB. Restart clears history; that's acceptable for v1.
- Command palette fuzzy matcher should be pure JS (no dep) — a small Levenshtein or token-prefix scorer will do for the expected dataset size (< 200 items).
- Flow visualizer health data comes from `/api/scraper/health` which was added during the market-coverage work.
- All new endpoints live in `src/gateway/index.ts` — match the existing `if (path === '/api/...')` dispatch style.
- New client files registered via barrel-free imports to match existing style.
- Build system is already `tsc + copy-assets`; no new tooling required.

## Success Metrics

- User can trigger any of the nine skills in ≤ 2 clicks from any view (≤ 1 click from the palette).
- ≥ 80% of a new user's first-session trades go through the Command Center (palette + Skills page + Console) rather than freeform chat, measured by run-log `source` field.
- Zero unconfirmed destructive invocations in the run log over a 30-day dev-use window.
- Agent suggestions applied rate: ≥ 30% of surfaced suggestions get an "Apply" click during active sessions.
- Flow visualizer health badges agree with `/api/scraper/health` with < 2s lag at p95.
- Command palette keystroke-to-render latency p95 < 16ms on a 200-item registry.

## Open Questions

- Should chains be serializable/shareable across sessions (export/import JSON) or strictly ephemeral? — assume ephemeral for v1; revisit after usage.
- Does the Flow visualizer belong inside the Skills page or as its own top-level route? — PRD assumes a tab inside Skills; can promote to standalone later.
- How should the Agent Console behave on mobile? — hidden in v1; a drawer version is a follow-on.
- Should the type-to-confirm word be customizable per skill? — v1 uses hardcoded uppercase skill name; configurable is a nice-to-have.
- Do we want voice-activated skill invocation (webspeech API)? — explicitly out of scope for v1.

## Rollout Plan

- Phase 1 (backend): US-001, US-002, US-005, US-012 — registry + context + invoke endpoint + system-prompt injection. Ship behind no flag; endpoints are additive.
- Phase 2 (core UI): US-003 Palette, US-008 type-to-confirm, US-013 shortcuts. First user-visible increment.
- Phase 3 (depth): US-004 Skills page, US-006 Agent Console, US-010 Audit log.
- Phase 4 (advanced): US-007 Flow visualizer, US-009 Chains, US-011 proactive suggestions, US-014 badges.
- Phase 5 (safety net): US-015 E2E test, US-016 docs.

Each phase is independently shippable and reversible. Command palette alone is usable without Skills page; Skills page is usable without chains.
