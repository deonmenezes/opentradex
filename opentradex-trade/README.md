# OpenTradex — Trading Plugin for Claude Code

Paper-trade across **Kalshi**, **Polymarket**, **Alpaca**, and **Coinbase** from any Claude Code session. Onboarding is just your API keys; Claude handles the rest — scanning, sizing, buying, closing, and post-trade review — in plain English.

> **Paper only.** v1 never places real orders. Keys are used for authenticated read-scans (better data, higher rate limits) and for shaping paper fills. Positions live in a local JSON ledger.

---

## Install

From a Claude Code session:

```
/plugin install opentradex-trade@deonmenezes/opentradex
```

Or clone this directory into `~/.claude/plugins/` manually.

## First run

```
/opentradex-trade:onboard
```

You'll be asked for each rail in turn — leave any blank to skip. Keys are stored at `~/.claude/opentradex/keys.json` (mode `0600`, parent `0700`).

## Skills

| Skill | What it does |
|-------|--------------|
| `/opentradex-trade:onboard` | One-time interactive key setup. Re-runnable. |
| `/opentradex-trade:scan [rail] [limit]` | Live market scan across enabled rails. |
| `/opentradex-trade:trade [question]` | Conversational copilot — scan + risk + suggestion loop. |
| `/opentradex-trade:buy <rail> <symbol> <qty> [price]` | Open a paper long. |
| `/opentradex-trade:sell <position-id> [price]` | Close a paper position. |
| `/opentradex-trade:positions` | List open book. |
| `/opentradex-trade:risk` | Daily P&L + exposure snapshot. |
| `/opentradex-trade:panic` | Emergency flatten all + 30-min cooldown. Manual only. |

## Agents

| Agent | Role |
|-------|------|
| `opentradex-scout` | Discovers candidate trades. Read-only. |
| `opentradex-risk-officer` | Pre-trade gate. Approves size or blocks with a reason. |
| `opentradex-coach` | Post-trade review. One pattern, one adjustment. |

## CLI

Every skill is a thin wrapper around `node bin/tradex.js <subcommand>` so you can also drive the plugin directly:

```bash
node bin/tradex.js help
node bin/tradex.js status
node bin/tradex.js scan coinbase 5
node bin/tradex.js buy coinbase BTC-USD 0.01 65000
node bin/tradex.js positions
node bin/tradex.js sell <position-id>
node bin/tradex.js risk
node bin/tradex.js panic
node bin/tradex.js keys               # redacted
node bin/tradex.js keys-delete alpaca
```

## Files on disk

| Path | Contents |
|------|----------|
| `~/.claude/opentradex/keys.json` | API credentials per rail. Permissions `0600`. |
| `~/.claude/opentradex/ledger.json` | Open positions, realized trades, panic cooldown timestamp. |

Delete either to reset that piece of state.

## Supported rails

| Rail | Asset class | Scan source | Paper order |
|------|-------------|-------------|-------------|
| `kalshi` | US prediction markets | `api.elections.kalshi.com` public | ✅ |
| `polymarket` | Global prediction markets | `gamma-api.polymarket.com` public | ✅ |
| `alpaca` | US equities | `data.alpaca.markets` snapshots | ✅ |
| `coinbase` | Spot crypto | `api.exchange.coinbase.com` ticker | ✅ |

## What this plugin **does not** do (v1)

- Place real money orders on any rail
- Short selling, margin, leverage, or options
- Live streaming / websocket fills
- A hosted dashboard or mobile UI
- Tax-lot accounting

## Safety

- `/opentradex-trade:panic` sets a 30-minute cooldown after flattening; buys are refused during that window.
- The risk officer agent blocks further entries when daily realized losses hit -$100 or open-position count hits 5.
- Every order is paper-marked (`paper: true`) in its fill response.

## License

MIT — see [LICENSE](./LICENSE).

## Author

Deon Menezes · [deonmenezes/opentradex](https://github.com/deonmenezes/opentradex)
