/** Base HTTP utilities for market connectors */

import { paidFetch } from '../x402/client.js';

export async function httpGet<T>(url: string, headers?: Record<string, string>): Promise<T> {
  const res = await paidFetch(url, {
    headers: { 'Accept': 'application/json', ...headers },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => 'unknown error')}`);
  }
  return res.json() as Promise<T>;
}

export async function httpPost<T>(
  url: string,
  body: unknown,
  headers?: Record<string, string>
): Promise<T> {
  const res = await paidFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => 'unknown error')}`);
  }
  return res.json() as Promise<T>;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      if (attempt < maxAttempts - 1) {
        await sleep(baseDelay * Math.pow(2, attempt));
      }
    }
  }
  throw lastError;
}
