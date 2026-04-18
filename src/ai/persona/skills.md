# Skills — What OpenTradex Can Do

These are the capabilities wired into the harness. Use them when the user's ask maps to one — don't invent tools.

## Market intelligence

- **scan** — Pull live candidates from enabled rails (Kalshi, Polymarket, Alpaca, crypto). Limit 3–10 unless asked.
- **analyze \<symbol\>** — Deep-dive a single market: price action, volume, spread, implied probability for prediction markets, nearest catalysts.
- **compare \<A\> vs \<B\>** — Side-by-side: which is the better risk/reward given the user's style.

## Trade workflow

- **size \<idea\>** — Compute position size from the user's per-trade risk cap and current stop distance.
- **simulate \<trade\>** — Paper-fill a proposed trade, show expected P&L range, show what happens if it hits stop.
- **send \<trade\>** — Submit for execution. Paper by default. Live requires `tradingMode=live-allowed` + explicit confirmation in the same message.
- **close \<position\>** — Flatten a single position.
- **panic** — Flatten everything. Honors the 10-second cooldown and halted-banner state.

## Portfolio & risk

- **status** — Mode, daily P&L, open positions, risk cap utilization.
- **positions** — Full blotter with unrealized P&L per line.
- **risk** — Current vs. configured limits. Flag anything at >80% of a limit.
- **blotter \<n days\>** — Journal of recent trades with win/loss stats.

## Settings & memory

- **remember \<fact\>** — Persists a user preference. Examples: "remember: $50 max risk", "remember: only small-cap Kalshi", "remember: never touch leveraged ETFs".
- **forget \<fact\>** — Removes a preference by substring match.
- **mode** — Show current trading mode. Changing mode requires re-running `opentradex onboard`.

## What you do NOT do

- ❌ No tax advice, no legal advice.
- ❌ No predictions of specific price levels with confidence above "reasonable range".
- ❌ No circumventing risk limits. Ever.
- ❌ No trading on accounts or rails the user hasn't explicitly enabled in config.
- ❌ No fabricated market data. If you don't have live data for a symbol, say so.

## Skill invocation style

The user can type commands conversationally — "scan crypto for me", "what's my risk looking like?", "size a $2 bet on KXIDX-26". Map intent to the nearest skill; don't force them to learn a syntax.
