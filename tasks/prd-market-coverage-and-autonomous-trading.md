# PRD: Full Market Coverage, Autonomous Analysis, and Verified Paper Execution

## 1. Introduction / Overview

The harness currently scrapes 3 exchanges (Polymarket, Kalshi, Binance) with hard `limit=20` caps, runs a minimal momentum scanner, and only sometimes surfaces results to the dashboard. We just fixed the Kalshi schema regression and saw that entire categories of markets, edges, and execution paths are untested in live conditions.

This PRD covers: (a) exhaustive live scraping across the existing 3 exchanges plus every viable free-tier source we can add, (b) automated + live dashboard verification that every scraper and trading path is working, (c) multi-layer autonomous analysis (per-exchange strategy + LLM thesis generation), and (d) end-to-end verified paper-trade execution for every flow the UI exposes — manual, auto-loop, close/reduce/add, panic, and scheduled strategies. API keys required for free tiers will be acquired at runtime via an agent-browser / computer-use flow against the user's Gmail sign-in, stored locally via Electron `safeStorage`, and never committed to git.

## 2. Goals

- Scrape **all available markets** (not a `limit=20` slice) from every supported exchange with real prices, real volume, and sensible staleness guarantees.
- Add **5+ new free-tier market rails**: Coinbase spot, CoinGecko, PredictIt, Manifold, Alpaca paper stock feed.
- **Every scraper has a live test** in `npm test` that fails if it returns zero non-zero prices or is stale beyond threshold.
- **Live dashboard Scraper Health panel** shows per-exchange status at a glance.
- **Every paper-trade flow works end-to-end** and is visible in the dashboard Trades panel + Positions panel within 2 seconds of the action.
- Every executed trade carries a **thesis** (strategy score + LLM reasoning) retrievable from the Trade Journal.
- **Auto-loop and scheduled strategies** run unattended for ≥30 minutes without error, executing at least one reasoned paper trade per rail.
- API key acquisition for free tiers is **automated via agent-browser** and persisted securely — no manual key-copy step required after first run.

## 3. User Stories

### US-001: Exhaustive scraping for existing 3 exchanges
**Description:** As a trader, I want the scraper to return every open market on Polymarket, Kalshi, and Binance — not a 20-event slice — so analysis has the full opportunity set.

**Acceptance Criteria:**
- [ ] Polymarket scraper paginates through all open events (cursor or offset) up to a configurable cap (default 500)
- [ ] Kalshi scraper paginates through all open events (`cursor` param) up to same cap
- [ ] Binance scraper covers top ~50 USDT pairs by 24h volume (not hardcoded list of 5)
- [ ] `getExchangeEvents('kalshi' | 'polymarket' | 'binance')` each return ≥100 markets in normal market hours
- [ ] Typecheck + existing tests pass

### US-002: Add Coinbase spot market scraper
**Description:** As a trader, I want Coinbase spot tickers alongside Binance so I can cross-reference prices and access US-available pairs.

**Acceptance Criteria:**
- [ ] New `scrapeCoinbase()` in `src/scraper/exchanges.ts` hitting `api.exchange.coinbase.com/products/{id}/ticker`
- [ ] Returns top 20 USD pairs by 24h volume with `price`, `volume`, `high`, `low`
- [ ] Added to `scrapeAllExchanges` via Promise.allSettled
- [ ] Unit test asserts `exchange === 'coinbase'` events have `price > 0`
- [ ] Typecheck passes

### US-003: Add CoinGecko aggregate scraper (with key)
**Description:** As a trader, I want CoinGecko's aggregated market data (sentiment, cross-exchange volume) to enrich crypto signals.

**Acceptance Criteria:**
- [ ] New `scrapeCoinGecko()` using demo API key from env (`COINGECKO_DEMO_KEY`)
- [ ] Returns top 50 coins by market cap with `price_change_percentage_24h`, `total_volume`, `market_cap`
- [ ] Graceful empty return if key missing (no throw)
- [ ] Key acquisition handled by US-007
- [ ] Typecheck passes

### US-004: Add PredictIt scraper
**Description:** As a trader, I want PredictIt US political-event markets to broaden prediction-market coverage beyond Polymarket/Kalshi.

