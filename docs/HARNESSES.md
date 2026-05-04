# Harnesses & speed modes

The standard `/bountyagent` runs a single, careful pass through the 7-phase FSM. That's the right default for most targets.

When you need different tradeoffs — cheaper triage, wall-clock priority, autonomous long-running missions — use one of the harness commands below. Each harness is built on top of `/bountyagent`'s phase semantics. They do not re-implement the FSM; they change the dispatch policy around it.

## Mode at a glance

| Mode | Use when | Cost vs std | Wall clock | Pipeline depth |
|---|---|---|---|---|
| `/bountyagent-fast` | Pre-screening unknown targets | ~10–15% | ~10 min | recon → triage → 1 hunter wave → brutalist → grade |
| `/bountyagent` (standard) | Default — balanced quality and cost | 100% | 30–60 min | full 7-phase FSM |
| `/bountyagent-ultra` | High-value targets, deadline pressure | ~200–300% | similar | full FSM with 3× wider waves + parallel verifiers |
| `/bountyagent-loop` | Long missions, find rare bugs | varies (budgeted) | up to N hours | repeated full FSM via EXPLORE iterations |
| `/bountyagent-fullsend` | After a real find — auto-disclose | ~110% | adds 5–10 min | adds PATCH + DISCLOSE phases |
| `/bountyplan` | Pre-HUNT sanity check | <1% | ~1–2 min | reads recon, writes plan.md, no HTTP |

## When to use which

### `/bountyagent-fast` — triage screen
You don't yet know if this target is worth a full run. Run fast first; only escalate to standard or ultra if fast finds something interesting.

```
/bountyagent-fast https://example.com
```

Outputs: a recommendation of **PROMOTE** or **SKIP**.

### `/bountyagent` — standard
The default. Use this when the target is in your wheelhouse and you want a complete, submission-ready report.

```
/bountyagent https://example.com
```

### `/bountyagent-ultra` — wall-clock priority
A high-value target with a known scope, where time-to-finding matters more than token cost. Wider waves, parallel verifier dispatch, deeper grading.

```
/bountyagent-ultra https://example.com
```

Cost runs ~2–3× a standard run. Reserve for cases where a fast finding has measurable value (deadlines, competitive pressure, known program with quick-pay).

### `/bountyagent-loop` — long mission
Iterate against a single target across multiple EXPLORE waves until you hit a finding count or a time budget. Useful when you want to keep digging without manual re-invocation.

```
/bountyagent-loop https://example.com --findings 3 --budget-min 240 --max-iters 5
```

State is persisted to `~/bounty-agent-sessions/[domain]/loop.json` so the loop survives `/clear` and context loss. Stop conditions are checked between iterations only.

### `/bountyagent-fullsend` — auto-disclose
Already in the repo. Runs the full FSM, then auto-emails the verified security contact (security.txt only). Skip if the target uses HackerOne / Bugcrowd / Intigriti / Immunefi — submit through the platform instead.

```
/bountyagent-fullsend https://example.com
```

### `/bountyplan` — planning gate
A read-only planning pass between recon and HUNT. Forces you to write a hunting plan before committing Opus tokens to a wave. Useful for new operators or unfamiliar targets.

```
# After /bountyagent has produced recon (interrupt before HUNT)
/bountyplan https://example.com
# Read plan.md, then resume:
/bountyagent resume example.com
```

## Components added by the harness layer

### Triage agent (Haiku)
`.claude/agents/triage-agent.md` — runs after recon, scores surfaces into `promote` / `defer` / `kill` lists, writes `triage.json`. Used implicitly by `/bountyagent-fast`, `/bountyagent-ultra`, and `/bountyplan`. Cost is ~$0.005 per surface vs ~$0.50–$2 per surface in a hunter wave.

### Loop state (`loop.json`)
`/bountyagent-loop` writes per-iteration summaries here. Survives session restarts. The HUD reads it for the budget bar.

### Worktree helper
`scripts/bounty-worktree.sh <target>` creates an isolated git worktree per target, with its own `.mcp.json` pointing at a per-worktree MCP server process. Lets you run multiple targets concurrently in separate Claude Code sessions without state collision.

```
./scripts/bounty-worktree.sh example.com
cd ~/bug-bounty-worktrees/example.com
claude
/bountyagent https://example.com
```

Run a second one in another terminal:
```
./scripts/bounty-worktree.sh other-target.com
cd ~/bug-bounty-worktrees/other-target.com
claude
/bountyagent https://other-target.com
```

Each session has its own MCP server PID, its own session dir, and its own branch — no shared state.

### Richer HUD
`.claude/hooks/bounty-statusline.js` now shows:
- phase + wave (existing)
- `Δp/d/k` triage scoring (new)
- `N%cov` wave coverage (new)
- `Nf` finding count (existing)
- `N.N/hr` finding rate (new)
- `🔁 N/K P%` loop iteration + budget burn (new)
- model, dir, context bar, rate-limit warning (existing)

Coverage is computed from `attack_surface.json` + `state.explored`. Rate is findings per hour since session start. Loop pct is wall-clock vs `loop.json.budget_min`.

## What the harness layer does NOT change

- The 7-phase FSM. Phase order is unchanged in every mode.
- The MCP control plane. Same tools, same JSON artifacts.
- The 3-round verification design. Final round still runs in series; only rounds 1 and 2 fan out in `/bountyagent-ultra`.
- Scope guards. `scope-guard.sh` still blocks out-of-scope Bash; `scope-guard-mcp.sh` still blocks out-of-scope MCP scans.
- The grading rubric or report format.

The harnesses are **orchestration policy**, not pipeline design. The pipeline stays the same; only how aggressively it dispatches changes.

## Decision tree

```
Unknown target, want to triage cheap?      → /bountyagent-fast
Standard target, balanced default?          → /bountyagent
High-value, deadline pressure?              → /bountyagent-ultra
Long mission, want to keep digging?         → /bountyagent-loop
Already found something, want to disclose?  → /bountyagent-fullsend
New operator, want a written plan first?    → /bountyplan + /bountyagent resume
Multiple targets at once?                   → ./scripts/bounty-worktree.sh <each>
```

## Cost knobs (rough order of magnitude)

These numbers assume Sonnet at $3/$15 per million in/out and Opus at $15/$75 per million.

| Phase | Std cost | Ultra cost | Fast cost |
|---|---|---|---|
| Recon | ~$0.20 | ~$0.20 | ~$0.20 |
| Triage | — | ~$0.05 | ~$0.05 |
| HUNT (per wave) | ~$2–8 (3 hunters) | ~$6–24 (9–12 hunters) | ~$2–8 (≤4 hunters, 1 wave only) |
| HUNT total (all waves) | ~$6–25 | ~$24–120 | ~$2–8 |
| CHAIN | ~$1–3 | ~$1–3 | skipped |
| VERIFY (3 rounds) | ~$3–8 | ~$5–14 (parallel) | ~$1–2 (round 1 only) |
| GRADE | ~$0.30 | ~$0.30 | ~$0.30 |
| REPORT | ~$0.50 | ~$0.50 | skipped |
| **Total typical** | **~$10–40** | **~$30–140** | **~$3–10** |

Loop mode multiplies whichever inner mode it runs (defaults to standard) by `iters_done`.

Use these as a starting expectation, not a guarantee. Real costs depend on target complexity, scope size, and how many findings survive each verification round.
