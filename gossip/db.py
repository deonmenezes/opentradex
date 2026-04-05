"""
SQLite database for all Open Trademaxxxing state.

Stores: trades, news articles, market snapshots, agent cycle logs.
Single file at data/gossip.db — zero config, works with Streamlit.

Usage from other modules:
    from gossip.db import GossipDB
    db = GossipDB()
    db.insert_trade(...)
    db.get_open_positions()
"""

from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DB_PATH = DATA_DIR / "gossip.db"


class GossipDB:
    def __init__(self, db_path: Path | str | None = None):
        self.db_path = Path(db_path) if db_path else DB_PATH
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(str(self.db_path))
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.execute("PRAGMA foreign_keys=ON")
        self._create_tables()

    def _create_tables(self):
        self.conn.executescript("""
            CREATE TABLE IF NOT EXISTS trades (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                ticker TEXT NOT NULL,
                title TEXT,
                category TEXT,
                side TEXT NOT NULL,
                action TEXT NOT NULL DEFAULT 'buy',
                contracts INTEGER NOT NULL,
                entry_price REAL NOT NULL,
                cost REAL NOT NULL,
                fee REAL NOT NULL DEFAULT 0,
                estimated_prob REAL,
                edge REAL,
                confidence TEXT,
                reasoning TEXT,
                news_trigger TEXT,
                sources TEXT,
                settled INTEGER NOT NULL DEFAULT 0,
                outcome TEXT DEFAULT '',
                pnl REAL DEFAULT 0,
                exit_price REAL,
                exit_reasoning TEXT,
                exit_timestamp TEXT
            );

            CREATE TABLE IF NOT EXISTS portfolio (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                bankroll REAL NOT NULL DEFAULT 30.0,
                total_pnl REAL NOT NULL DEFAULT 0.0,
                total_trades INTEGER NOT NULL DEFAULT 0,
                wins INTEGER NOT NULL DEFAULT 0,
                losses INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS news (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                source TEXT,
                keyword TEXT,
                title TEXT,
                url TEXT,
                snippet TEXT,
                full_text TEXT,
                relevance_score REAL,
                matched_ticker TEXT,
                processed INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS market_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                ticker TEXT NOT NULL,
                title TEXT,
                category TEXT,
                yes_bid REAL,
                yes_ask REAL,
                mid REAL,
                volume REAL,
                open_interest REAL,
                close_time TEXT
            );

            CREATE TABLE IF NOT EXISTS agent_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                cycle_number INTEGER,
                session_id TEXT,
                duration_s REAL,
                status TEXT,
                markets_scanned INTEGER DEFAULT 0,
                news_scraped INTEGER DEFAULT 0,
                trades_made INTEGER DEFAULT 0,
                output_summary TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_trades_ticker ON trades(ticker);
            CREATE INDEX IF NOT EXISTS idx_trades_settled ON trades(settled);
            CREATE INDEX IF NOT EXISTS idx_news_timestamp ON news(timestamp);
            CREATE INDEX IF NOT EXISTS idx_news_keyword ON news(keyword);
            CREATE INDEX IF NOT EXISTS idx_snapshots_ticker ON market_snapshots(ticker);
            CREATE INDEX IF NOT EXISTS idx_snapshots_timestamp ON market_snapshots(timestamp);
        """)

        # Ensure portfolio row exists
        row = self.conn.execute("SELECT COUNT(*) FROM portfolio").fetchone()
        if row[0] == 0:
            bankroll = float(os.getenv("BANKROLL", "15.0"))
            self.conn.execute(
                "INSERT INTO portfolio (id, bankroll, updated_at) VALUES (1, ?, ?)",
                (bankroll, _now()),
            )
            self.conn.commit()

    # --- Portfolio ---

    def get_portfolio(self) -> dict:
        row = self.conn.execute("SELECT * FROM portfolio WHERE id=1").fetchone()
        return dict(row)

    def update_portfolio(self, **kwargs) -> None:
        kwargs["updated_at"] = _now()
        sets = ", ".join(f"{k}=?" for k in kwargs)
        vals = list(kwargs.values())
        self.conn.execute(f"UPDATE portfolio SET {sets} WHERE id=1", vals)
        self.conn.commit()

    # --- Trades ---

    def insert_trade(self, **kwargs) -> int:
        if "sources" in kwargs and isinstance(kwargs["sources"], list):
            kwargs["sources"] = json.dumps(kwargs["sources"])
        kwargs.setdefault("timestamp", _now())

        cols = ", ".join(kwargs.keys())
        placeholders = ", ".join("?" * len(kwargs))
        cur = self.conn.execute(
            f"INSERT INTO trades ({cols}) VALUES ({placeholders})",
            list(kwargs.values()),
        )
        self.conn.commit()

        # Update portfolio
        p = self.get_portfolio()
        cost = kwargs.get("cost", 0) + kwargs.get("fee", 0)
        self.update_portfolio(
            bankroll=round(p["bankroll"] - cost, 2),
            total_trades=p["total_trades"] + 1,
        )
        return cur.lastrowid

    def get_open_positions(self) -> list[dict]:
        rows = self.conn.execute(
            "SELECT * FROM trades WHERE settled=0 AND action='buy' ORDER BY timestamp DESC"
        ).fetchall()
        return [dict(r) for r in rows]

    def get_trade_history(self, limit: int = 50) -> list[dict]:
        rows = self.conn.execute(
            "SELECT * FROM trades ORDER BY timestamp DESC LIMIT ?", (limit,)
        ).fetchall()
        return [dict(r) for r in rows]

    def settle_trade(self, ticker: str, outcome_yes: bool) -> dict | None:
        row = self.conn.execute(
            "SELECT * FROM trades WHERE ticker=? AND settled=0 ORDER BY timestamp DESC LIMIT 1",
            (ticker,),
        ).fetchone()
        if not row:
            return None

        trade = dict(row)
        won = (trade["side"] == "yes" and outcome_yes) or (trade["side"] == "no" and not outcome_yes)
        if won:
            pnl = round((1.0 - trade["entry_price"]) * trade["contracts"], 2)
            outcome = "win"
        else:
            pnl = round(-trade["entry_price"] * trade["contracts"], 2)
            outcome = "loss"

        self.conn.execute(
            "UPDATE trades SET settled=1, outcome=?, pnl=?, exit_timestamp=? WHERE id=?",
            (outcome, pnl, _now(), trade["id"]),
        )
        self.conn.commit()

        p = self.get_portfolio()
        bankroll = round(p["bankroll"] + trade["entry_price"] * trade["contracts"] + pnl, 2)
        wins = p["wins"] + (1 if won else 0)
        losses = p["losses"] + (0 if won else 1)
        self.update_portfolio(bankroll=bankroll, total_pnl=round(p["total_pnl"] + pnl, 2), wins=wins, losses=losses)

        return {"ticker": ticker, "outcome": outcome, "pnl": pnl, "bankroll": bankroll}

    def exit_trade(self, ticker: str, exit_price: float, reasoning: str = "") -> dict | None:
        row = self.conn.execute(
            "SELECT * FROM trades WHERE ticker=? AND settled=0 ORDER BY timestamp DESC LIMIT 1",
            (ticker,),
        ).fetchone()
        if not row:
            return None

        trade = dict(row)
        pnl = round((exit_price - trade["entry_price"]) * trade["contracts"], 2)
        outcome = "win" if pnl > 0 else "loss"

        self.conn.execute(
            "UPDATE trades SET settled=1, outcome=?, pnl=?, exit_price=?, exit_reasoning=?, exit_timestamp=? WHERE id=?",
            (outcome, pnl, exit_price, reasoning, _now(), trade["id"]),
        )
        self.conn.commit()

        p = self.get_portfolio()
        proceeds = exit_price * trade["contracts"]
        bankroll = round(p["bankroll"] + proceeds, 2)
        wins = p["wins"] + (1 if pnl > 0 else 0)
        losses = p["losses"] + (0 if pnl > 0 else 1)
        self.update_portfolio(bankroll=bankroll, total_pnl=round(p["total_pnl"] + pnl, 2), wins=wins, losses=losses)

        return {"ticker": ticker, "outcome": outcome, "pnl": pnl, "exit_price": exit_price, "bankroll": bankroll}

    # --- News ---

    def insert_news(self, articles: list[dict]) -> int:
        ts = _now()
        count = 0
        for a in articles:
            self.conn.execute(
                "INSERT INTO news (timestamp, source, keyword, title, url, snippet, full_text) VALUES (?,?,?,?,?,?,?)",
                (ts, a.get("source", ""), a.get("keyword", ""), a.get("title", ""),
                 a.get("url", ""), a.get("snippet", ""), a.get("text", "")),
            )
            count += 1
        self.conn.commit()
        return count

    def get_recent_news(self, hours: int = 24, limit: int = 100) -> list[dict]:
        rows = self.conn.execute(
            "SELECT * FROM news ORDER BY timestamp DESC LIMIT ?", (limit,)
        ).fetchall()
        return [dict(r) for r in rows]

    def get_news_for_ticker(self, ticker: str, limit: int = 20) -> list[dict]:
        rows = self.conn.execute(
            "SELECT * FROM news WHERE matched_ticker=? ORDER BY timestamp DESC LIMIT ?",
            (ticker, limit),
        ).fetchall()
        return [dict(r) for r in rows]

    # --- Market snapshots ---

    def insert_market_snapshot(self, market: dict) -> None:
        self.conn.execute(
            """INSERT INTO market_snapshots
               (timestamp, ticker, title, category, yes_bid, yes_ask, mid, volume, open_interest, close_time)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (_now(), market.get("ticker", ""), market.get("title", ""),
             market.get("category", ""), market.get("yes_bid", 0),
             market.get("yes_ask", 0), market.get("mid", 0),
             market.get("volume", 0), market.get("open_interest", 0),
             market.get("close_time", "")),
        )
        self.conn.commit()

    def insert_market_snapshots(self, markets: list[dict]) -> int:
        ts = _now()
        for m in markets:
            self.conn.execute(
                """INSERT INTO market_snapshots
                   (timestamp, ticker, title, category, yes_bid, yes_ask, mid, volume, open_interest, close_time)
                   VALUES (?,?,?,?,?,?,?,?,?,?)""",
                (ts, m.get("ticker", ""), m.get("title", ""),
                 m.get("category", ""), m.get("yes_bid", 0),
                 m.get("yes_ask", 0), m.get("mid", 0),
                 m.get("volume", 0), m.get("open_interest", 0),
                 m.get("close_time", "")),
            )
        self.conn.commit()
        return len(markets)

    def get_market_history(self, ticker: str, limit: int = 100) -> list[dict]:
        rows = self.conn.execute(
            "SELECT * FROM market_snapshots WHERE ticker=? ORDER BY timestamp DESC LIMIT ?",
            (ticker, limit),
        ).fetchall()
        return [dict(r) for r in rows]

    def get_latest_snapshots(self, limit: int = 50) -> list[dict]:
        rows = self.conn.execute(
            """SELECT ms.* FROM market_snapshots ms
               INNER JOIN (SELECT ticker, MAX(timestamp) as max_ts FROM market_snapshots GROUP BY ticker) latest
               ON ms.ticker = latest.ticker AND ms.timestamp = latest.max_ts
               ORDER BY ms.volume DESC LIMIT ?""",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]

    # --- Agent logs ---

    def log_cycle(self, **kwargs) -> int:
        kwargs.setdefault("timestamp", _now())
        cols = ", ".join(kwargs.keys())
        placeholders = ", ".join("?" * len(kwargs))
        cur = self.conn.execute(
            f"INSERT INTO agent_logs ({cols}) VALUES ({placeholders})",
            list(kwargs.values()),
        )
        self.conn.commit()
        return cur.lastrowid

    def get_recent_cycles(self, limit: int = 20) -> list[dict]:
        rows = self.conn.execute(
            "SELECT * FROM agent_logs ORDER BY timestamp DESC LIMIT ?", (limit,)
        ).fetchall()
        return [dict(r) for r in rows]

    # --- Stats ---

    def get_stats(self) -> dict:
        p = self.get_portfolio()
        open_count = self.conn.execute("SELECT COUNT(*) FROM trades WHERE settled=0 AND action='buy'").fetchone()[0]
        total_news = self.conn.execute("SELECT COUNT(*) FROM news").fetchone()[0]
        total_snapshots = self.conn.execute("SELECT COUNT(*) FROM market_snapshots").fetchone()[0]
        total_cycles = self.conn.execute("SELECT COUNT(*) FROM agent_logs").fetchone()[0]

        return {
            **p,
            "open_positions": open_count,
            "total_news_articles": total_news,
            "total_market_snapshots": total_snapshots,
            "total_agent_cycles": total_cycles,
            "win_rate": round(p["wins"] / p["total_trades"], 3) if p["total_trades"] > 0 else 0,
        }

    def close(self):
        self.conn.close()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
