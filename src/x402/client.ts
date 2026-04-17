/**
 * x402 client — wraps global fetch so the agent auto-pays on HTTP 402.
 *
 * Usage:
 *   const res = await paidFetch('https://api.provider/premium');
 *
 * When no AGENT_PRIVATE_KEY is configured, this is a pass-through to the
 * built-in fetch. When configured, it uses x402-fetch to settle USDC
 * micropayments via the CDP Facilitator on Base Sepolia (or mainnet).
 */

import { getAgentAccount, loadX402Settings, usdcBaseUnits } from './wallet.js';
import { recordPayment } from './ledger.js';

type FetchFn = typeof fetch;

let wrappedFetch: FetchFn | null = null;
let initPromise: Promise<FetchFn> | null = null;

async function buildWrapped(): Promise<FetchFn> {
  const settings = loadX402Settings();
  const account = await getAgentAccount();
  if (!settings.enabled || !account) return globalThis.fetch.bind(globalThis);

  try {
    // x402-fetch exports `wrapFetchWithPayment(fetch, account, maxUsd?)` that
    // intercepts 402 responses, signs an EIP-3009 USDC transfer, and retries.
    const mod = await import('x402-fetch');
    const wrapFetchWithPayment =
      (mod as { wrapFetchWithPayment?: (f: FetchFn, a: unknown, max?: bigint) => FetchFn })
        .wrapFetchWithPayment;
    if (typeof wrapFetchWithPayment !== 'function') {
      console.warn('[x402] wrapFetchWithPayment missing from x402-fetch, disabling');
      return globalThis.fetch.bind(globalThis);
    }
    const inner = wrapFetchWithPayment(
      globalThis.fetch.bind(globalThis),
      account,
      usdcBaseUnits(settings.maxPaymentUsd ?? 1)
    );
    // Wrap once more so we can log to the ledger without caring about payload shape.
    return (async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
      const res = await inner(input as Parameters<FetchFn>[0], init);
      const paymentHeader = res.headers.get('x-payment-response');
      if (paymentHeader) {
        try {
          const decoded = JSON.parse(Buffer.from(paymentHeader, 'base64').toString('utf-8'));
          recordPayment({
            direction: 'out',
            url,
            amountUsd: Number(decoded?.amount ?? 0) / 1_000_000,
            txHash: decoded?.transaction,
            chain: settings.chain,
            payer: decoded?.payer,
            recipient: decoded?.payTo,
          });
        } catch {
          recordPayment({ direction: 'out', url, amountUsd: 0, chain: settings.chain, note: 'payment-header-opaque' });
        }
      }
      return res;
    }) as FetchFn;
  } catch (err) {
    console.warn('[x402] failed to load x402-fetch, disabling:', (err as Error).message);
    return globalThis.fetch.bind(globalThis);
  }
}

async function getWrapped(): Promise<FetchFn> {
  if (wrappedFetch) return wrappedFetch;
  if (!initPromise) {
    initPromise = buildWrapped().then((f) => {
      wrappedFetch = f;
      return f;
    });
  }
  return initPromise;
}

/** Drop-in fetch replacement that auto-pays 402 responses when configured. */
export const paidFetch: FetchFn = (async (input, init) => {
  const fn = await getWrapped();
  return fn(input as Parameters<FetchFn>[0], init);
}) as FetchFn;

/** True if an agent signer is loaded and x402 is active for outbound calls. */
export async function isPaymentsActive(): Promise<boolean> {
  const account = await getAgentAccount();
  return Boolean(account);
}
