# OpenTradex

Lightweight AI harness connecting prediction markets, crypto, and stocks. Zero dependencies, runs anywhere Node 18+ or Bun works.

## Install

```bash
npm install opentradex
# or
bun add opentradex
```

## Quick Start

### As a Library

```typescript
import { createHarness } from 'opentradex';

const harness = createHarness();

// Scan all markets
const markets = await harness.scanAll(10);

// Search across exchanges
const results = await harness.searchAll('bitcoin');

// Get specific exchange
const kalshi = harness.exchange('kalshi');
const quote = await kalshi.quote('TICKER');
```

### Local Gateway

```bash
# Start the gateway
npx opentradex serve

# Or with custom port
npx opentradex serve 8080
```

Then hit the API:

```bash
curl http://localhost:3210/scan
curl http://localhost:3210/search?q=bitcoin
curl http://localhost:3210/quote?exchange=crypto&symbol=BTC
```

### CLI

```bash
opentradex scan                    # Scan all markets
opentradex scan kalshi 20          # Scan Kalshi, limit 20
opentradex search "tariffs"        # Search across all
opentradex quote crypto BTC        # Get BTC quote + orderbook
```

## Supported Exchanges

| Exchange | Type | Data Source |
|----------|------|-------------|
| `kalshi` | Prediction Market | Kalshi API |
| `polymarket` | Prediction Market | Gamma + CLOB API |
| `tradingview` | Stocks/ETFs | Yahoo Finance |
| `crypto` | Cryptocurrency | CoinGecko + Kraken |

## API Reference

### Gateway Endpoints

| Endpoint | Params | Description |
|----------|--------|-------------|
| `GET /` | - | Health check |
| `GET /scan` | `exchange?`, `limit?` | Scan markets |
| `GET /search` | `q`, `exchange?` | Search markets |
| `GET /quote` | `exchange`, `symbol` | Get quote + orderbook |
| `GET /orderbook` | `exchange`, `symbol` | Raw orderbook |

### Library API

```typescript
// Create harness with config
const harness = createHarness({
  kalshi: { demo: true },  // Use demo API
});

// Get connector
const connector = harness.exchange('kalshi');

// Connector methods
await connector.scan(limit);
await connector.search(query);
await connector.quote(symbol);
await connector.orderbook?.(symbol);
```

## Architecture

```
opentradex/
├── src/
│   ├── index.ts          # Main harness class
│   ├── types.ts          # TypeScript types
│   ├── markets/
│   │   ├── base.ts       # HTTP utilities
│   │   ├── kalshi.ts     # Kalshi connector
│   │   ├── polymarket.ts # Polymarket connector
│   │   ├── tradingview.ts # Stocks connector
│   │   └── crypto.ts     # Crypto connector
│   ├── gateway/
│   │   └── index.ts      # HTTP gateway server
│   └── bin/
│       └── cli.ts        # CLI entry point
```

## For AI Agents

This harness is designed to be called by AI agents (Claude, GPT, etc.):

1. **Start gateway**: `npx opentradex serve`
2. **Agent makes HTTP calls** to `localhost:3210`
3. **All responses are JSON** for easy parsing

Or use as a library directly in your agent code.

## License

MIT
