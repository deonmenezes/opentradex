"""
OpenTradex - agent orchestrator.

Spawns Codex CLI as a subprocess. The agent reads SOUL.md for personality,
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


def parse_csv_env(name: str, fallback: str = "") -> list[str]:
    raw = os.getenv(name, fallback)
    return [item.strip().lower() for item in raw.split(",") if item.strip()]


def build_runtime_context() -> str:
    runtime = os.getenv("OPENTRADEX_RUNTIME", "codex-cli")
    primary_market = os.getenv("OPENTRADEX_PRIMARY_MARKET", "kalshi")
    enabled_markets = parse_csv_env("OPENTRADEX_ENABLED_MARKETS", primary_market)
    integrations = parse_csv_env("OPENTRADEX_ENABLED_INTEGRATIONS", "apify,rss")
    dashboard_surface = os.getenv("OPENTRADEX_DASHBOARD_SURFACE", "chat")
    channels = parse_csv_env("OPENTRADEX_CHANNELS", "command,markets,feeds,risk,execution")
    tradingview_connector_mode = os.getenv("TRADINGVIEW_CONNECTOR_MODE", "watchlist").strip().lower()
    tradingview_mcp_enabled = os.getenv("TRADINGVIEW_MCP_ENABLED", "false").strip().lower() == "true"
    tradingview_mcp_transport = os.getenv("TRADINGVIEW_MCP_TRANSPORT", "stdio").strip().lower()

    lines = [
        "Workspace profile:",
        f"- Runtime profile: {runtime}",
        f"- Primary market: {primary_market}",
        f"- Enabled market rails: {', '.join(enabled_markets)}",
        f"- Enabled data integrations: {', '.join(integrations)}",
        f"- Dashboard surface: {dashboard_surface}",
        f"- Operator channels: {', '.join(channels)}",
        "- Use only the rails enabled in this workspace.",
        "- Live execution is currently routed through Kalshi only. Other rails are for discovery, research, and cross-market context unless explicitly extended.",
        "",
        "Available market/data rails for this workspace:",
    ]

    if "kalshi" in enabled_markets:
        lines.extend(
            [
                "- Kalshi discovery and execution:",
                "  `PYTHONPATH=. python3 gossip/kalshi.py quick --limit 60`",
                "  `PYTHONPATH=. python3 gossip/kalshi.py search \"specific topic\"`",
                "  `PYTHONPATH=. python3 gossip/trader.py trade TICKER --side yes/no --estimate 0.XX --confidence high/medium --reasoning \"...\"`",
            ]
        )

    if "polymarket" in enabled_markets:
        lines.extend(
            [
                "- Polymarket discovery rail:",
                "  `PYTHONPATH=. python3 gossip/polymarket.py scan --limit 40`",
                "  `PYTHONPATH=. python3 gossip/polymarket.py search \"specific topic\"`",
                "  Use Polymarket for cross-market validation, sentiment, and mispricing comparisons.",
            ]
        )

    if "tradingview" in enabled_markets:
        if tradingview_connector_mode == "mcp" and tradingview_mcp_enabled:
            lines.extend(
                [
                    "- TradingView MCP rail:",
                    f"  Transport: {tradingview_mcp_transport}",
                    "  If the local Codex session has the TradingView MCP server available, use it for richer chart and symbol context.",
                    "  Fall back to `TRADINGVIEW_WATCHLIST` if the MCP server is unavailable or incomplete.",
                ]
            )
        else:
            lines.extend(
                [
                    "- TradingView watchlist rail:",
                    "  Read `TRADINGVIEW_WATCHLIST` from `.env` and use it to focus macro/equity/crypto research.",
                    "  Treat this as a watchlist/context source unless a dedicated adapter is added.",
                ]
            )

    if "robinhood" in enabled_markets:
        lines.append("- Robinhood is enabled as a broker profile placeholder. Use it for planning and watchlist context unless you add a dedicated execution adapter.")

    if "groww" in enabled_markets:
        lines.append("- Groww is enabled as a broker profile placeholder. Use it for planning and watchlist context unless you add a dedicated execution adapter.")

    if "apify" in integrations:
        lines.append("- Apify-backed news scraping is available through `PYTHONPATH=. python3 gossip/news.py --keywords \"...\"`.")
    if "rss" in integrations:
        lines.append("- RSS/live news fallbacks are enabled through the web dashboard and news routes.")

    return "\n".join(lines)


def build_harness_protocol() -> str:
    return """Operator harness for this cycle:
