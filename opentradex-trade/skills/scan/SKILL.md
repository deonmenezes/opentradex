---
name: opentradex-scan
description: Scan live markets across enabled rails — Kalshi, Polymarket, Alpaca, Coinbase — and return a ranked list the user can pick from. Use whenever the user asks "what's trading", "what markets are hot", "scan crypto", "show me prediction markets", or any exploration request before a trade.
allowed-tools: Bash(node bin/tradex.js scan:*), Bash(node bin/tradex.js status:*)
argument-hint: [rail] [limit]
---

# OpenTradex — Scan Markets

Scan live markets and present the results in a short, skim-friendly table so the user can pick a candidate.

User arguments: `$ARGUMENTS`
(Optional `rail` filter: one of `kalshi | polymarket | alpaca | coinbase`. Optional `limit`, default 10.)

## Flow

1. **Live scan:** run the scanner with the user's rail/limit filter:
   !`node bin/tradex.js scan $ARGUMENTS`
2. Parse the JSON output. For each market, show: rail, symbol, title (if present), bid/ask (or yesBid/yesAsk for binary markets), volume.
3. If the user is new (no rails enabled), call:
   !`node bin/tradex.js status`
   and tell them to run `/opentradex-trade:onboard` first.
4. End with a one-line nudge: "Want to paper-buy one? Reply with the rail + symbol + qty and I'll size it."

## Rules

- Never place orders from this skill. This is read-only.
- Keep output tight — 10 rows max unless the user asks for more.
- If `error` appears on a rail row, show the error briefly and skip; never fabricate prices.
