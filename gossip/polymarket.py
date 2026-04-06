"""
Polymarket discovery rail.

CLI usage:
    python3 gossip/polymarket.py scan --limit 40
    python3 gossip/polymarket.py search "bitcoin"
    python3 gossip/polymarket.py market <id-or-slug>

This module intentionally focuses on public Gamma API discovery so the agent can
compare Polymarket pricing with other rails without requiring a wallet up front.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

BASE_URL = os.getenv("POLYMARKET_GAMMA_URL", "https://gamma-api.polymarket.com").rstrip("/")


def log(message: str) -> None:
    print(message, file=sys.stderr)


async def api_get(path: str, params: dict | None = None):
    url = f"{BASE_URL}{path}"
    if params:
        url = f"{url}?{urlencode(params)}"

    request = Request(
        url,
        headers={
            "User-Agent": "OpenTradex/0.1 (+https://github.com/deonmenezes/open-trademaxxxing)",
            "Accept": "application/json",
        },
    )

    with urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def parse_outcome_prices(raw_prices: str | list | None) -> tuple[float | None, float | None]:
    if not raw_prices:
        return None, None

    prices = raw_prices
    if isinstance(raw_prices, str):
        try:
            prices = json.loads(raw_prices)
        except json.JSONDecodeError:
            return None, None

    if not isinstance(prices, list) or len(prices) < 2:
        return None, None

    try:
        return float(prices[0]), float(prices[1])
    except (TypeError, ValueError):
        return None, None


def simplify_market(market: dict) -> dict:
    yes_price, no_price = parse_outcome_prices(market.get("outcomePrices"))
    event_title = ""
    if market.get("events"):
        event_title = market["events"][0].get("title", "")

    return {
        "id": market.get("id"),
        "slug": market.get("slug"),
        "question": market.get("question"),
        "event_title": event_title,
        "description": market.get("description", "")[:700],
        "end_date": market.get("endDate"),
        "yes_price": yes_price,
        "no_price": no_price,
        "volume": float(market.get("volumeNum") or market.get("volume") or 0),
        "liquidity": float(market.get("liquidityNum") or market.get("liquidity") or 0),
        "volume_24h": float(market.get("volume24hr") or 0),
        "active": bool(market.get("active")),
        "closed": bool(market.get("closed")),
        "accepting_orders": bool(market.get("acceptingOrders")),
        "url": f"https://polymarket.com/event/{market.get('slug')}" if market.get("slug") else "",
    }


async def scan_markets(limit: int = 40, min_volume: float = 1000, min_liquidity: float = 1000) -> list[dict]:
    data = await api_get(
        "/markets",
        {
            "active": "true",
            "closed": "false",
            "limit": max(limit * 3, 120),
        },
    )
    markets = [simplify_market(m) for m in data]
    filtered = [
        market
        for market in markets
        if market["volume"] >= min_volume and market["liquidity"] >= min_liquidity
    ]
    filtered.sort(key=lambda market: market["volume"], reverse=True)
    return filtered[:limit]


async def search_markets(query: str, limit: int = 20) -> list[dict]:
    data = await api_get(
        "/markets",
        {
            "active": "true",
            "closed": "false",
            "limit": 300,
        },
    )
    needle = query.lower()
    matched = []
    for market in data:
        haystack = " ".join(
            [
                str(market.get("question", "")),
                str(market.get("description", "")),
                str(market.get("slug", "")),
                str(market.get("groupItemTitle", "")),
            ]
        ).lower()
        if needle in haystack:
            matched.append(simplify_market(market))

    matched.sort(key=lambda market: (market["volume"], market["liquidity"]), reverse=True)
    return matched[:limit]


async def get_market(identifier: str) -> dict | None:
    data = await api_get(
        "/markets",
        {
            "active": "true",
            "closed": "false",
            "limit": 500,
        },
    )
    for market in data:
        if str(market.get("id")) == identifier or market.get("slug") == identifier:
            return simplify_market(market)
    return None


async def main_async():
    parser = argparse.ArgumentParser(description="Polymarket discovery rail")
    subparsers = parser.add_subparsers(dest="command", required=True)

    scan_parser = subparsers.add_parser("scan")
    scan_parser.add_argument("--limit", type=int, default=40)
    scan_parser.add_argument("--min-volume", type=float, default=1000)
    scan_parser.add_argument("--min-liquidity", type=float, default=1000)

    search_parser = subparsers.add_parser("search")
    search_parser.add_argument("query", type=str)
    search_parser.add_argument("--limit", type=int, default=20)

    market_parser = subparsers.add_parser("market")
    market_parser.add_argument("identifier", type=str)

    args = parser.parse_args()

    if args.command == "scan":
        result = await scan_markets(args.limit, args.min_volume, args.min_liquidity)
        print(json.dumps(result, indent=2))
        return

    if args.command == "search":
        result = await search_markets(args.query, args.limit)
        print(json.dumps(result, indent=2))
        return

    result = await get_market(args.identifier)
    if result is None:
        log(f"No Polymarket market found for {args.identifier}")
        print(json.dumps({"error": "market_not_found", "identifier": args.identifier}, indent=2))
        return
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    import asyncio

    asyncio.run(main_async())
