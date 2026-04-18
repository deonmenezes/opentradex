---
name: gateway-status
description: Check whether the OpenTradex gateway is running and what mode it's in (paper-only / paper-default / live-allowed). Use when the user asks if the gateway is up, what mode it's in, which exchanges are live, or to troubleshoot a connection.
allowed-tools: Bash(curl *), Bash(jq *)
---

# Gateway Status

## Fetch

```
!`curl -s http://127.0.0.1:3210/api/ --max-time 3`
```

## Task

Report:

1. **Status** — up or down.
2. **Mode** — `paper-only`, `paper-default`, or `live-allowed`. If `live-allowed`, add the warning: "LIVE MONEY — confirmations will be required on every execute."
3. **Badge** (`PAPER ONLY` / `PAPER DEFAULT` / `LIVE ALLOWED`).
4. **Exchanges** — which rails are enabled.
5. **Halted?** — lead with this if `risk.halted: true`.

Keep it to one short block. No fluff.

## Gateway down?

> Gateway not running on port 3210. Start it with `npx opentradex run`.
> If you haven't onboarded yet: `npx opentradex onboard --paper-only`.
