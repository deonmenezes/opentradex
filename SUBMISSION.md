## You've seen the posts. Someone on X made $1M on Polymarket betting on the election. Another turned $50K into $500K calling the Fed rate decision. We built the agent that does it for you while you sleep.

Open Trademaxxxing is a fully autonomous AI agent that scrapes news, reasons about real-world events, and executes real trades on prediction markets - no human in the loop.

Every 15 minutes, Claude Code is spawned as a subprocess with access to the internet, market data, and a trading account. Its job: figure out what's happening in the world, find where markets are wrong, and trade.

### How it works

1. **Scrape** — Pulls real-time signals from Reddit, Twitter/X, TikTok, Truth Social, and Google News via Apify
2. **Reason** — Claude reads primary sources, cross-references headlines, and estimates true probabilities
3. **Trade** — When it finds edge, it sizes positions using Kelly criterion and executes real trades on Kalshi
4. **Learn** — Writes strategy notes for its future self, building memory across cycles

No rules engine. No hardcoded strategies. Pure reasoning — the same kind those Twitter traders use, just faster and tireless.

### Where the edge comes from

The agent is a news agent at its core. It operationalizes information that retail traders skim. It focuses where the edge is richest: legislative markets (retail doesn't read bill text), confusion premiums (headlines create more uncertainty than the details warrant), and resolution lag (events happen before markets update). During our demo, it spotted a market still open on Pam Bondi's AG departure — days after Trump already fired her — and traded on it live.

### Thesis mode

Have a lead? Type a hypothesis — *"I think tariffs will escalate"* — and the agent researches it, finds relevant markets, and trades on your behalf.

### Built with

- **Claude Code** as the autonomous brain (subprocess orchestration via `--print`)
- **Apify** for real-time news and social media scraping
- **Kalshi API** for live market data and order execution
- **Next.js dashboard** with live agent streaming, portfolio tracking, and multi-source news feeds
- **SQLite** for all state — trades, news, market snapshots, agent logs
