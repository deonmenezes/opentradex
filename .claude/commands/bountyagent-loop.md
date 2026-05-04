You are the LOOP orchestrator. You run `/bountyagent` repeatedly against the same target with explicit stop conditions, until the target finding count is reached or the time budget is exhausted. This is a mission loop — useful for long sessions where you want to keep exploring without manual re-invocation.

**Input:** `$ARGUMENTS` — `target_url [--findings N] [--budget-min M] [--max-iters K]`

Defaults if flags are omitted:
- `--findings 3` — stop when ≥ 3 SUBMIT-graded findings exist
- `--budget-min 240` — stop when 240 minutes have elapsed since loop start
- `--max-iters 5` — stop after 5 iterations regardless

## Hard rules

1. Every Agent tool call MUST use `mode: "bypassPermissions"`.
2. Each iteration uses **exactly the `/bountyagent` semantics**. Do not re-implement the FSM. The first iteration runs `/bountyagent [target_url]`. Subsequent iterations run `/bountyagent resume [domain]` and then transition into EXPLORE if the previous iteration ended at REPORT.
3. The orchestrator never calls `bounty_http_scan` or `curl` directly. All HTTP work happens inside agents spawned by the inner `/bountyagent` calls.
4. Stop conditions are checked **between iterations only**, never mid-FSM. Do not interrupt a running wave.
5. Persist loop state to `~/bounty-agent-sessions/[domain]/loop.json` so the loop can resume across `/clear` or context loss.

## loop.json shape

```json
{
  "version": 1,
  "target_domain": "[domain]",
  "started_at_iso": "<ISO-8601>",
  "budget_min": 240,
  "target_findings": 3,
  "max_iters": 5,
  "iters_done": 0,
  "iters": [
    {"n": 1, "started_iso": "...", "ended_iso": "...", "findings_submit": 1, "findings_total": 4, "verdict_summary": "..."}
  ],
  "stopped_reason": null
}
```

`stopped_reason` is one of: `"target_hit"`, `"budget_exhausted"`, `"max_iters"`, `"user_stop"`, `"no_more_surfaces"`.

## Loop algorithm

```
init: write loop.json with started_at_iso, budgets, iters_done=0
while True:
  read state (bounty_read_session_state) and grade verdict (bounty_read_grade_verdict if grade exists)
  submit_count = count(findings where grade == "SUBMIT")
  elapsed_min = (now - started_at_iso).minutes

  # check stop conditions
  if submit_count >= target_findings:
    write loop.json with stopped_reason="target_hit"; tell user; STOP
  if elapsed_min >= budget_min:
    write loop.json with stopped_reason="budget_exhausted"; tell user; STOP
  if iters_done >= max_iters:
    write loop.json with stopped_reason="max_iters"; tell user; STOP

  # run one iteration
  iters_done += 1
  if iters_done == 1:
    run /bountyagent [target_url] semantics inline (do not call /bountyagent — inline the FSM by deferring to its spawn shapes)
  else:
    run /bountyagent resume [domain] semantics; if FSM is at REPORT, transition to EXPLORE and run one more wave + chain + verify + grade + report

  append iter summary to loop.json
```

## Inlining `/bountyagent`

You **must** behave exactly as `/bountyagent` does — same phase ordering, same MCP tool calls, same launch-turn barrier, same resume rules. Do not duplicate the prompt; instead, read `.claude/commands/bountyagent.md` mentally and apply its rules. The only differences in loop mode are:

1. After REPORT completes, instead of stopping, you check the loop conditions and either start a new iteration via EXPLORE or stop with a reason.
2. Between iterations, you write a summary line to `loop.json`.
3. You **never** auto-disclose. PATCH and DISCLOSE are out of scope for loop mode — that is `/bountyagent-fullsend` territory.

## EXPLORE-driven iterations

After iteration 1, the FSM ends at REPORT. To start iteration 2, transition to EXPLORE per `/bountyagent` PHASE 8 rules:
1. `bounty_transition_phase({ target_domain, to_phase: "EXPLORE" })`
2. Read `attack_surface.json` and `bounty_read_state_summary` to find untested or partially-tested surfaces.
3. If no fresh surfaces remain, stop with `stopped_reason="no_more_surfaces"`.
4. Otherwise launch one new HUNT wave on the fresh surfaces, then run CHAIN → VERIFY → GRADE → REPORT.
5. After this REPORT, the loop check fires again at the top.

## Time-budget semantics

Time budget is **wall-clock from loop start**, not cumulative inside-the-FSM time. Background hunters that take 20 minutes count toward the budget the same way as orchestrator turns. The budget can be longer than a single Claude Code session — if context runs out, the user re-invokes `/bountyagent-loop resume [domain]` and the loop reads `loop.json` to continue.

## Output discipline

After each iteration, output exactly one line:
```
[loop] iter N/K finished — submit:S total:T elapsed:Em — continuing
```
or
```
[loop] iter N/K finished — submit:S total:T elapsed:Em — STOPPED reason=R
```

Do not narrate the inner FSM here — `/bountyagent` already produces phase-by-phase output. The loop only adds bookend lines.

## What this mode does NOT do

- Does not run wider waves than `/bountyagent`. Use `/bountyagent-ultra` if you want wide.
- Does not auto-disclose, send emails, or write patches.
- Does not change recon, verify, grade, or report agent prompts.
- Does not interrupt a running wave to check budgets — checks happen between iterations only.
- Does not attempt to recover a corrupted session — if `bounty_read_session_state` errors, write `stopped_reason="user_stop"` and tell the user to investigate manually.

## Why this exists

Bounty hunting is a long-tail process. The first run finds easy wins; iterations 2–5 find the rare bugs that pay the most. Manual re-invocation between runs wastes operator time and breaks momentum. The loop closes that gap with explicit budgets so it never runs away.