- Scout lane: scan enabled rails fast and surface the best 3-5 candidates.
- Quant lane: extract the hard numbers, implied price, probability gap, and what actually changed.
- Risk lane: kill weak, speculative, thin, or unsupported setups early. If the evidence is soft, size down or pass.
- Executor lane: act only on the best 1-2 ideas, then record the reasoning clearly for the next cycle.

Always think in that order: scout -> quantify -> challenge -> execute."""


def build_cycle_prompt() -> str:
    return f"""{build_runtime_context()}

{build_harness_protocol()}

Read SOUL.md for your identity and strategy principles.
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
   - If current price moved significantly toward your thesis, consider selling now to lock profit vs waiting for settlement.
   - If thesis has weakened or news contradicts it, EXIT: `PYTHONPATH=. python3 gossip/trader.py exit TICKER --reasoning "..."`.
   - If thesis still holds and edge remains, HOLD.
   - Use web search to verify — don't just check prices, check if the underlying event happened.

4. MARKET DISCOVERY — use targeted searches, not just broad scans:
   - Use the enabled market rails above.
   - Focus on categories where news creates edge: Politics, Economics, Macro events, liquid crypto and cross-market event contracts.
   - Search for current events you already know about from news/web search.
   - Skip thin or noisy setups unless the edge is exceptional.

5. RESEARCH — pick 3-5 promising markets:
   - Use web search to find relevant news and primary sources.
   - Use `PYTHONPATH=. python3 gossip/news.py --keywords "..."` for broader news scraping.
   - Use Polymarket or watchlist rails for comparison when they are enabled.
   - Estimate the true probability based on evidence.
   - Look for near-arbitrage: events that already happened but markets have not caught up.

6. TRADE if you find edge > 10pp with clear reasoning:
   Before executing, answer in one line: "Evidence type: [hard/soft/speculation]. Weakest assumption: [X]."
   If the evidence is speculation, PASS unless edge is overwhelming (>25pp).
   If you cannot name what would make you wrong, your thesis is not specific enough — PASS.
   Only route live orders through supported execution rails.

7. Update data/strategy_notes.md with what you learned this cycle.

EXECUTION DISCIPLINE:
- Be decisive. Research -> conclude -> act. Do not loop endlessly.
- For each market: reach a YES/NO/PASS decision within 2-3 tool calls.
- Evaluate 3-5 markets per cycle, trade the best 1-2. Do not try to cover everything.
- If you cannot find edge after 5 minutes on a market, pass and move on.
- Write your conclusion even when you pass — future cycles benefit from it.
"""


def build_rationale_prompt(rationale: str) -> str:
    return f"""{build_runtime_context()}

{build_harness_protocol()}

