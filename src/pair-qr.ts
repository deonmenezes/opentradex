/**
 * Pair QR for mobile — US-009.
 *
 * Encodes the JSON payload `{host, token}` as an ASCII QR for the terminal
 * and an SVG QR on disk at ~/.opentradex/pair.svg. The mobile app's
 * "Scan QR" flow decodes the same JSON and uses it to point at the gateway.
 *
 * Payload shape (v1):
 *   {
 *     "v": 1,                           // version so we can evolve the format
 *     "host": "http://192.168.1.5:3210",
 *     "token": "…bearer…",
 *     "issuedAt": 1713331200000          // ms epoch — mobile can show freshness
 *   }
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import QRCode from 'qrcode';
// qrcode-terminal is CJS + ships no types; createRequire is the ESM-safe bridge.
const require_ = createRequire(import.meta.url);
const qrcodeTerminal = require_('qrcode-terminal') as {
  generate: (input: string, opts: { small?: boolean }, cb: (out: string) => void) => void;
};

export const PAIR_FORMAT_VERSION = 1;

export interface PairPayload {
  host: string;
  token: string;
  /** Millisecond epoch timestamp. Defaults to Date.now() in buildPairPayload. */
  issuedAt?: number;
}

export interface PairEnvelope {
  v: number;
  host: string;
  token: string;
  issuedAt: number;
}

/** Build the JSON envelope shown in the QR. Pure — safe to unit-test. */
export function buildPairEnvelope(payload: PairPayload): PairEnvelope {
  if (!payload.host) throw new Error('pair payload: host is required');
  if (!payload.token) throw new Error('pair payload: token is required');
  return {
    v: PAIR_FORMAT_VERSION,
    host: payload.host,
    token: payload.token,
    issuedAt: payload.issuedAt ?? Date.now(),
  };
}

/** Stringify + encode the envelope for QR input. */
export function encodePairEnvelope(env: PairEnvelope): string {
  return JSON.stringify(env);
}

/** Render a compact ASCII QR for the current terminal. Returns the rendered string. */
export function renderAsciiQR(text: string): Promise<string> {
  return new Promise((resolve) => {
    qrcodeTerminal.generate(text, { small: true }, (out: string) => resolve(out));
  });
}

/** Write an SVG QR to disk. Returns the absolute path written. */
export async function writePairSvg(text: string, dir: string, filename = 'pair.svg'): Promise<string> {
  const svg = await QRCode.toString(text, { type: 'svg', errorCorrectionLevel: 'M', margin: 2, width: 512 });
  const path = join(dir, filename);
  writeFileSync(path, svg, 'utf8');
  return path;
}

/**
 * One-shot helper for runFastOnboard — builds the envelope, writes the SVG,
 * and returns { envelope, encoded, ascii, svgPath } so callers can decide how
 * to display / log them.
 */
export async function makePairArtifacts(
  payload: PairPayload,
  dir: string
): Promise<{ envelope: PairEnvelope; encoded: string; ascii: string; svgPath: string }> {
  const envelope = buildPairEnvelope(payload);
  const encoded = encodePairEnvelope(envelope);
  const [ascii, svgPath] = await Promise.all([
    renderAsciiQR(encoded),
    writePairSvg(encoded, dir),
  ]);
  return { envelope, encoded, ascii, svgPath };
}
