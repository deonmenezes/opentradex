# Cron — Heartbeat & Scheduled Tasks

OpenTradex runs a lightweight heartbeat loop in the background. Each tick is cheap; the AI is only called when a trigger fires, not on every tick.

## Heartbeat cadence

| Interval | Task | Role |
|---|---|---|
| **15s** | Market pulse: refresh spot prices for held positions. Compute unrealized P&L delta. | Watchdog |
| **60s** | Risk sweep: check open positions vs. stop levels. If any position is within 5% of stop, flag. | Risk Officer |
| **5m** | Scanner sweep: look for new candidates matching the user's saved style. Surface at most 1 new idea per sweep. | Scout |
| **15m** | News check: scan RSS feeds for headlines tied to held tickers. | Watchdog |
| **1h** | Portfolio snapshot: cumulative P&L, best/worst position, win rate today. | Coach |
| **Daily 16:00 local** | End-of-day coach note: 3-line journal of the day. Saved to blotter. | Coach |
| **On mode change** | Re-assert guardrails. If flipping to live, require confirmation. | Risk Officer |

## Trigger thresholds (when heartbeat speaks up)

- **Position down > 5% from entry** → Watchdog pings: "KXIDX-26 is down 6% from your entry at $0.42. Stop was at $0.38. Holding?"
- **Daily P&L hits -50% of daily loss cap** → Risk Officer warns: "You're at $500 down vs. $1000 daily cap. One more losing trade triggers halt."
- **Daily P&L hits -100% of cap** → Risk Officer halts trading, sets `halted` flag, requires user ack to resume.
- **New candidate matches saved style** → Scout surfaces once per 5-minute window, max 3 per day unless user asks for more.
- **Held ticker in a news headline** → Watchdog pings with the headline + its read on whether it's noise or material.

## Silence rules

The heartbeat should **almost always be silent**. A good heartbeat is one the user forgets is running. Only break silence when:
1. A threshold above is crossed.
2. The user explicitly asks "any updates?" or "what's moving?".
3. A saved alert fires (e.g., "tell me if BTC crosses 70k").

## Implementation note

Heartbeat runs in-process inside the gateway. It uses the same AI instance but with `includeContext=true` and a `role: 'speed'` preference to keep costs down. Heartbeat output gets prefixed `[Heartbeat]` in the event stream so the dashboard can render it differently.

## User controls

- `heartbeat pause` — stops all scheduled checks until resumed.
- `heartbeat resume` — restarts.
- `heartbeat status` — shows last-run timestamp per task.
- `heartbeat silence <task>` — mute a specific role (e.g., `silence scout` if the user doesn't want new candidates surfaced).
