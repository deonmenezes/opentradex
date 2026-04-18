---
name: panic-flatten
description: MANUAL-ONLY. Emergency-flatten every open OpenTradex position. Never auto-invoked. Only runs when the user explicitly types /opentradex:panic-flatten.
disable-model-invocation: true
allowed-tools: Bash(curl *), Bash(jq *)
---

# PANIC FLATTEN

This is the kill switch. It closes **every open position** in the OpenTradex harness immediately, regardless of mode.

## Confirmation required

Before you run the POST, ask the user one short confirmation in chat:

> ⚠️ PANIC will flatten **all open positions** at market. Type `yes flatten` to confirm.

Only proceed if their next message is literally `yes flatten` (case-insensitive).

## Execute

```bash
curl -s -X POST http://127.0.0.1:3210/api/panic --max-time 10 | jq .
```

## Report

- Number of positions closed.
- Total realized P&L from the flatten.
- Halted state after (the gateway enforces a 10-second cooldown).

## Why this exists

Every trader needs a single button they can hit when something's wrong — a stuck position, a news shock, a risk they didn't price in. This is that button. It is not a trading strategy.
