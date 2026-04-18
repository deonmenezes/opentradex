---
name: show-positions
description: Show the OpenTradex user's open positions with unrealized P&L. Use when the user asks about positions, the blotter, what they're holding, or P&L on a specific ticker.
allowed-tools: Bash(curl *), Bash(jq *)
---

# Show Positions

## Fetch

```
!`curl -s http://127.0.0.1:3210/api/positions --max-time 5`
```

## Task

From the positions list above, format a clean blotter:

| Exchange | Symbol | Side | Size | Entry | Mark | P&L | % |
|---|---|---|---|---|---|---|---|

- Round prices to cents, P&L to whole dollars.
- Highlight any position **within 5% of its stop** (if `stop` field is present): prefix with ⚠.
- Highlight any position **up >10% from entry** with a ✓.
- If zero positions: say so in one line — don't draw an empty table.

End with a one-line summary: "`{N} open, total unrealized $X`".

## Gateway down?

> Gateway not reachable on port 3210. Start it with `npx opentradex run`.
