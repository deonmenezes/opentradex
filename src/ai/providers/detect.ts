/**
 * Shared helpers for detecting CLI binaries on the user's PATH.
 *
 * Keeping this in one place means the CLI providers (claude-cli, opencode-cli,
 * gemini-cli, ollama) all share the same lookup rules, and the /api/ai/cli-detect
 * endpoint can return a consistent shape.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** Return the list of candidate file names to try for a given CLI on this platform. */
export function binaryCandidates(name: string): string[] {
  if (process.platform === 'win32') {
    return [`${name}.cmd`, `${name}.exe`, `${name}.bat`, name];
  }
  return [name];
}

/** Probe $PATH for any of the candidate filenames. Returns the first hit or null. */
export function findOnPath(candidates: string[]): string | null {
  const sep = process.platform === 'win32' ? ';' : ':';
  const pathDirs = (process.env.PATH || '').split(sep);
  for (const dir of pathDirs) {
    if (!dir) continue;
    for (const name of candidates) {
      const full = join(dir, name);
      if (existsSync(full)) return full;
    }
  }
  return null;
}

/** Convenience: findOnPath(binaryCandidates(name)). */
export function detectBinary(name: string): string | null {
  return findOnPath(binaryCandidates(name));
}
