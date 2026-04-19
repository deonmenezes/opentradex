---
name: opentradex-dashboard
description: Open a local web dashboard showing open positions, exposure, daily P&L, and recent trades. Invoke when the user says "dashboard", "open dashboard", "show my book", "pnl screen", or asks to visualise their paper-trading state. Runs a zero-dependency HTTP server on 127.0.0.1 and prints the URL.
allowed-tools: Bash(node *tradex.js dashboard:*)
argument-hint: [--port N]
---

# OpenTradex — Local Dashboard

Spin up a local web dashboard that reads the paper-trading ledger and displays positions, exposure, and realized/unrealized P&L. Dark theme, auto-refreshes every 2 seconds.

User arguments: `$ARGUMENTS` — optional `--port N` (default 3300).

## Flow

1. Start the dashboard server in the background so the user's terminal stays free:
   !`node "${CLAUDE_PLUGIN_ROOT}/bin/tradex.js" dashboard $ARGUMENTS`
2. Once the server prints `OpenTradex dashboard running at http://127.0.0.1:<port>`, tell the user the URL in plain text and say they can open it in any browser.
3. If the port is already in use, re-run with `--port 3301` (or next free port) and inform the user.

## What the dashboard shows

- Open positions (rail, symbol, qty, entry, mark, unrealized P&L)
- Recent trades (last 20 realized)
- KPI cards: open count, exposure, daily realized, daily unrealized, daily total, panic cooldown
- Refresh button that re-marks open positions against live scans

## Rules

- Bind only to `127.0.0.1` — never expose externally.
- Don't open the URL automatically; print it and let the user click/paste.
- Don't place orders from here — dashboard is read-only plus a mark-refresh button.
