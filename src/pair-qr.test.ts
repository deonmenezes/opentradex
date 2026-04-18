/**
 * Tests for pair-qr — the QR envelope + render + SVG writer (US-009).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  PAIR_FORMAT_VERSION,
  buildPairEnvelope,
  encodePairEnvelope,
  renderAsciiQR,
  writePairSvg,
  makePairArtifacts,
} from './pair-qr.js';

test('buildPairEnvelope: stamps version + issuedAt and echoes host/token', () => {
  const env = buildPairEnvelope({ host: 'http://10.0.0.5:3210', token: 'tok-abc' });
  assert.equal(env.v, PAIR_FORMAT_VERSION);
  assert.equal(env.host, 'http://10.0.0.5:3210');
  assert.equal(env.token, 'tok-abc');
  assert.equal(typeof env.issuedAt, 'number');
  assert.ok(env.issuedAt > 0);
});

test('buildPairEnvelope: respects caller-supplied issuedAt', () => {
  const env = buildPairEnvelope({ host: 'h', token: 't', issuedAt: 123 });
  assert.equal(env.issuedAt, 123);
});

test('buildPairEnvelope: rejects empty host or token', () => {
  assert.throws(() => buildPairEnvelope({ host: '', token: 't' }));
  assert.throws(() => buildPairEnvelope({ host: 'h', token: '' }));
});

test('encodePairEnvelope: round-trips through JSON.parse with all fields', () => {
  const env = buildPairEnvelope({ host: 'http://192.168.1.5:3210', token: 'secret', issuedAt: 42 });
  const encoded = encodePairEnvelope(env);
  const parsed = JSON.parse(encoded) as typeof env;
  assert.deepEqual(parsed, env);
});

test('renderAsciiQR: returns a non-empty string containing block characters', async () => {
  const ascii = await renderAsciiQR('hello-pair');
  assert.ok(ascii.length > 50, 'ASCII QR should be at least a few rows');
  // qrcode-terminal uses ANSI background escapes to render cells — either escape or block chars accepted.
  assert.ok(/\u001b\[|\u2588|\u2584/.test(ascii), 'ASCII QR should contain ANSI color or unicode block chars');
});

test('writePairSvg: produces an SVG file readable off disk', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pair-qr-svg-'));
  try {
    const path = await writePairSvg('pair-payload', dir);
    assert.ok(existsSync(path));
    const svg = readFileSync(path, 'utf8');
    assert.ok(svg.startsWith('<?xml') || svg.startsWith('<svg'), 'file should be SVG');
    assert.ok(svg.includes('</svg>'), 'SVG should be complete');
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* noop */ }
  }
});

test('makePairArtifacts: returns envelope + encoded + ascii + svg path all together', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pair-qr-all-'));
  try {
    const out = await makePairArtifacts(
      { host: 'http://lan-host:3210', token: 'tk-987654321', issuedAt: 99 },
      dir
    );
    assert.equal(out.envelope.host, 'http://lan-host:3210');
    assert.equal(out.envelope.token, 'tk-987654321');
    assert.equal(out.envelope.issuedAt, 99);
    assert.equal(out.envelope.v, PAIR_FORMAT_VERSION);
    const parsed = JSON.parse(out.encoded);
    assert.deepEqual(parsed, out.envelope);
    assert.ok(out.ascii.length > 50);
    assert.ok(existsSync(out.svgPath));
    assert.equal(out.svgPath, join(dir, 'pair.svg'));
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* noop */ }
  }
});