**Acceptance Criteria:**
- [ ] New `scrapePredictIt()` hitting `https://www.predictit.org/api/marketdata/all/`
- [ ] Returns all open contracts with `yesPrice`, `noPrice`, `volume`
- [ ] `exchange === 'predictit'`, category `'prediction'`
- [ ] Unit test asserts ≥20 markets returned in normal hours
- [ ] Typecheck passes

### US-005: Add Manifold scraper
**Description:** As a trader, I want Manifold prediction-market data (play-money but high-signal crowd) for probability cross-checks.

**Acceptance Criteria:**
- [ ] New `scrapeManifold()` hitting `api.manifold.markets/v0/markets?limit=500`
- [ ] Filters to open (`isResolved === false`) binary markets
- [ ] Returns ≥100 markets with `yesPrice` from `probability` field
- [ ] Unit test asserts non-zero market count
- [ ] Typecheck passes

### US-006: Add Alpaca paper stock feed
**Description:** As a trader, I want US equity quotes (free via Alpaca paper data API) so stock signals aren't synthetic.

**Acceptance Criteria:**
- [ ] New `scrapeAlpaca()` using `APCA_API_KEY_ID` + `APCA_API_SECRET_KEY` (paper endpoint)
- [ ] Returns quotes for watchlist of 20 liquid US stocks (SPY, QQQ, AAPL, NVDA, MSFT, GOOGL, AMZN, META, TSLA, AMD, …)
- [ ] Maps `exchange === 'alpaca'`, `category === 'stocks'`
- [ ] Graceful empty return if keys missing
- [ ] Typecheck passes

### US-007: Automated free-tier key acquisition via agent-browser
**Description:** As a user, I want the harness to obtain free-tier API keys on my behalf using my existing Gmail sign-in so I don't have to manually sign up for every service.

**Acceptance Criteria:**
- [ ] New `scripts/acquire-keys.ts` that uses the existing agent-browser / computer-use flow
- [ ] Handles Alpaca (paper), CoinGecko (demo), Kalshi (read-only), and one LLM fallback (Groq free tier)
- [ ] Detects existing keys and skips — idempotent
- [ ] Writes keys to `.env.local` (gitignored) and Electron `safeStorage` for desktop users
- [ ] Produces a run report: which services got keys, which failed, why
- [ ] Never logs or prints raw key values (only prefixes / suffixes)
- [ ] Typecheck passes

### US-008: Secure secret storage for all keys
**Description:** As a user, I want all API keys stored via Electron `safeStorage` on desktop and `.env.local` elsewhere so keys never touch git.

