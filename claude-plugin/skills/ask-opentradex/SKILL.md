---
name: ask-opentradex
description: Route a freeform trading question through the OpenTradex AI (/api/command). Use when the user explicitly wants the OpenTradex copilot to answer (not Claude itself) — so they get the persona, memory, and role-based reasoning from the harness.
argument-hint: <question in quotes>
allowed-tools: Bash(curl *), Bash(jq *)
---

# Ask OpenTradex

## Send

```bash
curl -s -X POST http://127.0.0.1:3210/api/command \
  -H "Content-Type: application/json" \
  -d "{\"command\":\"$ARGUMENTS\"}" \
  --max-time 60 | jq -r '.response // .error'
```

## Task

Show the `response` field from the gateway verbatim — this is OpenTradex's own answer, shaped by its soul/agents/skills persona and the user's saved memory. Do not rewrite, condense, or second-guess it.

If the gateway returns a timeout or error, show that cleanly and suggest:
- Check that the gateway is running: `/opentradex:gateway-status`
- Check AI provider is configured: `npx opentradex onboard`

## Why use this instead of just chatting with Claude?

- OpenTradex has **persistent memory** of the user's prefs across sessions.
- It enforces **Risk Officer** guardrails before recommending trades.
- It ties answers to **live market data** from the enabled rails.
