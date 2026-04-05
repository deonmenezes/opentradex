# Strategy Notes

Agent-maintained file. Write lessons, market regime observations, and
strategic insights here. This file is loaded each cycle so future
sessions benefit from past experience.

## Known Issues (pre-loaded)

- Always run Python tools with `PYTHONPATH=.` prefix: `PYTHONPATH=. python3 gossip/...`
- Market data always reads from prod API (public, no auth). Demo data is stale/fake.
- Paper trader uses orderbook for real best bid/ask, not market summary (which can be stale).
- Orderbook fields are `yes_dollars` and `no_dollars`, each entry is [price_str, quantity_str].

## Observations

### 2026-04-04 — First Cycle

**Market regime:** Trump cabinet shakeup in progress. Bondi fired Apr 2, more exits under discussion (Patel, Chavez-DeRemer, Driscoll, Lutnick). This creates a cluster of correlated binary events on Kalshi.

**Key lesson: Check for already-resolved events.** The Bondi "leaves before Apr 5" market was still trading at 82-83c YES despite her firing being confirmed 2 days earlier by every major outlet. This is near-arbitrage — the market lags real-world resolution. Always check if events have already occurred before looking at the price.

**Cabinet departure markets:** These tend to have multiple timeframes (Apr 5, Apr 9, Apr 16, May 1). The shorter-dated ones offer better returns when the event has occurred but the market hasn't caught up. The longer-dated ones are more speculative.

**Chavez-DeRemer thesis:** IG investigation + forced aide departures + Trump frustration + pattern of recent firings = elevated probability above market's 43%. Estimated 55-60%. Key risk: Trump has backed off before and says he wants to avoid "massive shake-up." Monitor for news of actual firing or explicit statement she stays.

**Passed on:**
- Kash Patel FBI exit (26.5%) — too uncertain, no concrete indicators beyond speculation
- IPO markets — all illiquid, wide spreads, low volume. Not worth the capital lockup.
- Greenland purchase (0.5%) — correctly priced near zero

**Trades executed:**
1. KXBONDIOUT-26APR-APR05 YES @ 82c × 10 — near-certain resolution, expected +$1.80
2. KXDEREMEROUT-26-MAY01 YES @ 44c × 5 — medium confidence, 13pp estimated edge

### 2026-04-04 — Second Cycle

**Market regime:** Iran war week 6, strong March jobs report, rising mortgage rates (6.46%). AG Bondi fired, Zeldin likely replacement. Cabinet anxiety continues.

**Greenland trade:** Bought NO × 8 @ 65c on KXGREENTERRITORY-29 (US acquires Greenland by Jan 2029). Market at 35-36c YES, my estimate 12%. Edge: 23pp. Key evidence:
- Denmark & Greenland firmly oppose: PM said "we choose Denmark"
- Trump pledged at Davos not to use force/tariffs
- No formal negotiations, only vague "framework" talks
- Iran war diverts political capital
- Legal/diplomatic complexity of sovereignty transfer enormous
Risk: Trump unpredictability, long time horizon (3 years). Capital locked for potentially long period.

**Position review:**
- Bondi YES: Still active, closes Apr 5. Will resolve YES. Hold for settlement.
- DeRemer YES: Market flat at 42-44c (our entry 44c). IG investigation ongoing, aides forced out. WashPost says she's "vulnerable." But Trump "wants to avoid massive shake-up." Thesis weakened slightly but still alive. HOLD.

