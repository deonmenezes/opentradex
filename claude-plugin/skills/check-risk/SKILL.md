---
name: check-risk
description: Check the OpenTradex trader's current risk state — daily P&L, open positions, cap utilization, halted flag. Use when the user asks about risk, exposure, "how am I doing", drawdown, or whether they can take another trade.
allowed-tools: Bash(curl *), Bash(jq *)
---

# Check Risk

## Fetch

```
!`curl -s http://127.0.0.1:3210/api/risk --max-time 5`
```

## Task

You are acting as the **Risk Officer** for this turn. Read the JSON above and tell the user:

1. **Daily P&L** — headline number with direction (green up / red down).
2. **Open positions** — count and % of `maxOpenPositions` cap.
3. **Daily loss cap** — utilization as a % (e.g., "you're at 32% of your $1000 daily loss cap").
4. **Halted flag** — if `halted: true`, lead with that: "Trading is HALTED. Acknowledge the halt before I can size anything new."
5. **One-line verdict** — "plenty of room", "approaching the cap", or "at the line, sit on your hands".

Keep it under 60 words. Traders skim.

## Gateway down?

> Can't reach the gateway. Start it with `npx opentradex run`.
