import { useMemo, useState } from 'react';
import type { SkillRun } from '../lib/skills';

interface RunsAuditPanelProps {
  runs: SkillRun[];
  maxItems?: number;
}

const statusDot: Record<SkillRun['status'], string> = {
  ok: 'bg-accent',
  blocked: 'bg-warning',
  failed: 'bg-danger',
};

const sourceAbbrev: Record<SkillRun['source'], string> = {
  user: 'U',
  agent: 'A',
  chain: 'C',
};

// Compact audit panel for the RightSidebar (US-010). Shows last N skill runs
// with status dot + skill name + duration. Expandable to see full command/output.
export default function RunsAuditPanel({ runs, maxItems = 15 }: RunsAuditPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const limited = useMemo(() => runs.slice(0, maxItems), [runs, maxItems]);

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60_000) return `${Math.floor(diff / 1000)}s`;
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
    return `${Math.floor(diff / 3_600_000)}h`;
  };

  if (runs.length === 0) {
    return (
      <div className="px-3 py-3 border-b border-border">
        <div className="flex items-center gap-1.5 mb-1">
          <svg className="w-3.5 h-3.5 text-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <h3 className="text-2xs font-semibold text-text-dim uppercase tracking-wider">Audit Log</h3>
        </div>
        <p className="text-2xs text-text-dim/70 italic">No skill runs yet.</p>
      </div>
    );
  }

  return (
    <div className="border-b border-border">
      <div className="px-3 pt-2 pb-1 flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5 text-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        <h3 className="text-2xs font-semibold text-text-dim uppercase tracking-wider flex-1">Audit Log</h3>
        <span className="text-2xs text-text-dim tabular-nums">{runs.length}</span>
      </div>
      <div className="max-h-56 overflow-y-auto" data-testid="audit-panel">
        {limited.map((r) => {
          const isOpen = expanded === r.runId;
          return (
            <div key={r.runId} className="border-t border-border/50">
              <button
                onClick={() => setExpanded(isOpen ? null : r.runId)}
                data-testid={`audit-row-${r.runId}`}
                className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-surface-2 transition-colors text-left"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${statusDot[r.status]}`} />
                <span className="text-2xs text-text-dim font-mono w-4 text-center">{sourceAbbrev[r.source]}</span>
                <span className="text-xs text-text truncate flex-1">{r.skillName}</span>
                <span className="text-2xs text-text-dim tabular-nums">{r.durationMs}ms</span>
                <span className="text-2xs text-text-dim tabular-nums w-6 text-right">{formatTime(r.startedAt)}</span>
              </button>
              {isOpen && (
                <div className="px-3 pb-2 bg-bg/40">
                  <code className="block text-2xs font-mono text-text-dim mb-1 break-all">{r.command}</code>
                  {r.output && (
                    <pre className="text-2xs text-text/90 font-mono bg-bg rounded px-2 py-1 max-h-24 overflow-auto whitespace-pre-wrap border border-border">
                      {r.output}
                    </pre>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
