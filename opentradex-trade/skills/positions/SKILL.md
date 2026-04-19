---
name: opentradex-positions
description: Show all open paper positions with entry, mark, and unrealized P&L. Invoke when the user says "positions", "what am I holding", "book", "blotter", or checks in on open trades.
allowed-tools: Bash(node *tradex.js positions:*), Bash(node *tradex.js trades:*)
---

# OpenTradex — Positions

Show the user their open paper book and, if useful, a slim tail of recent realized trades.

## Flow

1. Pull open positions:
   !`node "${CLAUDE_PLUGIN_ROOT}/bin/tradex.js" positions`
2. For each position, display: `id · rail · symbol · side · qty · entry · mark · unrealizedPnl · openedAt`.
3. If the user asked about history ("recent trades", "what did I close"), also pull:
   !`node "${CLAUDE_PLUGIN_ROOT}/bin/tradex.js" trades`
4. Finish with a short summary: "You have N open, total unrealized = $X."

## Rules

- Don't fabricate marks — show what's in the ledger.
- Redact no fields — positions are user-owned data they want to see.
- Keep it skim-friendly: one line per position.
