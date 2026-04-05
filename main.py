"""
Open Trademaxxxing - agent orchestrator.

Spawns Claude Code as a subprocess. The agent reads SOUL.md for personality,
uses tools directly (web search, Apify, Kalshi API), and persists state to SQLite.

Usage:
    python3 main.py                         # single research + trade cycle
    python3 main.py --loop                  # continuous loop
    python3 main.py --loop --interval 300   # 5 min interval
    python3 main.py --rationale "I think tariffs will escalate next week"
    python3 main.py --prompt "check my positions and update strategy notes"
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

PROJECT_DIR = Path(__file__).resolve().parent
DATA_DIR = PROJECT_DIR / "data"
SESSION_FILE = DATA_DIR / "session_id.txt"

# The agent prompt: agentic, not scripted. Agent uses its own tools.
CYCLE_PROMPT = """Read SOUL.md for your identity and strategy principles.
Read data/strategy_notes.md for lessons from past sessions.
Check data/user_rationales.json for any pending user theses to research.

Then run a full trading cycle:

1. AUTO-SETTLE resolved markets first:
   `PYTHONPATH=. python3 gossip/trader.py check-settled`
   This checks Kalshi for any markets that have resolved and auto-settles them, returning capital to bankroll.

2. Check portfolio and live prices:
   `PYTHONPATH=. python3 gossip/trader.py portfolio`
   `PYTHONPATH=. python3 gossip/trader.py prices`
   Review each open position's unrealized P&L and current market price vs your entry.

3. POSITION REVIEW — for each open position:
   - If current price moved significantly toward your thesis (e.g. YES at 95c+ when you entered at 82c), consider selling now to lock profit vs waiting for settlement.
   - If thesis has weakened or news contradicts it, EXIT: `PYTHONPATH=. python3 gossip/trader.py exit TICKER --reasoning "..."`
   - If thesis still holds and edge remains, HOLD.
   - Use web search to verify — don't just check prices, check if the underlying event happened.

4. MARKET DISCOVERY — use targeted searches, not just broad scans:
   - `PYTHONPATH=. python3 gossip/kalshi.py quick --limit 60` for broad overview
   - `PYTHONPATH=. python3 gossip/kalshi.py search "specific topic"` for targeted lookups
   - Focus on categories where news creates edge: Politics, Economics, Macro events
   - Search for current events you already know about from news/web search
   - Skip sports, entertainment, and illiquid markets (volume < 500, spread > 15c)

5. RESEARCH — pick 3-5 promising markets:
   - Use web search to find relevant news and primary sources
   - Use `PYTHONPATH=. python3 gossip/news.py --keywords "..."` for broader news scraping
   - Estimate the true probability based on evidence
   - Look for near-arbitrage: events that already happened but market hasn't caught up

6. TRADE if you find edge > 10pp with clear reasoning:
   Before executing, answer in one line: "Evidence type: [hard/soft/speculation]. Weakest assumption: [X]."
   If the evidence is speculation, PASS unless edge is overwhelming (>25pp).
   If you can't name what would make you wrong, your thesis isn't specific enough — PASS.
   `PYTHONPATH=. python3 gossip/trader.py trade TICKER --side yes/no --estimate 0.XX --confidence high/medium --reasoning "..."`

7. Update data/strategy_notes.md with what you learned this cycle.

EXECUTION DISCIPLINE:
- Be decisive. Research → conclude → act. Don't loop endlessly.
- For each market: reach a YES/NO/PASS decision within 2-3 tool calls.
- Evaluate 3-5 markets per cycle, trade the best 1-2. Don't try to cover everything.
- If you can't find edge after 5 minutes on a market, pass and move on.
- Write your conclusion even when you pass — future cycles benefit from it.
"""


def build_rationale_prompt(rationale: str) -> str:
    return f"""Read SOUL.md for your identity and strategy principles.

A user has submitted this thesis for you to research and potentially trade on:

USER THESIS: {rationale}

Your job:
1. Research this thesis thoroughly using web search and news scraping.
2. Find evidence for AND against.
3. Estimate the probability if there's a relevant Kalshi market.
4. If you find a market with edge based on this thesis, trade it.
5. If the thesis doesn't hold up, explain why and pass.
6. Update data/user_rationales.json with your findings.
7. Update data/strategy_notes.md if you learned something new.

