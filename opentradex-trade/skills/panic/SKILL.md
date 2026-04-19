---
name: opentradex-panic
description: Emergency flatten — closes ALL open paper positions at their last mark and sets a 30-minute trading cooldown. Never auto-invoke. Only run when the user explicitly types "panic", "flatten", "close everything", or "stop".
allowed-tools: Bash(node *tradex.js panic:*), Bash(node *tradex.js positions:*), Bash(node *tradex.js risk:*)
disable-model-invocation: true
---

# OpenTradex — Panic Flatten

**This is a destructive, user-initiated action.** It closes every open paper position and sets a 30-minute cooldown on further entries.

## Flow

1. **Confirm explicitly.** Show open positions first:
   !`node "${CLAUDE_PLUGIN_ROOT}/bin/tradex.js" positions`
   Ask: "This will close ALL N positions and pause trading for 30 minutes. Confirm with `yes`."
2. Only if the user says `yes`, run the flatten:
   !`node "${CLAUDE_PLUGIN_ROOT}/bin/tradex.js" panic`
3. Show the post-flatten risk snapshot:
   !`node "${CLAUDE_PLUGIN_ROOT}/bin/tradex.js" risk`
4. End with: "Cooldown active. Use this time to step back. Return when you're clear-headed."

## Rules

- **Never invoke without explicit user instruction.** `disable-model-invocation: true` is set — this skill can only fire from a direct `/opentradex-trade:panic` call.
- Never re-enter positions during cooldown.
- If the user asks why a buy is blocked, point to `panicCooldown` in `node "${CLAUDE_PLUGIN_ROOT}/bin/tradex.js" risk`.
