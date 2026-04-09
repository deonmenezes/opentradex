"""
Kalshi API client — market scanning, orderbook, search, and authenticated trading.

CLI tool invoked by Claude Code agent:
    python3 gossip/kalshi.py scan [--categories "Economics,Politics"] [--days 14]
    python3 gossip/kalshi.py market TICKER
    python3 gossip/kalshi.py orderbook TICKER
    python3 gossip/kalshi.py search "bitcoin"
    python3 gossip/kalshi.py events TICKER
    python3 gossip/kalshi.py order TICKER --action buy --side yes --count 3 --price 55
    python3 gossip/kalshi.py positions
    python3 gossip/kalshi.py balance

All output is JSON to stdout. Logs go to stderr.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
import math
from dataclasses import dataclass, asdict
from datetime import datetime, timezone, timedelta
from pathlib import Path
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

import aiohttp
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

PROD_BASE = "https://api.elections.kalshi.com/trade-api/v2"
DEMO_BASE = "https://demo-api.kalshi.co/trade-api/v2"

def get_base_url() -> str:
    """Use prod by default, but honor explicit demo mode for testing workflows."""
    use_demo = os.getenv("KALSHI_USE_DEMO", "false").strip().lower() == "true"
    return DEMO_BASE if use_demo else PROD_BASE

def log(msg: str) -> None:
    print(msg, file=sys.stderr)

# --- Auth ---

def load_private_key():
    key_path = os.getenv("KALSHI_PRIVATE_KEY_PATH", "")
    key_raw = os.getenv("KALSHI_PRIVATE_KEY", "")
    if key_path:
        key_raw = Path(key_path).read_text()
    if not key_raw:
        return None
    return serialization.load_pem_private_key(key_raw.encode(), password=None)

def build_auth_headers(method: str, path: str) -> dict:
    api_key = os.getenv("KALSHI_API_KEY_ID", "")
    pk = load_private_key()
    if not api_key or not pk:
        return {}

    timestamp = str(int(time.time() * 1000))
    message = f"{timestamp}{method.upper()}{path}"
    signature = pk.sign(
        message.encode(),
        padding.PSS(
            mgf=padding.MGF1(hashes.SHA256()),
            salt_length=32,
        ),
        hashes.SHA256(),
    )
    import base64
    return {
        "KALSHI-ACCESS-KEY": api_key,
        "KALSHI-ACCESS-SIGNATURE": base64.b64encode(signature).decode(),
        "KALSHI-ACCESS-TIMESTAMP": timestamp,
    }

# --- API helpers ---

SKIP_SERIES = {"KXMVESPORTS", "KXMVE"}  # only skip pure noise; agent decides what's interesting

MAX_RETRIES = 3
BASE_DELAY = 1.0

async def api_get(session: aiohttp.ClientSession, path: str, params: dict | None = None, auth: bool = False) -> dict:
    base = get_base_url()
    url = f"{base}{path}"
    headers = {"Accept-Encoding": "gzip", "Content-Type": "application/json"}
    if auth:
        headers.update(build_auth_headers("GET", f"/trade-api/v2{path}"))

    for attempt in range(MAX_RETRIES + 1):
        try:
            async with session.get(url, params=params, headers=headers) as resp:
                text = await resp.text()
                if resp.status == 429 and attempt < MAX_RETRIES:
                    delay = BASE_DELAY * (2 ** attempt)
                    log(f"Rate limited, retrying in {delay:.0f}s...")
                    await asyncio.sleep(delay)
                    continue
                if resp.status >= 400:
                    return {"error": f"HTTP {resp.status}", "body": text[:200]}
                return json.loads(text) if text else {}
        except (aiohttp.ClientError, asyncio.TimeoutError) as e:
            if attempt < MAX_RETRIES:
                await asyncio.sleep(BASE_DELAY * (2 ** attempt))
                continue
            return {"error": str(e)}
    return {"error": "max retries exceeded"}

async def api_post(session: aiohttp.ClientSession, path: str, body: dict) -> dict:
    url = f"{get_base_url()}{path}"
    headers = {"Content-Type": "application/json"}
    headers.update(build_auth_headers("POST", f"/trade-api/v2{path}"))

    for attempt in range(MAX_RETRIES + 1):
        try:
            async with session.post(url, json=body, headers=headers) as resp:
                text = await resp.text()
                if resp.status == 429 and attempt < MAX_RETRIES:
                    await asyncio.sleep(BASE_DELAY * (2 ** attempt))
                    continue
                if resp.status >= 400:
                    return {"error": f"HTTP {resp.status}", "body": text[:500]}
                return json.loads(text) if text else {}
        except (aiohttp.ClientError, asyncio.TimeoutError) as e:
            if attempt < MAX_RETRIES:
                await asyncio.sleep(BASE_DELAY * (2 ** attempt))
                continue
            return {"error": str(e)}
    return {"error": "max retries exceeded"}

async def api_delete(session: aiohttp.ClientSession, path: str, body: dict | None = None) -> dict:
    url = f"{get_base_url()}{path}"
    headers = {"Content-Type": "application/json"}
    headers.update(build_auth_headers("DELETE", f"/trade-api/v2{path}"))

    async with session.delete(url, json=body, headers=headers) as resp:
        text = await resp.text()
        if resp.status >= 400:
            return {"error": f"HTTP {resp.status}", "body": text[:500]}
        return json.loads(text) if text else {}

# --- Market scanning ---

@dataclass
class Market:
    ticker: str
    event_ticker: str
    series_ticker: str
    title: str
    category: str
    rules: str
    close_time: str
    days_to_close: float
    yes_bid: float
    yes_ask: float
    mid: float
    spread_cents: float
    volume: float
    open_interest: float
    implied_prob: float

def parse_market(m: dict, category: str = "") -> Market | None:
    ticker = m.get("ticker", "")
    for skip in SKIP_SERIES:
        if ticker.startswith(skip):
            return None

    close_str = m.get("close_time", "")
    if not close_str:
        return None
    try:
        close_dt = datetime.fromisoformat(close_str.replace("Z", "+00:00"))
    except ValueError:
        return None

    now = datetime.now(timezone.utc)
    days = (close_dt - now).total_seconds() / 86400
    if days < 0:
        return None

    bid = float(m.get("yes_bid_dollars", "0") or "0")
    ask = float(m.get("yes_ask_dollars", "0") or "0")
    vol = float(m.get("volume_fp", "0") or "0")
    oi = float(m.get("open_interest_fp", "0") or "0")

    if bid == 0 and ask == 0:
        return None

    mid = (bid + ask) / 2
    spread = (ask - bid) * 100

    cat = category or m.get("category", "")

    return Market(
        ticker=ticker,
        event_ticker=m.get("event_ticker", ""),
        series_ticker=m.get("series_ticker", ""),
        title=m.get("title", ""),
        category=cat,
        rules=m.get("rules_primary", ""),
        close_time=close_str[:16],
        days_to_close=round(days, 2),
        yes_bid=bid,
        yes_ask=ask,
        mid=round(mid, 4),
        spread_cents=round(spread, 1),
        volume=vol,
        open_interest=oi,
        implied_prob=round(mid, 4),
    )

async def scan_markets(
    categories: set[str] | None = None,
    max_days: int = 30,
    min_oi: float = 50,
    max_series: int = 100,
) -> list[Market]:
    async with aiohttp.ClientSession() as session:
        data = await api_get(session, "/series", {"limit": 500})
        all_series = data.get("series", [])

        interesting = []
        for s in all_series:
            ticker = s.get("ticker", "")
            if any(ticker.startswith(skip) for skip in SKIP_SERIES):
                continue
            if categories:
                cat = s.get("category", "")
                if cat and cat not in categories:
                    continue
            interesting.append(s)

        interesting = interesting[:max_series]
        log(f"Scanning {len(interesting)} series...")

        markets: list[Market] = []
        for i, s in enumerate(interesting):
            mdata = await api_get(session, "/markets", {
                "series_ticker": s["ticker"],
                "status": "open",
                "limit": 200,
            })
            for m in mdata.get("markets", []):
                parsed = parse_market(m, s.get("category", ""))
                if parsed and parsed.days_to_close <= max_days and parsed.open_interest >= min_oi:
                    markets.append(parsed)

            if (i + 1) % 50 == 0:
                log(f"  checked {i+1}/{len(interesting)}...")
                await asyncio.sleep(0.3)

        markets.sort(key=lambda m: m.volume, reverse=True)
        return markets

async def get_market_detail(ticker: str) -> dict:
    async with aiohttp.ClientSession() as session:
        data = await api_get(session, f"/markets/{ticker}")
        market = data.get("market", data)
        ob = await api_get(session, f"/markets/{ticker}/orderbook")
        orderbook = ob.get("orderbook_fp", ob.get("orderbook", {}))
        return {"market": market, "orderbook": orderbook}

async def get_orderbook(ticker: str) -> dict:
    async with aiohttp.ClientSession() as session:
        data = await api_get(session, f"/markets/{ticker}/orderbook")
        return data.get("orderbook_fp", data.get("orderbook", data))

async def search_events(query: str) -> list[dict]:
    async with aiohttp.ClientSession() as session:
        data = await api_get(session, "/events", {"limit": 200, "with_nested_markets": "true"})
        events = data.get("events", [])
        q = query.lower()
        matched = [e for e in events if q in e.get("title", "").lower()]
        results = []
        for e in matched[:20]:
            results.append({
                "event_ticker": e.get("event_ticker", ""),
                "title": e.get("title", ""),
                "category": e.get("category", ""),
                "markets": [
                    {
                        "ticker": m.get("ticker", ""),
                        "title": m.get("yes_sub_title", m.get("title", "")),
                        "yes_bid": m.get("yes_bid", 0),
                        "yes_ask": m.get("yes_ask", 0),
                        "volume": m.get("volume", 0),
                    }
                    for m in e.get("markets", [])[:10]
                ],
            })
        return results

async def quick_scan(categories: set[str] | None = None, max_days: int = 30, min_volume: float = 100) -> list[dict]:
    """Fast scan using /events endpoint — single paginated call instead of per-series iteration."""
    async with aiohttp.ClientSession() as session:
        all_markets = []
        cursor = ""
        for page in range(5):  # max 5 pages
            params = {"limit": 200, "with_nested_markets": "true", "status": "open"}
            if cursor:
                params["cursor"] = cursor
            data = await api_get(session, "/events", params)
            events = data.get("events", [])
            cursor = data.get("cursor", "")

            for e in events:
                cat = e.get("category", "")
                if categories and cat not in categories:
                    continue
                for m in e.get("markets", []):
                    parsed = parse_market(m, cat)
                    if parsed and parsed.days_to_close <= max_days and parsed.volume >= min_volume:
                        all_markets.append(parsed)

            if not cursor:
                break

        all_markets.sort(key=lambda m: m.volume, reverse=True)
        log(f"Quick scan: {len(all_markets)} markets found")
        return all_markets


async def get_event_markets(event_ticker: str) -> list[dict]:
    async with aiohttp.ClientSession() as session:
        data = await api_get(session, "/markets", {
            "event_ticker": event_ticker,
            "limit": 200,
        })
        return data.get("markets", [])

# --- Authenticated endpoints ---

async def place_order(ticker: str, action: str, side: str, count: int, price_cents: int | None = None, order_type: str = "market") -> dict:
    body: dict = {
        "ticker": ticker,
        "action": action,
        "side": side,
        "type": order_type,
        "count": count,
    }
    if price_cents is not None:
        if side == "yes":
            body["yes_price"] = price_cents
        else:
            body["no_price"] = price_cents
    async with aiohttp.ClientSession() as session:
        return await api_post(session, "/portfolio/orders", body)

async def get_positions() -> dict:
    async with aiohttp.ClientSession() as session:
        return await api_get(session, "/portfolio/positions", {"limit": 200}, auth=True)

async def get_balance() -> dict:
    async with aiohttp.ClientSession() as session:
        return await api_get(session, "/portfolio/balance", auth=True)

async def cancel_order(order_id: str) -> dict:
    async with aiohttp.ClientSession() as session:
        return await api_delete(session, f"/portfolio/orders/{order_id}")

# --- Fee calculation ---

def kalshi_fee(contracts: int, price: float) -> float:
    return math.ceil(0.07 * contracts * price * (1 - price)) / 100

# --- CLI ---

async def main():
    parser = argparse.ArgumentParser(description="Kalshi API client")
    sub = parser.add_subparsers(dest="command")

    scan_p = sub.add_parser("scan", help="Scan active markets (slow, per-series)")
    scan_p.add_argument("--categories", type=str, default=None)
    scan_p.add_argument("--days", type=int, default=30)
    scan_p.add_argument("--min-oi", type=float, default=50)
    scan_p.add_argument("--limit", type=int, default=50)

    quick_p = sub.add_parser("quick", help="Fast scan via events endpoint (~10s)")
    quick_p.add_argument("--categories", type=str, default=None)
    quick_p.add_argument("--days", type=int, default=30)
    quick_p.add_argument("--min-volume", type=float, default=100)
    quick_p.add_argument("--limit", type=int, default=50)

    market_p = sub.add_parser("market", help="Get market details")
    market_p.add_argument("ticker")

    ob_p = sub.add_parser("orderbook", help="Get orderbook")
    ob_p.add_argument("ticker")

    search_p = sub.add_parser("search", help="Search events")
    search_p.add_argument("query")

    events_p = sub.add_parser("events", help="Get event markets")
    events_p.add_argument("event_ticker")

    order_p = sub.add_parser("order", help="Place order (authenticated)")
    order_p.add_argument("ticker")
    order_p.add_argument("--action", choices=["buy", "sell"], required=True)
    order_p.add_argument("--side", choices=["yes", "no"], required=True)
    order_p.add_argument("--count", type=int, required=True)
    order_p.add_argument("--price", type=int, default=None, help="Price in cents (1-99)")
    order_p.add_argument("--type", dest="order_type", choices=["market", "limit"], default="market")

    sub.add_parser("positions", help="Get positions (authenticated)")
    sub.add_parser("balance", help="Get balance (authenticated)")

    cancel_p = sub.add_parser("cancel", help="Cancel order")
    cancel_p.add_argument("order_id")

    args = parser.parse_args()

    if args.command == "scan":
        cats = set(args.categories.split(",")) if args.categories else None
        markets = await scan_markets(categories=cats, max_days=args.days, min_oi=args.min_oi)
        results = [asdict(m) for m in markets[:args.limit]]

        # persist snapshots to DB
        if results:
            try:
                import sys as _sys
                _sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
                from gossip.db import GossipDB
                db = GossipDB()
                db.insert_market_snapshots(results)
            except Exception as e:
                log(f"DB snapshot write failed: {e}")

        print(json.dumps(results, indent=2))

    elif args.command == "quick":
        cats = set(args.categories.split(",")) if args.categories else None
        markets = await quick_scan(categories=cats, max_days=args.days, min_volume=args.min_volume)
        results = [asdict(m) for m in markets[:args.limit]]

        if results:
            try:
                import sys as _sys
                _sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
                from gossip.db import GossipDB
                db = GossipDB()
                db.insert_market_snapshots(results)
            except Exception as e:
                log(f"DB snapshot write failed: {e}")

        print(json.dumps(results, indent=2))

    elif args.command == "market":
        result = await get_market_detail(args.ticker)
        print(json.dumps(result, indent=2))

    elif args.command == "orderbook":
        result = await get_orderbook(args.ticker)
        print(json.dumps(result, indent=2))

    elif args.command == "search":
        results = await search_events(args.query)
        print(json.dumps(results, indent=2))

    elif args.command == "events":
        results = await get_event_markets(args.event_ticker)
        print(json.dumps(results, indent=2))

    elif args.command == "order":
        result = await place_order(
            ticker=args.ticker,
            action=args.action,
            side=args.side,
            count=args.count,
            price_cents=args.price,
            order_type=args.order_type,
        )
        print(json.dumps(result, indent=2))

    elif args.command == "positions":
        result = await get_positions()
        print(json.dumps(result, indent=2))

    elif args.command == "balance":
        result = await get_balance()
        print(json.dumps(result, indent=2))

    elif args.command == "cancel":
        result = await cancel_order(args.order_id)
        print(json.dumps(result, indent=2))

    else:
        parser.print_help()

if __name__ == "__main__":
    asyncio.run(main())
