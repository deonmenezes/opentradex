#!/usr/bin/env node
/** OpenTradex CLI */

import { OpenTradex } from '../index.js';
import { createGateway } from '../gateway/index.js';
import type { Exchange } from '../types.js';

const harness = new OpenTradex();

async function main() {
  const [cmd, ...args] = process.argv.slice(2);

  switch (cmd) {
    case 'serve':
    case 'gateway': {
      const port = parseInt(args[0] || process.env.PORT || '3210');
      const gateway = createGateway(harness, { port });
      await gateway.start();
      break;
    }

    case 'scan': {
      const exchange = args[0] as Exchange | undefined;
      const limit = parseInt(args[1] || '20');

      if (exchange) {
        const markets = await harness.exchange(exchange).scan(limit);
        console.log(JSON.stringify(markets, null, 2));
      } else {
        const markets = await harness.scanAll(limit);
        console.log(JSON.stringify(markets, null, 2));
      }
      break;
    }

    case 'search': {
      const query = args[0];
      const exchange = args[1] as Exchange | undefined;

      if (!query) {
        console.error('Usage: opentradex search <query> [exchange]');
        process.exit(1);
      }

      if (exchange) {
        const markets = await harness.exchange(exchange).search(query);
        console.log(JSON.stringify(markets, null, 2));
      } else {
        const markets = await harness.searchAll(query);
        console.log(JSON.stringify(markets, null, 2));
      }
      break;
    }

    case 'quote': {
      const exchange = args[0] as Exchange;
      const symbol = args[1];

      if (!exchange || !symbol) {
        console.error('Usage: opentradex quote <exchange> <symbol>');
        process.exit(1);
      }

      const quote = await harness.exchange(exchange).quote(symbol);
      console.log(JSON.stringify(quote, null, 2));
      break;
    }

    case 'exchanges': {
      console.log(JSON.stringify(harness.exchanges, null, 2));
      break;
    }

    default: {
      console.log(`
OpenTradex - Multi-market AI harness

Usage:
  opentradex serve [port]           Start local gateway (default: 3210)
  opentradex scan [exchange] [n]    Scan markets (all or specific exchange)
  opentradex search <query> [exch]  Search markets
  opentradex quote <exchange> <sym> Get quote with orderbook
  opentradex exchanges              List available exchanges

Exchanges: kalshi, polymarket, tradingview, crypto

Examples:
  opentradex serve 8080
  opentradex scan kalshi 20
  opentradex search "bitcoin"
  opentradex quote crypto BTC
`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
