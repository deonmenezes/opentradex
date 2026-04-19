---
name: opentradex-onboard
description: One-time interactive setup that stores API keys for Kalshi, Polymarket, Alpaca, and Coinbase so OpenTradex can scan markets and paper-trade. Invoke this the very first time a user says "set up OpenTradex", "add my keys", or "start trading". Safe to re-run to add or update a rail.
allowed-tools: Bash(node *tradex.js onboard:*), Bash(node *tradex.js keys:*), Bash(node *tradex.js status:*)
disable-model-invocation: true
---

# OpenTradex — Onboarding

You are onboarding a new user to the OpenTradex paper-trading plugin.

**Collect API keys only.** v1 of this plugin is paper-only — the keys are used for authenticated read-scans (higher rate limits, better data) and are persisted locally at `~/.claude/opentradex/keys.json` with `0600` permissions. No live orders are placed.

## Flow

1. Greet the user and explain what's about to happen:
   > "I'll ask for your API keys for each exchange. Leave any rail blank to skip it — you can add it later. Keys never leave your machine."
2. Run the interactive onboarder:
   ```
   node "${CLAUDE_PLUGIN_ROOT}/bin/tradex.js" onboard
   ```
   This will prompt for each rail in turn: Kalshi, Polymarket, Alpaca (key + secret), Coinbase (key + secret).
3. After onboarding completes, confirm which rails are active:
   ```
   node "${CLAUDE_PLUGIN_ROOT}/bin/tradex.js" status
   ```
4. Show the redacted key list so the user sees what's saved:
   ```
   node "${CLAUDE_PLUGIN_ROOT}/bin/tradex.js" keys
   ```

## Guidance

- Tell the user where keys are stored: `~/.claude/opentradex/keys.json`.
- Remind them this is **paper-only** — no real money moves.
- If they want to remove a rail later: `node "${CLAUDE_PLUGIN_ROOT}/bin/tradex.js" keys-delete <rail>`.
- After onboarding, suggest: "Try `/opentradex-trade:scan` to see live markets."
