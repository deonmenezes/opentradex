# OpenTradex — Claude Code Plugin

Talk to your local **OpenTradex** trading gateway (paper-first, multi-rail — Kalshi, Polymarket, Alpaca, crypto) directly from a Claude Code session.

Once installed, you can just say things like "scan crypto for me" or "what's my risk looking like?" and Claude will hit the gateway on `http://127.0.0.1:3210` and answer with live data.

---

## Install

### Prerequisites

1. OpenTradex harness installed and onboarded:
   ```bash
   npx opentradex onboard --paper-only
   ```
2. Gateway running in another terminal:
   ```bash
   npx opentradex run
   ```
3. Claude Code (the CLI) installed.

### Option A — Local development

```bash
# From inside the opentradex repo
claude --plugin-dir ./claude-plugin
```

### Option B — Git install

Add to your project's `.claude/settings.json`:

```json
{
  "enabledPlugins": {
    "opentradex": {
      "source": {
        "source": "git",
        "url": "https://github.com/deonmenezes/opentradex.git",
        "path": "claude-plugin"
      }
    }
  }
}
```

### Verify

In Claude Code, run:
```
/opentradex:gateway-status
```

You should see your gateway's mode + enabled exchanges.

---

## What you get

### Slash commands (skills)

| Command | Purpose | Auto-invoke? |
|---|---|---|
| `/opentradex:scan-markets [exchange] [limit]` | Scan live candidates | ✓ |
| `/opentradex:check-risk` | Daily P&L, caps, halted flag | ✓ |
| `/opentradex:show-positions` | Blotter with unrealized P&L | ✓ |
| `/opentradex:gateway-status` | Is the gateway up? Which mode? | ✓ |
| `/opentradex:ask-opentradex "<question>"` | Route through the OpenTradex copilot AI | ✓ |
| `/opentradex:panic-flatten` | Emergency kill switch | ✗ manual only |

Auto-invoke means Claude will pick up the skill when your message matches. Manual-only skills only run when you type the slash command explicitly.

### Subagents

| Agent | Role |
|---|---|
| `scout` | Pull 3–5 market candidates that fit your style |
| `risk-officer` | Gatekeep trade size against configured caps |
| `coach` | Post-trade review — spot patterns, praise, flag |

Claude can spawn these for specialized work — e.g. "have Scout pull today's prediction-market setups".

### Hooks

A `SessionStart` hook pings `http://127.0.0.1:3210` and tells you whether the gateway is up. No other hooks — the plugin stays out of your way.

---

## Safety

- **Paper-first.** If your gateway is in `paper-only` or `paper-default` mode, nothing you do from this plugin can fire a live trade.
- **Panic is manual.** `panic-flatten` has `disable-model-invocation: true` — Claude cannot call it on its own. You must type the command.
- **Risk Officer veto is final.** Any trade that breaches your configured caps is rejected with a one-line reason, no soft "consider reducing".
- **Live mode requires a 24-hour mode-lock.** Flip with `npx opentradex onboard`. This plugin cannot bypass that.

---

## Customizing the persona

The harness reads `src/ai/persona/*.md` at boot for its soul, agents, skills, and heartbeat behavior. You can override any of those by dropping your own copies into:

```
~/.opentradex/persona/
  soul.md
  agents.md
  skills.md
  cron.md
```

The plugin's own skills and agents are independent of that override — they live inside this `claude-plugin/` folder.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Gateway not reachable on port 3210` | `npx opentradex run` in another terminal |
| Slash commands don't appear | Run `/plugins` in Claude Code; enable `opentradex` |
| `AI not configured` in `/ask-opentradex` response | `npx opentradex onboard` and add at least one AI provider key |
| Commands hang for 7+ seconds | Known Claude CLI cold-spawn latency on Windows; Anthropic or OpenAI keys are faster than the `claude-cli` provider |

---

## License

MIT. Same as the harness.
