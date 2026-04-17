---
name: opentradex-risk
description: Summarize today's risk — open positions, total exposure, daily realized/unrealized P&L, and panic-cooldown status. Invoke when the user says "risk", "how am I doing today", "P&L", "daily", "blotter", or checks before a new entry.
allowed-tools: Bash(node bin/tradex.js risk:*), Bash(node bin/tradex.js positions:*)
---

# OpenTradex — Risk Snapshot

Quick daily risk read.

## Flow

1. Run the risk snapshot:
   !`node bin/tradex.js risk`
2. If `panicCooldown > Date.now()`, tell the user trading is paused until cooldown expires and show the expiry.
3. If `dailyTotal <= -100`, warn the user they're near a self-imposed daily loss limit; suggest they pause or reduce size.
4. Format the output as:
   ```
   Open: N positions · exposure $X
   Today: realized $X · unrealized $X · total $X
   ```

## Rules

- Don't give financial advice. Report numbers and flag risk thresholds.
- Never invent numbers — only echo what the ledger returns.