**Markets researched — no trade:**
- **Next AG (KXNEXTAG-29):** Zeldin 55%, Blanche 23%. Zeldin is reported frontrunner but not finalized. Market seems efficient. NOTE: Acting/interim don't count — only Senate-confirmed or recess appointments.
- **OpenAI vs Anthropic IPO (KXOAIANTH-40):** Anthropic at 80% to IPO first. Both targeting Q4 2026. Anthropic has banks/counsel engaged; OpenAI CFO hedging to 2027. My estimate ~70-75% Anthropic. Edge only 5-10pp — below threshold.
- **Netflix Top Show Apr 6 (KXNETFLIXRANKSHOWGLOBAL-26APR06):** XO, Kitty dominates daily chart (#1 with 880 pts vs #2 at 589) but is NOT listed as a market option. If it wins weekly chart, all listed options resolve NO. But edge per contract is thin on the NO side (buying at 91-94c for 6-9c profit).
- **Next Cabinet Departure (KXCABOUT-26APR):** DeRemer 32-34c, Gabbard 23-26c, Hegseth 16-18c, Lutnick 11-12c. Reporting says DeRemer & Lutnick most vulnerable, Trump privately asking about replacing Gabbard. Roughly efficient pricing.
- **2028 Presidential:** Vance 18c, Newsom 18c, Rubio 12c, AOC 5-6c. Too long-dated, didn't find clear edge.

**Process lessons:**
- `kalshi.py scan` is VERY slow (minutes). Use `search` for targeted lookups or direct API calls for bulk queries.
- Most non-sports Kalshi markets have zero liquidity. The active categories are: Elections, Politics, some Entertainment (Netflix).
- Sports markets dominate volume. Avoid unless you have a genuine sports analytics edge.
- The events API with `with_nested_markets` is the fastest way to survey the full market landscape.
- For scanning, filter by OI > 500 and bid/ask spread ≤ 10c to find tradeable markets quickly.

### 2026-04-04 — Third Cycle

**Portfolio status:** $19.58 cash, $10.42 deployed across 2 positions. Total bankroll $30.00.

**Position review:**
- **Bondi Apr 5 (KXBONDIOUT-26APR-APR05):** YES @ 82c × 10. Market still at 81-83c despite confirmed firing Apr 2. Closes tonight. Expected settlement: YES → +$1.80. HOLD.
- **Chavez-DeRemer May 1 (KXDEREMEROUT-26-MAY01):** YES @ 44c × 5. Market at 42-44c, roughly flat. WaPo Apr 3 confirms "vulnerable." IG investigation, aides forced out, Trump "pondering" changes. Estimate 55-60%. HOLD.

**Bondi market still hasn't settled despite early-close condition.** The Apr 5 market has an early_close_condition ("closes early if individual leaves role") and settlement_timer of 1800s, yet it's been 2 days since the firing. Kalshi settlement mechanics may be manual/delayed. Also: the longer-dated Bondi markets (Apr 9: 85-86c, Apr 16: 85-86c, May 1: 93-94c) all show similar discounts. This looks like systematic settlement lag, not genuine uncertainty.

**Cabinet departure pricing update:**
- Lutnick Commerce (16-17c): Vulnerable per WaPo, fallen out of favor with Susie Wiles. Epstein connection + COI. My estimate 20-25%. Edge ~5-8pp — PASS (below threshold).
- Kash Patel FBI (36-39c): "Active discussions" per Atlantic, multiple scandals, class action from fired agents. UP from 26.5% last cycle. My estimate 35-45%. Market roughly efficient now — PASS.
- Gabbard DNI (17-18c): Less concrete evidence. PASS.

**Key news this cycle:**
- Trump imposed 100% tariff on patented pharma products (120-180 day phase-in)
- 50% tariff on steel/aluminum/copper articles
- Supreme Court previously struck down IEEPA tariffs (Feb 2026), currently 10% blanket tariff in effect
- No pharma or CPI/inflation markets found on Kalshi to trade this angle

**No new trades this cycle.** Market scan yielded 26 markets but none with >10pp edge. The cabinet departure cluster remains the most interesting theme but prices have adjusted since Bondi's firing. Waiting for Bondi settlement and monitoring DeRemer/Lutnick news.

### 2026-04-04 — Fourth Cycle

**Portfolio status:** $12.79 cash, $17.21 deployed across 5 positions (max slots filled).

**New trades — Gas price markets (KXAAAGASW-26APR06):**
1. **Gas >$4.130 YES @ 42c × 2** — AAA national avg $4.104 on Apr 4, strong upward trend (+$0.128/week, +$0.013/day). Expected price Apr 6: $4.128-4.140. Market crashed from 66% to 42% after one slower day. My estimate 50-55%. Edge: ~10pp.
2. **Gas >$4.140 YES @ 18c × 4** — Higher-risk complement. At weekly drift rate, expected price right at boundary ($4.140). Market at 17%, my estimate 25%. Edge: 7pp (borderline but good ROI). If gas continues at weekly pace, both hit.

**Key thesis:** Gas prices surging due to tariffs — up $0.906 in one month, exceeding $4/gal nationally for first time in 4 years. The daily rate appears to be decelerating (from $0.030/day monthly avg to $0.018/day weekly avg to $0.013 yesterday). The market is pricing in deceleration; I think the weekly rate ($0.018/day) is more representative than a single slow day.

**Research findings — markets passed on:**
- **CPI March (KXCPIYOY-26MAR-T3.3):** Closes Apr 10. Market at 51% for >3.3%. Feb CPI was 2.4%; market pricing massive tariff shock to ~3.3%. Very liquid (76K OI, 1c spread). Don't have enough tariff-to-CPI modeling to have conviction against a liquid market. PASS.
- **Dallas temp <72°F (KXHIGHTDAL-26APR04-T72):** Market at 1% (crashed from 29%). NWS forecast said 71°F but market has real-time obs. Can't compete with locals tracking actual temperature. PASS.
- **NYC temp:** Similar to Dallas — market already priced. PASS.
- **DHS CBP Commissioner (KXCOMMISHCBP):** 0 open markets.

**Process lessons:**
- The `search` function only checks the first 200 events — most short-term markets (weather, CPI, gas) are in SERIES not events. To find them: query `/series` endpoint, filter by keyword, then query `/markets` per series.
- Gas price markets use AAA daily price on the specific date. Settlement source: gasprices.aaa.com.
- CPI markets reference BLS one-decimal-place value for 12-month YoY.
- Weather markets reference NWS Climatological Report (Daily), NOT AccuWeather or Google Weather.
- When a weather market crashes intraday, the market likely has real-time obs. Don't fade it unless you also have current obs.
- Gas price trends: use weekly average daily change, not just yesterday's change, for drift estimation.

### 2026-04-04 — Fifth Cycle

**Portfolio status:** $12.79 cash, $17.21 deployed across 5 positions (max slots). Unrealized P&L: -$0.59.

**Position review — all HOLD:**
- **Bondi Apr 5 YES @ 82c × 10:** Closes tonight. Fired Apr 2, confirmed by all outlets. Todd Blanche installed as acting AG. Market still at 81c — puzzling discount. Possible risk: Bondi said she'd "transition over the next month," so Kalshi might interpret she hasn't formally "left" yet. But rules say "removal" counts. Expecting YES settlement → +$1.80.
- **DeRemer May 1 YES @ 44c × 5:** Market at 43c. No firing yet. Trump "mulling" changes per NBC Apr 3. She's "vulnerable" per WaPo. IG probe ongoing. Thesis intact but no new hard evidence. HOLD.
- **Greenland NO @ 65c × 8:** Market at 64c. No developments. HOLD.
- **Gas $4.130 YES @ 42c × 2:** DOWN to 30c (-28.6%). AAA daily prices show deceleration: Apr 1 $4.06, Apr 2 $4.081, Apr 3 $4.091, Apr 4 $4.104. Daily increases: +$0.021, +$0.010, +$0.013. Need +$0.026 in 2 days — tight. Revised estimate: 35-40% (was 50-55%). Edge gone. But selling recovers only $0.60 vs $0.84 cost. Better to let expire and take the binary outcome.
- **Gas $4.140 YES @ 18c × 4:** DOWN to 15c (-16.7%). Need +$0.036 in 2 days. Revised estimate: 15-20%. No edge. Same logic — let expire.

**Key lesson: Gas price deceleration was real.** The market priced it correctly — the one-day slowdown I dismissed as noise was actually the start of a trend shift. Daily increases went from $0.021 → $0.010 → $0.013. The weekly average ($0.018/day) overestimated the forward rate. Lesson: when a trend decelerates, the market's reaction is usually right. Don't fade momentum shifts in commodity markets on a 2-day horizon.

**No new trades.** At max capacity (5/5 positions) with no compelling reason to exit and re-enter. Waiting for Bondi settlement to free a slot and capital.

### 2026-04-04 — Sixth Cycle (LIVE TRADING)

**Portfolio reset:** DB was cleared. Starting fresh with $15 bankroll, 0 positions. Previous paper trades lost ~$15 (gas price bets lost, other positions unclear).

**Trade executed:**
1. **KXBONDIOUT-APR09 YES @ 80c × 5** — LIVE order on Kalshi. Cost: $4.00 + $0.06 fees. Near-arbitrage: Bondi confirmed fired Apr 2 by every major outlet (CNN, NPR, WaPo, Fox, NBC, CBS). Todd Blanche serving as acting AG. Market at 80c = 20c discount on a resolved event. Expected profit: $0.94 if settled YES.

**Bondi cluster mispricing:** Apr 5 at 82-84c, Apr 9 at 79-80c, Apr 16 at 81-82c, May 1 at 89-90c. The Apr 9 market is CHEAPER than Apr 5 despite having 4 more days — pure microstructure inefficiency. Chose Apr 9 for best value. All should resolve YES identically.

**Markets passed on:**
- **DeRemer May 1 (42-44c):** Revised estimate down to 48-53%. She's survived 3+ months of scandal (IG probe since Jan, aides quit, drinking/affair allegations). Trump says "avoid massive shake-up." Edge 4-9pp — below threshold for soft evidence.
- **Lutnick May 1 (12-15c):** 20-25% estimate, edge 5-8pp. Below threshold.
- **Kash Patel May 1 (31-37c):** 6c spread, illiquid. Market roughly efficient.
- **Next AG (KXNEXTAG-29):** Zero liquidity across all candidates.
- **IPO markets:** All illiquid, wide spreads.
- **Supreme Court tariff (KXDJTVOSTARIFFS):** Already resolved NO (Feb 2026). SCOTUS struck down IEEPA tariffs.

**Process notes:**
- `search` function returns empty for many queries — it only matches event titles. For broader discovery, `quick` scan is more reliable.
- Most Kalshi markets outside the top 5-10 by volume have zero liquidity. The platform is dominated by a few active political/macro themes.
- DB was reset between sessions — trade history lost. Need to check if this is intentional or a bug.
- Live trading is now active. Fees are real ($0.06 on this trade = ~1.5% of cost).

### 2026-04-04 — User Rationale: Trump/Iran

**Thesis:** User asked about Trump's stance on Iran.

**Research findings:** US is in week 6 of active war with Iran ("Operation Epic Fury"). Timeline: nuclear talks in Oman collapsed late Feb → US/Israel strikes began Feb 28 → Trump addressed nation Apr 1 saying war "nearing completion" → threatened to destroy power plants/desalination by Apr 6 deadline if no deal. Iran denies any negotiations. This is the dominant geopolitical story globally.

**Market availability:** Kalshi has virtually nothing tradeable on Iran. Only a "Next Supreme Leader" market with zero volume. No war outcome, ceasefire, oil price, Strait of Hormuz, or sanctions markets exist on the platform.

**Lesson:** Kalshi's market coverage is extremely thin on geopolitical/war themes. The biggest story in the world has no tradeable market. The platform is dominated by US politics (cabinet departures), entertainment (Netflix), weather, and gas prices. For Iran-related trading, would need a different platform (Polymarket, Metaculus, etc.).