Check portfolio first: `PYTHONPATH=. python3 gossip/trader.py portfolio`
Scan markets: `PYTHONPATH=. python3 gossip/kalshi.py scan` or `PYTHONPATH=. python3 gossip/kalshi.py search "relevant keywords"`
"""


LIVE_LOG = DATA_DIR / "agent_live.jsonl"
LIVE_STATUS = DATA_DIR / "agent_status.json"


def write_status(status: str, **extra) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    LIVE_STATUS.write_text(json.dumps({"status": status, "timestamp": _now(), **extra}))


def run_agent(prompt: str, timeout: int = 600) -> dict:
    """Spawn Claude Code as a subprocess. Stream output to live log file."""
    cmd = [
        "claude",
        "--print", "-",
        "--output-format", "stream-json",
        "--verbose",
        "--max-turns", "80",
        "--dangerously-skip-permissions",
    ]

    env = {k: v for k, v in os.environ.items() if k not in {
        "CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT",
    }}
    env["PYTHONPATH"] = str(PROJECT_DIR)

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    # Clear live log for this cycle
    LIVE_LOG.write_text("")
    write_status("running")

    start = time.time()
    session_id = None
    agent_output = ""

    try:
        proc = subprocess.Popen(
            cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.PIPE, text=True, env=env, cwd=str(PROJECT_DIR),
        )
        # Send prompt and close stdin
        proc.stdin.write(prompt)
        proc.stdin.close()

        # Stream stdout line by line to live log
        with open(LIVE_LOG, "a") as logf:
            for line in proc.stdout:
                line = line.strip()
                if not line:
                    continue
                # Write raw line to live log for streaming
                logf.write(line + "\n")
                logf.flush()

                try:
                    msg = json.loads(line)
                    if msg.get("type") == "system" and "session_id" in msg:
                        session_id = msg["session_id"]
                    if msg.get("type") == "result":
                        agent_output = msg.get("result", "")
                    if msg.get("type") == "assistant" and msg.get("message"):
                        for block in msg["message"].get("content", []):
                            if isinstance(block, dict) and block.get("type") == "text":
                                text = block.get("text", "")
                                agent_output += text + "\n"
                                write_status("running", last_text=text[:200])
                    if msg.get("type") == "assistant" and msg.get("message"):
                        for block in msg["message"].get("content", []):
                            if isinstance(block, dict) and block.get("type") == "tool_use":
                                tool = block.get("name", "")
                                write_status("running", tool=tool)
                except json.JSONDecodeError:
                    continue

                if time.time() - start > timeout:
                    proc.kill()
                    write_status("timeout")
                    return {"status": "timeout", "duration_s": timeout, "timestamp": _now()}

        proc.wait()

    except Exception as e:
        write_status("error", error=str(e))
        return {"status": "error", "duration_s": round(time.time() - start, 1), "timestamp": _now(), "error": str(e)}

    duration = round(time.time() - start, 1)

    cycle_result = {
        "timestamp": _now(),
        "status": "ok" if proc.returncode == 0 else "error",
        "duration_s": duration,
        "session_id": session_id,
        "output": agent_output[:2000] if agent_output else "",
    }

    write_status("idle", last_cycle=duration)

    # Log to DB
    try:
        from gossip.db import GossipDB
        db = GossipDB()
        db.log_cycle(
            session_id=session_id or "",
            duration_s=duration,
            status=cycle_result["status"],
            output_summary=agent_output[:1000] if agent_output else "",
        )
    except Exception:
        pass

    return cycle_result


def submit_rationale(thesis: str) -> None:
    """Add a user rationale to the queue."""
    rationale_file = DATA_DIR / "user_rationales.json"
    data = {"rationales": []}
    if rationale_file.exists():
        try:
            data = json.loads(rationale_file.read_text())
        except Exception:
            pass

    data["rationales"].append({
        "id": len(data["rationales"]) + 1,
        "timestamp": _now(),
        "thesis": thesis,
        "status": "pending",
        "agent_response": None,
    })
    rationale_file.write_text(json.dumps(data, indent=2))


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def main():
    parser = argparse.ArgumentParser(description="Open Trademaxxxing agent")
    parser.add_argument("--loop", action="store_true", help="Run continuously")
    parser.add_argument("--interval", type=int, default=None, help="Cycle interval in seconds")
    parser.add_argument("--prompt", type=str, default=None, help="Custom prompt")
    parser.add_argument("--rationale", type=str, default=None, help="Submit a trading thesis")
    parser.add_argument("--timeout", type=int, default=1200, help="Agent timeout per cycle (default 20min)")
    parser.add_argument("--dry-run", action="store_true")

    args = parser.parse_args()
    interval = args.interval or int(os.getenv("CYCLE_INTERVAL", "900"))

    if args.rationale:
        submit_rationale(args.rationale)
        prompt = build_rationale_prompt(args.rationale)
    else:
        prompt = args.prompt or CYCLE_PROMPT

    if args.dry_run:
        print(prompt)
        return

    print(f"[Open Trademaxxxing] Starting agent", file=sys.stderr)
    print(f"  Mode: {'loop (' + str(interval) + 's)' if args.loop else 'single cycle'}", file=sys.stderr)

    while True:
        ts = datetime.now(timezone.utc).strftime('%H:%M:%S')
        print(f"\n[{ts}] Starting cycle...", file=sys.stderr)

        result = run_agent(prompt, timeout=args.timeout)

        print(f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] Done: {result['status']} ({result['duration_s']}s)", file=sys.stderr)
        if result.get("output"):
            print(result["output"][:500], file=sys.stderr)

        if not args.loop:
            print(json.dumps(result, indent=2))
            break

        print(f"  Next cycle in {interval}s...", file=sys.stderr)
        time.sleep(interval)


if __name__ == "__main__":
    main()
