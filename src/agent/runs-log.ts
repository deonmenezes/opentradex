// In-memory skill-invocation audit log. Keeps last N entries so the dashboard
// can render an audit panel + the agent can see its own history.

export interface SkillRun {
  runId: string;
  skillId: string;
  skillName: string;
  args: Record<string, unknown>;
  command: string;
  source: 'user' | 'agent' | 'chain';
  status: 'ok' | 'blocked' | 'failed';
  output: string;
  startedAt: number;
  durationMs: number;
  chainId?: string;
}

const MAX_RUNS = 200;
const runs: SkillRun[] = [];

export function recordRun(run: SkillRun): void {
  runs.unshift(run);
  if (runs.length > MAX_RUNS) runs.length = MAX_RUNS;
}

export function getRuns(limit = 50, filter?: 'user' | 'agent' | 'chain'): SkillRun[] {
  const base = filter ? runs.filter((r) => r.source === filter) : runs;
  return base.slice(0, limit);
}

export function getRun(runId: string): SkillRun | undefined {
  return runs.find((r) => r.runId === runId);
}

export function clearRuns(): void {
  runs.length = 0;
}

export function generateRunId(): string {
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
