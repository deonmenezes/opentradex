// Dashboard-side skill types mirroring src/agent/skills-registry.ts + runs-log.ts.
// Kept structurally identical so the JSON from /api/agent/skills parses cleanly.

export type SkillCategory = 'trade' | 'inspect' | 'setup' | 'safety' | 'analyze';

export interface SkillArgField {
  name: string;
  type: 'string' | 'number' | 'enum';
  required: boolean;
  description: string;
  enumValues?: string[];
  defaultValue?: string | number;
}

export interface Skill {
  id: string;
  name: string;
  category: SkillCategory;
  description: string;
  args: SkillArgField[];
  destructive: boolean;
  requiresConfirmation: boolean;
  confirmWord?: string;
  exampleInvocations: string[];
  commandTemplate: string;
}

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

export interface InvokeResult {
  runId: string;
  status: 'ok' | 'blocked' | 'failed';
  output?: string;
  reason?: string;
  confirmWord?: string;
  durationMs?: number;
  action?: string;
}

export const categoryStyle: Record<SkillCategory, { label: string; color: string; bg: string; border: string; icon: string }> = {
  trade:   { label: 'Trade',   color: 'text-accent',  bg: 'bg-accent/10',  border: 'border-accent/30',  icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
  inspect: { label: 'Inspect', color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/30', icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' },
  analyze: { label: 'Analyze', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  setup:   { label: 'Setup',   color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/30', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
  safety:  { label: 'Safety',  color: 'text-danger',  bg: 'bg-danger/10',  border: 'border-danger/30',  icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
};

export function renderCommand(skill: Skill, args: Record<string, string | number>): string {
  let cmd = skill.commandTemplate;
  for (const field of skill.args) {
    const value = args[field.name] ?? field.defaultValue ?? '';
    cmd = cmd.replace(new RegExp(`\\{${field.name}\\}`, 'g'), String(value));
  }
  return cmd.trim();
}

// Fuzzy scoring: contiguous substring beats scattered chars. Used by the command palette.
export function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (!q) return 0.5;
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (t.includes(q)) return 60;
  let qi = 0;
  let score = 0;
  let streak = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      qi++;
      streak++;
      score += 1 + streak;
    } else {
      streak = 0;
    }
  }
  return qi === q.length ? score : 0;
}
