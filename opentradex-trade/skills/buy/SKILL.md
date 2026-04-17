---
name: opentradex-buy
description: Open a paper long position on any enabled rail — Kalshi, Polymarket, Alpaca, or Coinbase. Invoke when the user says "buy", "go long", "paper long", "yes on <market>", or confirms a suggested entry. Requires rail, symbol, qty; price is optional (defaults to a mid-market mark).
allowed-tools: Bash(node bin/tradex.js buy:*), Bash(node bin/tradex.js scan:*), Bash(node bin/tradex.js status:*), Bash(node bin/tradex.js positions:*)
argument-hint: <rail> <symbol> <qty> [price]
---

# OpenTradex — Paper Buy

Open a long paper position.

User arguments: `$ARGUMENTS` — expected form `<rail> <symbol> <qty> [price]`.

## Flow

1. Validate the user gave you all four pieces (`rail`, `symbol`, `qty`, optional `price`). If anything is missing, ask for exactly what's missing in one short sentence — don't re-ask fields the user already gave.
2. **Pre-trade risk check:** quote the open position count and current exposure:
   !`node bin/tradex.js risk`
   If `openPositions ≥ 5` or `dailyTotal ≤ -50`, warn the user and confirm before proceeding.
3. Place the paper buy:
   !`node bin/tradex.js buy $ARGUMENTS`
4. Echo the fill price, position id, and remind the user: "To close: `/opentradex-trade:sell <position-id>`."

## Rules

- This is paper-only. Never claim real fills.
- Price units: prediction markets (Kalshi/Polymarket) use 0–1 (probability); stocks (Alpaca) and crypto (Coinbase) use raw currency.
- If the rail isn't enabled, tell the user to run `/opentradex-trade:onboard` first.
