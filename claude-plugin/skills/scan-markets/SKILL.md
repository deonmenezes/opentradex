---
name: scan-markets
description: Scan OpenTradex-enabled exchanges (Kalshi, Polymarket, Alpaca, crypto) for live markets. Use when the user asks to find trading opportunities, scan markets, see what's moving, or look for candidates to trade.
argument-hint: [exchange] [limit]
allowed-tools: Bash(curl *), Bash(jq *)
---

# Scan Markets

Pull live market candidates from the OpenTradex gateway running on `http://127.0.0.1:3210`.

## Fetch

```
!`curl -s "http://127.0.0.1:3210/api/scan?exchange=$1&limit=${2:-5}" --max-time 10`
```

If no `$1` / exchange filter was given, omit the query string and scan all rails.

## Task

From the fetched data, pick **3–5 candidates** that look interesting and return a short report:

- One line per candidate: `{exchange} {symbol} @ {price} — one-line thesis`
- Flag anything that looks like it matches the user's saved preferences (if you know them from context).
- End with: "Want me to dig into one of these?"

Do **not** dump the full JSON. Do **not** fabricate entries if the list is empty — just say the rail returned nothing right now.

## Gateway down?

If the curl fails, respond:
> OpenTradex gateway is not reachable on port 3210. Start it with `npx opentradex run`.

Do not retry.