**Acceptance Criteria:**
- [ ] `src/ai/ai-keys.ts` pattern extended to cover all market-data keys
- [ ] `packages/desktop/src/secrets.ts` uses Electron `safeStorage` (already exists — extend, don't rewrite)
- [ ] `.gitignore` verified to exclude `.env.local` and any `secrets.json`
- [ ] Startup check warns (not errors) on missing optional keys with a link to trigger US-007
- [ ] Typecheck + existing secrets.test.ts passes

### US-009: Per-scraper live smoke tests
**Description:** As an engineer, I want `npm test` to include a live smoke test for every scraper that fails if the scraper returns zero valid markets.

**Acceptance Criteria:**
- [ ] New `src/scraper/exchanges.live.test.ts` with one test per scraper
- [ ] Each test: scrape → assert ≥N markets with `price > 0` and `price < reasonable ceiling`
- [ ] Runs under `npm run test:live` (separate from fast unit tests — doesn't block CI default)
- [ ] Tagged so it's skipped if env `SKIP_LIVE=1`
- [ ] Typecheck passes

### US-010: Dashboard Scraper Health panel
**Description:** As a user, I want a live panel in the dashboard showing each exchange's scrape health so I can spot broken rails immediately.

**Acceptance Criteria:**
- [ ] New `<ScraperHealth />` component in `packages/dashboard`
- [ ] Shows per-exchange: status dot (green/yellow/red), market count, last scrape timestamp, % with `price > 0`, last error
- [ ] Data sourced from a new `/api/scraper/health` gateway endpoint
- [ ] Refreshes via existing WebSocket on every scrape cycle (~45s)
- [ ] Red status if last scrape >120s ago or market count dropped >50% vs 5-min average
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-011: Per-exchange strategy modules
**Description:** As the autonomous trader, I want exchange-appropriate strategy modules — prediction-market edge detection vs base rate for Kalshi/Polymarket/PredictIt/Manifold, momentum for crypto, gap-ups for stocks — so signals are category-aware.

**Acceptance Criteria:**
- [ ] New `src/agent/strategies/` directory with one module per category: `prediction.ts`, `crypto-momentum.ts`, `stock-gap.ts`
- [ ] Each exports `score(market): { score: number; reasons: string[]; suggestedSide: 'buy'|'sell'|'yes'|'no' }`
- [ ] `prediction.ts` cross-references Manifold probabilities against Kalshi/Polymarket/PredictIt for divergence edges (>10pp flagged)
- [ ] Scanner calls the right module per exchange and merges results
- [ ] Unit tests for each strategy with fixture markets
- [ ] Typecheck passes

### US-012: LLM thesis generation for each candidate trade
**Description:** As a user, I want every candidate signal enriched with a short LLM-generated thesis (1–3 sentences) using whichever AI provider is configured, so I can see reasoning behind the trade.

**Acceptance Criteria:**
- [ ] New `src/agent/thesis.ts` function `generateThesis(market, strategyResult) → Promise<string>`
- [ ] Uses existing `getAI()` provider registry — respects currently selected provider
- [ ] Fails gracefully if no provider configured (returns `strategyResult.reasons.join('; ')`)
- [ ] Caches per `(symbol, strategyScore-bucket)` for 10 min to avoid re-billing
- [ ] Thesis attached to every `ScanResult` and persisted with trades
- [ ] Unit test with mock provider
- [ ] Typecheck passes

### US-013: Signal aggregator with ranked trade list
**Description:** As the agent, I want a single ranked list of the top-N trade candidates across all exchanges each scan cycle so auto-execution picks the best opportunity.

**Acceptance Criteria:**
- [ ] New `src/agent/aggregator.ts` combines outputs of all strategy modules + theses
- [ ] Produces `RankedCandidate[]` sorted by `score` desc, top 10 by default
- [ ] Each candidate has: `exchange`, `symbol`, `side`, `score`, `reasons`, `thesis`, `entryPrice`, `suggestedSize`
- [ ] Scanner replaces its ad-hoc logic with the aggregator
- [ ] Dashboard receives ranked list via existing WebSocket
- [ ] Typecheck passes

### US-014: E2E verification — agent auto-loop across all rails
**Description:** As a user, I want the auto-loop to run unattended for 30 minutes and execute at least one reasoned paper trade per rail that has signals.

**Acceptance Criteria:**
- [ ] New `scripts/e2e-autoloop.mjs` starts gateway → starts agent → runs 30m → asserts ≥1 trade on ≥3 distinct exchanges
- [ ] Asserts each trade has a thesis attached
- [ ] Asserts no gateway errors in the window
- [ ] Runs under `npm run test:e2e:autoloop`
- [ ] Produces a human-readable report

### US-015: E2E verification — manual trade flows per exchange
**Description:** As a user, I want buy/sell commands to work for every exchange class, with the trade + position reflected in the dashboard within 2s.

**Acceptance Criteria:**
- [ ] E2E script hits `/api/command` with `/buy` (crypto), `kalshi buy yes/no`, a Polymarket buy intent (to be added), and an Alpaca stock buy
- [ ] Asserts `GET /api/positions` shows each new position
- [ ] Asserts WebSocket `trade` + `positions` events fired
- [ ] Adds missing intents (Polymarket buy, Alpaca buy) to match the pattern of the new `kalshi.trade` intent
- [ ] Typecheck passes

### US-016: E2E verification — close/reduce/add + panic
**Description:** As a user, I want every position-modification button to work end-to-end across all exchanges, and panic-flatten to close every open position regardless of exchange.

**Acceptance Criteria:**
- [ ] E2E script opens 5 positions across 5 exchanges
- [ ] Issues `close position X on Y`, `reduce position X on Y by 50%`, `add to position X on Y 10` for each
- [ ] Asserts correct intermediate state after each
- [ ] Issues `/panic`, asserts all positions flattened
- [ ] Asserts correct realized P&L accounting
- [ ] Typecheck passes

### US-017: Scheduled strategy runner
**Description:** As a user, I want to schedule recurring strategies (e.g., "re-evaluate prediction markets every 15m", "crypto momentum every 5m") so the agent isn't purely event-driven.

**Acceptance Criteria:**
- [ ] New `src/agent/scheduler.ts` with `schedule(name, cronExpr, strategyFn)` API
- [ ] Built-in schedules: prediction re-eval 15m, crypto momentum 5m, stock gap 1m during market hours
- [ ] Each run produces a scan → ranked candidates → (if auto-trade on) executes top-1
- [ ] Dashboard shows next-run ETA per schedule
- [ ] Typecheck + unit test with fake clock
- [ ] Verify in browser using dev-browser skill

### US-018: Trade Journal panel with thesis per trade
**Description:** As a user, I want a Trade Journal panel in the dashboard where every executed trade shows its thesis, strategy score, and signal source so I can audit the reasoning.

**Acceptance Criteria:**
- [ ] New `<TradeJournal />` component in `packages/dashboard`
- [ ] Shows each trade with: timestamp, exchange, symbol, side, price, P&L, **thesis text**, **strategy score**
- [ ] Click row to expand full reasoning + linked market snapshot
- [ ] Backed by a `/api/trades/journal` endpoint that persists trade records with thesis
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

## 4. Functional Requirements

- **FR-1:** Scraper service MUST paginate through all open markets on Polymarket, Kalshi, and Binance — `limit=20` caps removed, configurable max via env.
- **FR-2:** Scraper service MUST support at least 8 exchanges total: Polymarket, Kalshi, Binance, Coinbase, CoinGecko, PredictIt, Manifold, Alpaca.
- **FR-3:** Every scraper MUST return `price > 0` for ≥90% of returned markets, or the scraper is flagged unhealthy.
- **FR-4:** System MUST expose `/api/scraper/health` returning per-exchange status, count, last scrape ts, error rate.
- **FR-5:** Dashboard MUST render scraper health in real time via WebSocket; red status on stale or empty scrapes.
- **FR-6:** System MUST support automated key acquisition via agent-browser for: Alpaca paper, CoinGecko demo, Groq (LLM fallback), and Kalshi read-only.
- **FR-7:** All API keys MUST be persisted via Electron `safeStorage` on desktop and `.env.local` elsewhere — never in git.
- **FR-8:** Agent scanner MUST route each market to the right strategy module (prediction / crypto momentum / stock gap).
- **FR-9:** Every candidate trade MUST have a thesis (LLM or fallback reasons) attached before it reaches the dashboard.
- **FR-10:** Signal aggregator MUST produce a ranked top-10 list across all exchanges every scan cycle.
- **FR-11:** Auto-loop MUST execute the top candidate if `autoTrade === true` and risk checks pass.
- **FR-12:** Manual trade flows (`/buy`, `kalshi buy`, `polymarket buy`, etc.) MUST work for every exchange class and reflect in dashboard Positions within 2s.
- **FR-13:** Position close/reduce/add buttons MUST work for every exchange; `/panic` flattens all.
- **FR-14:** Scheduled strategies MUST run independently on cron-like triggers; schedule status visible in dashboard.
- **FR-15:** Trade Journal MUST persist every trade with thesis and be queryable per-symbol and per-exchange.
- **FR-16:** Live smoke tests MUST run via `npm run test:live` and fail CI if any scraper returns zero data.
- **FR-17:** 30-minute unattended auto-loop E2E MUST execute ≥1 reasoned paper trade on ≥3 distinct exchanges.

## 5. Non-Goals (Out of Scope)

- Live (real-money) trading on any venue — paper only.
- WebSocket-based exchange feeds — polling is acceptable for this PRD.
- Historical/backtesting infrastructure beyond in-memory journal.
- New UI framework or redesign — reuse existing dashboard components.
- Options / derivatives markets beyond what the listed exchanges natively expose.
- Mobile / desktop native-feature parity for the new panels (web-first; desktop picks them up via the embedded webview).
- Multi-user accounts or auth for the dashboard — single local user.
- Replacing the intent-regex router with LLM tool-calling.
- Tax reporting / compliance features.

## 6. Design Considerations

- Reuse existing dashboard patterns: sidebar panel, rounded-square cards, monospace for prices, existing color palette (navy + teal/cyan accents matching the new logo).
- Scraper Health panel sits below LeftSidebar's current content; Trade Journal replaces or augments the existing Recent Trades panel with a "Journal" tab.
- LLM thesis rendering uses the same mono font + italic for model-generated text.
- Strategy module outputs surface visually: score as a colored bar (0–100), reasons as chips.

## 7. Technical Considerations

- **Pagination cost:** Polymarket has ~10k open markets, Kalshi ~2k, Manifold ~30k — cap at `SCRAPER_MAX_MARKETS=500` per exchange per cycle to keep latency <5s and memory bounded.
- **Rate limits:** CoinGecko demo = 30 rpm; Alpaca paper = 200 rpm; Kalshi = 100 rps. Add per-exchange token-bucket in `smartFetch` if needed.
- **LLM cost:** Thesis cache per `(symbol, score-bucket)` 10 min minimum. Fallback to `strategy.reasons.join('; ')` on no-provider or cache miss is acceptable.
- **Agent-browser key acquisition:** depends on user's Gmail being logged in; flow is interactive on first run. Must not block gateway startup — run as a separate `npm run acquire-keys` command.
- **Electron safeStorage:** already in `packages/desktop/src/secrets.ts`; reuse the existing encryption path.
- **WebSocket payload growth:** with 500 markets × 8 exchanges × ranked candidates, payloads may exceed current sizes. Paginate or diff-only updates for the Scraper Health feed.
- **Strategy modules:** pure functions, no I/O — makes unit testing with fixtures trivial.
- **Scheduler:** use `node-cron` or a minimal interval-based version; no heavy framework.

## 8. Success Metrics

- **Coverage:** ≥8 exchanges scraping live with ≥100 markets each (where the venue has that many).
- **Health:** Scraper Health panel shows 100% green for ≥23 hours in a 24-hour window.
- **Analysis depth:** 100% of candidate trades have a thesis attached.
- **Execution:** 30-minute unattended auto-loop executes ≥3 paper trades across ≥3 distinct exchanges, zero crashes.
- **Manual-flow parity:** Every buy/sell/close/reduce/add/panic command verified for every exchange in the E2E suite.
- **Test completeness:** `npm run test:live` runs ≥8 scraper smoke tests and a full E2E suite; passes in CI on a freshly cloned repo with keys present.
- **Key acquisition:** From `npm run acquire-keys` to "all rails healthy" is <3 minutes on first run.
- **Dashboard responsiveness:** Trade-to-visibility latency <2s for every flow.

## 9. Open Questions

- Which LLM provider should be default for thesis generation when multiple keys are present — Anthropic, OpenAI, Groq, or the Claude Code CLI? (Suggest: follow existing `getAI()` priority order; no new config.)
- Should Manifold's play-money probabilities be used directly as a "consensus" anchor, or weighted down vs real-money venues? (Suggest: weighted 0.3× vs real-money 1.0× when computing divergence edges.)
- Is there a preference for `node-cron` vs a minimal interval-based scheduler? (Suggest: minimal interval-based to avoid adding a dep; cron expressions not strictly needed.)
- Should Trade Journal replace the existing "Recent Trades" panel or sit alongside it as a separate tab? (Suggest: replace, with a "Recent" filter as the default view.)
- What's the acceptable cost ceiling for LLM thesis generation per day? (Suggest: cache aggressively + fallback to strategy reasons; target ≤$1/day with Groq free tier.)
- For PredictIt: should we filter to only US-election-year contracts or include all categories? (Suggest: all categories — divergence edges can appear anywhere.)
- For agent-browser key acquisition: fall back to a user-prompted "paste key here" flow if automated flow fails, or hard-fail? (Suggest: fall back to prompt with clear instructions.)
