"""
Open Trademaxxxing - Streamlit dashboard.

Run: streamlit run gossip/dashboard.py

Real-time view of: portfolio, open positions, trade history,
news feed, market snapshots, and agent cycle logs.
All data from SQLite (data/gossip.db).
"""

from __future__ import annotations

import sys
from pathlib import Path

import streamlit as st

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from gossip.db import GossipDB

st.set_page_config(page_title="Open Trademaxxxing", page_icon="📰", layout="wide")

@st.cache_resource
def get_db():
    return GossipDB()

db = get_db()

st.title("Open Trademaxxxing")
st.caption("Autonomous prediction market agent — Kalshi")

# --- Portfolio metrics ---

stats = db.get_stats()

col1, col2, col3, col4, col5, col6 = st.columns(6)
col1.metric("Bankroll", f"${stats['bankroll']:.2f}")
col2.metric("Total P&L", f"${stats['total_pnl']:+.2f}")
col3.metric("Trades", stats["total_trades"])
col4.metric("Win Rate", f"{stats['win_rate']:.0%}" if stats["total_trades"] > 0 else "—")
col5.metric("Open Positions", stats["open_positions"])
col6.metric("Agent Cycles", stats["total_agent_cycles"])

st.divider()

# --- Tabs ---

tab_positions, tab_history, tab_news, tab_markets, tab_agent = st.tabs([
    "Open Positions", "Trade History", "News Feed", "Market Snapshots", "Agent Log"
])

# --- Open Positions ---

with tab_positions:
    positions = db.get_open_positions()
    if positions:
        for p in positions:
            with st.container():
                c1, c2, c3, c4, c5 = st.columns([3, 1, 1, 1, 1])
                c1.write(f"**{p['ticker']}**")
                c2.write(f"{p['side'].upper()} x{p['contracts']}")
                c3.write(f"Entry: ${p['entry_price']:.2f}")
                c4.write(f"Edge: {p['edge']:+.1%}" if p['edge'] else "—")
                c5.write(f"{p['confidence']}" if p.get('confidence') else "—")
                if p.get("title"):
                    st.caption(p["title"])
                if p.get("reasoning"):
                    with st.expander("Reasoning"):
                        st.write(p["reasoning"])
                st.divider()
    else:
        st.info("No open positions")

# --- Trade History ---

with tab_history:
    trades = db.get_trade_history(limit=30)
    if trades:
        for t in trades:
            icon = "✅" if t.get("outcome") == "win" else ("❌" if t.get("outcome") == "loss" else "⏳")
            pnl_str = f"P&L: ${t.get('pnl', 0):+.2f}" if t.get("settled") else "OPEN"
            st.write(f"{icon} **{t['ticker']}** — {t['side'].upper()} x{t['contracts']} @ ${t['entry_price']:.2f} → {pnl_str}")
            if t.get("reasoning"):
                with st.expander("Details"):
                    st.write(f"**Reasoning:** {t['reasoning']}")
                    if t.get("news_trigger"):
                        st.write(f"**News trigger:** {t['news_trigger']}")
                    st.write(f"**Confidence:** {t.get('confidence', '?')} | **Edge:** {t.get('edge', 0):+.1%}")
                    st.write(f"**Time:** {t['timestamp'][:19]}")
    else:
        st.info("No trades yet")

# --- News Feed ---

with tab_news:
    news = db.get_recent_news(limit=50)
    if news:
        st.write(f"**{len(news)} recent articles**")
        for n in news:
            source_badge = f"`{n.get('source', '?')}`"
            keyword_badge = f"`{n.get('keyword', '')}`" if n.get("keyword") else ""
            title = n.get("title", "Untitled")
            url = n.get("url", "")
            snippet = n.get("snippet", "")

            if url:
                st.write(f"{source_badge} {keyword_badge} [{title}]({url})")
            else:
                st.write(f"{source_badge} {keyword_badge} {title}")
            if snippet:
                st.caption(snippet[:200])
    else:
        st.info("No news scraped yet")

# --- Market Snapshots ---

with tab_markets:
    snapshots = db.get_latest_snapshots(limit=30)
    if snapshots:
        import pandas as pd
        df = pd.DataFrame(snapshots)
        cols_to_show = ["ticker", "title", "category", "yes_bid", "yes_ask", "mid", "volume", "open_interest"]
        available_cols = [c for c in cols_to_show if c in df.columns]
        st.dataframe(df[available_cols], use_container_width=True, hide_index=True)
    else:
        st.info("No market snapshots yet — run a scan first")

# --- Agent Log ---

with tab_agent:
    cycles = db.get_recent_cycles(limit=20)
    if cycles:
        for c in cycles:
            status_icon = "🟢" if c.get("status") == "ok" else "🔴"
            ts = (c.get("timestamp") or "")[:19]
            dur = c.get("duration_s", "?")
            st.write(f"{status_icon} **{ts}** — {dur}s | Markets: {c.get('markets_scanned', 0)} | News: {c.get('news_scraped', 0)} | Trades: {c.get('trades_made', 0)}")
            if c.get("output_summary"):
                with st.expander("Output"):
                    st.write(c["output_summary"][:500])
    else:
        st.info("No agent cycles yet")

# --- Refresh ---

st.sidebar.button("🔄 Refresh", use_container_width=True)
st.sidebar.divider()
st.sidebar.write(f"**DB:** {db.db_path}")
st.sidebar.write(f"**News articles:** {stats['total_news_articles']}")
st.sidebar.write(f"**Market snapshots:** {stats['total_market_snapshots']}")
