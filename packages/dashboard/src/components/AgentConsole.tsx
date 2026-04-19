import { useState, useMemo } from 'react';
import type { SkillRun } from '../lib/skills';

interface AgentConsoleProps {
  runs: SkillRun[];
  onReplay?: (run: SkillRun) => void;
}

const statusStyle: Record<SkillRun['status'], { color: string; bg: string; label: string }> = {
  ok:      { color: 'text-accent',  bg: 'bg-accent/10 border-accent/30',   label: 'OK' },
  blocked: { color: 'text-warning', bg: 'bg-warning/10 border-warning/30', label: 'BLOCKED' },
  failed:  { color: 'text-danger',  bg: 'bg-danger/10 border-danger/30',   label: 'FAILED' },
};

const sourceStyle: Record<SkillRun['source'], string> = {
  user:  'bg-sky-500/20 text-sky-300',
  agent: 'bg-purple-500/20 text-purple-300',
  chain: 'bg-amber-500/20 text-amber-300',
};

// Floating agent activity panel (US-006). Shows live run log; collapses to a pill.
// Click a run to see full output, replay, or inspect args.
export default function AgentConsole({ runs, onReplay }: AgentConsoleProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'user' | 'agent' | 'chain'>('all');

  const filtered = useMemo(
    () => (filter === 'all' ? runs : runs.filter((r) => r.source === filter)),
    [runs, filter]
  );

  const lastRun = runs[0];
  const okCount = runs.filter((r) => r.status === 'ok').length;
  const blockedCount = runs.filter((r) => r.status === 'blocked').length;
  const failedCount = runs.filter((r) => r.status === 'failed').length;

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    return new Date(ts).toLocaleTimeString();
  };

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        data-testid="agent-console-pill"
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-full bg-surface border border-border shadow-lg hover:border-accent transition-colors"
      >
        <div className="relative">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
        </div>
        <span className="text-xs font-semibold text-text">Agent</span>
        {runs.length > 0 && (
          <span className="text-2xs px-1.5 py-0.5 rounded bg-accent/20 text-accent tabular-nums">
            {runs.length}
          </span>
        )}
        {lastRun && (
          <span className={`text-2xs ${statusStyle[lastRun.status].color} max-w-[12rem] truncate hidden sm:block`}>
            {lastRun.skillName}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      data-testid="agent-console"
      className="fixed bottom-4 right-4 z-50 w-[380px] max-w-[calc(100vw-2rem)] max-h-[70vh] flex flex-col rounded-xl bg-surface border border-border shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-surface-2/50">
        <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
        <h2 className="text-sm font-bold text-text flex-1">Agent Console</h2>
        <div className="flex items-center gap-1 text-2xs">
          {okCount > 0 && <span className="px-1.5 py-0.5 rounded bg-accent/20 text-accent">{okCount} ok</span>}
          {blockedCount > 0 && <span className="px-1.5 py-0.5 rounded bg-warning/20 text-warning">{blockedCount} blk</span>}
          {failedCount > 0 && <span className="px-1.5 py-0.5 rounded bg-danger/20 text-danger">{failedCount} err</span>}
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1 rounded hover:bg-card-hover text-text-dim hover:text-text"
          aria-label="Collapse"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border">
        {(['all', 'user', 'agent', 'chain'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2 py-0.5 rounded text-2xs font-semibold capitalize transition-colors ${
              filter === f
                ? 'bg-accent/20 text-accent border border-accent/30'
                : 'bg-surface-2 text-text-dim border border-transparent hover:text-text'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Run list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-4 py-10 text-center text-text-dim text-xs">
            {runs.length === 0 ? 'No skill runs yet. Press ⌘K to start.' : `No ${filter} runs.`}
          </div>
        ) : (
          filtered.map((run) => {
            const s = statusStyle[run.status];
            const expanded = expandedRunId === run.runId;
            return (
              <div
                key={run.runId}
                data-testid={`run-${run.runId}`}
                className="border-b border-border last:border-b-0"
              >
                <button
                  onClick={() => setExpandedRunId(expanded ? null : run.runId)}
                  className="w-full px-3 py-2 flex items-start gap-2 hover:bg-surface-2/60 transition-colors text-left"
                >
                  <span className={`mt-0.5 text-2xs px-1.5 py-0.5 rounded border font-semibold ${s.bg} ${s.color} tabular-nums w-16 text-center shrink-0`}>
                    {s.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-text truncate">{run.skillName}</span>
                      <span className={`text-2xs px-1 py-0 rounded ${sourceStyle[run.source]}`}>{run.source}</span>
                    </div>
                    <code className="text-2xs text-text-dim font-mono truncate block mt-0.5">{run.command}</code>
                    <div className="flex items-center gap-2 text-2xs text-text-dim/80 mt-0.5">
                      <span>{formatTime(run.startedAt)}</span>
                      <span>·</span>
                      <span className="tabular-nums">{run.durationMs}ms</span>
                    </div>
                  </div>
                  <svg
                    className={`w-3.5 h-3.5 text-text-dim shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                {expanded && (
                  <div className="px-3 pb-3 pt-1 bg-bg/50 space-y-2">
                    {Object.keys(run.args).length > 0 && (
                      <div>
                        <div className="text-2xs uppercase text-text-dim tracking-wider mb-1">Args</div>
                        <pre className="text-2xs text-text font-mono bg-bg rounded p-2 border border-border overflow-x-auto">
                          {JSON.stringify(run.args, null, 2)}
                        </pre>
                      </div>
                    )}
                    {run.output && (
                      <div>
                        <div className="text-2xs uppercase text-text-dim tracking-wider mb-1">Output</div>
                        <pre className="text-2xs text-text font-mono bg-bg rounded p-2 border border-border max-h-40 overflow-auto whitespace-pre-wrap">
                          {run.output}
                        </pre>
                      </div>
                    )}
                    {onReplay && (
                      <button
                        onClick={() => onReplay(run)}
                        className="w-full text-xs font-semibold py-1.5 rounded bg-accent/20 text-accent border border-accent/30 hover:bg-accent/30 transition-colors"
                      >
                        Replay
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
