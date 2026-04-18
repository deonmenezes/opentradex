#!/usr/bin/env node
/**
 * Copy non-TS assets (persona markdown, etc.) into dist/ so the compiled
 * harness can still read them at runtime.
 */
import { readdirSync, mkdirSync, copyFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const pairs = [
  { from: 'src/ai/persona', to: 'dist/ai/persona' },
];

function copyDir(fromDir, toDir) {
  if (!existsSync(fromDir)) return 0;
  mkdirSync(toDir, { recursive: true });
  let count = 0;
  for (const name of readdirSync(fromDir)) {
    const src = join(fromDir, name);
    const dst = join(toDir, name);
    if (statSync(src).isDirectory()) {
      count += copyDir(src, dst);
    } else {
      copyFileSync(src, dst);
      count++;
    }
  }
  return count;
}

let total = 0;
for (const { from, to } of pairs) {
  const n = copyDir(join(root, from), join(root, to));
  total += n;
  console.log(`[copy-assets] ${from} -> ${to}  (${n} files)`);
}
console.log(`[copy-assets] done, ${total} files copied.`);