Read SOUL.md for your identity and strategy principles.

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
Scan markets using the enabled rails above. Use Kalshi for execution and Polymarket/watchlist rails for comparison where available.
"""


LIVE_LOG = DATA_DIR / "agent_live.jsonl"
LIVE_STATUS = DATA_DIR / "agent_status.json"


def write_status(status: str, **extra) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    LIVE_STATUS.write_text(json.dumps({"status": status, "timestamp": _now(), **extra}))


def _collect_stderr(stderr_output: str, limit: int = 2000) -> str:
    lines = [line.strip() for line in stderr_output.splitlines() if line.strip()]
    return "\n".join(lines[-20:])[:limit]


def _is_transient_codex_error(stderr_output: str) -> bool:
    text = stderr_output.lower()
    transient_patterns = [
        "we're currently experiencing high demand",
        "500 internal server error",
        "stream disconnected",
        "timed out",
        "temporarily unavailable",
    ]
    return any(pattern in text for pattern in transient_patterns)


def run_agent(prompt: str, timeout: int = 600) -> dict:
    """Spawn Codex CLI as a subprocess. Stream output to live log file."""
    configured_runtime = os.getenv("OPENTRADEX_RUNTIME", "codex-cli")
    cmd = [
        "codex",
        "exec",
        "--json",
        "--dangerously-bypass-approvals-and-sandbox",
        "-C", str(PROJECT_DIR),
        "-",
    ]

    env = {k: v for k, v in os.environ.items() if k not in {
        "CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT",
    }}
    env["PYTHONPATH"] = str(PROJECT_DIR)

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    # Clear live log for this cycle
    LIVE_LOG.write_text("")
    write_status("running", configured_runtime=configured_runtime, runner="codex-cli")

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
                    if msg.get("type") == "thread.started" and "thread_id" in msg:
                        session_id = msg["thread_id"]
                    if msg.get("type") == "agent_message" and msg.get("message"):
                        agent_output += msg["message"] + "\n"
                        write_status("running", last_text=msg["message"][:200])
                    if msg.get("type") == "item.completed":
                        item = msg.get("item", {})
                        item_type = item.get("type")
                        if item_type == "agent_message":
                            text = item.get("text", "")
                            if text:
                                agent_output += text + "\n"
                                write_status("running", last_text=text[:200])
                        if item_type == "reasoning":
                            summary = item.get("summary") or []
                            if summary:
                                text = " ".join(
                                    part.get("text", "") for part in summary if isinstance(part, dict)
                                ).strip()
                                if text:
                                    write_status("running", last_text=text[:200])
                        if item_type == "message":
                            for content in item.get("content", []):
                                if isinstance(content, dict) and content.get("type") == "output_text":
                                    text = content.get("text", "")
                                    if text:
                                        agent_output += text + "\n"
                                        write_status("running", last_text=text[:200])
                    if msg.get("type") == "token_count" and msg.get("info"):
                        write_status("running", token_count=msg["info"].get("total_token_usage"))
                    if msg.get("type") == "exec_command_begin" and msg.get("call_id"):
                        write_status("running", tool="exec_command", call_id=msg["call_id"])
                except json.JSONDecodeError:
                    continue

                if time.time() - start > timeout:
                    proc.kill()
                    write_status("timeout")
                    return {"status": "timeout", "duration_s": timeout, "timestamp": _now()}

        stderr_output = proc.stderr.read()
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
        "error": _collect_stderr(stderr_output) if proc.returncode != 0 else "",
    }

    if proc.returncode != 0 and _is_transient_codex_error(stderr_output):
        cycle_result["status"] = "retryable_error"

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
    parser = argparse.ArgumentParser(description="OpenTradex agent")
    parser.add_argument("--loop", action="store_true", help="Run continuously")
    parser.add_argument("--interval", type=int, default=None, help="Cycle interval in seconds")
    parser.add_argument("--prompt", type=str, default=None, help="Custom prompt")
    parser.add_argument("--rationale", type=str, default=None, help="Submit a trading thesis")
    parser.add_argument("--timeout", type=int, default=1200, help="Agent timeout per cycle (default 20min)")
    parser.add_argument("--dry-run", action="store_true")

    args = parser.parse_args()
    interval = args.interval or int(os.getenv("CYCLE_INTERVAL", "900"))
    configured_runtime = os.getenv("OPENTRADEX_RUNTIME", "codex-cli")

    if args.rationale:
        submit_rationale(args.rationale)
        prompt = build_rationale_prompt(args.rationale)
    else:
        prompt = args.prompt or build_cycle_prompt()

    if args.dry_run:
        print(prompt)
        return

    print(f"[OpenTradex] Starting agent", file=sys.stderr)
    if configured_runtime != "codex-cli":
        print(
            f"  Runtime profile: {configured_runtime} (executing with Codex CLI runner)",
            file=sys.stderr,
        )
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
