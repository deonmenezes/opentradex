import { useState, useMemo, useCallback } from 'react';
import type { Skill, SkillRun, InvokeResult, SkillCategory } from '../lib/skills';
import { categoryStyle, renderCommand } from '../lib/skills';

interface SkillsPageProps {
  skills: Skill[];
  runs: SkillRun[];
  onBack: () => void;
  onInvoke: (skill: Skill, args: Record<string, string | number>) => Promise<InvokeResult | null>;
  onRequestConfirm: (skill: Skill, args: Record<string, string | number>) => void;
}

type Tab = 'all' | SkillCategory;

export default function SkillsPage({ skills, runs, onBack, onInvoke, onRequestConfirm }: SkillsPageProps) {
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(skills[0]?.id ?? null);
  const [argValues, setArgValues] = useState<Record<string, string | number>>({});
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<InvokeResult | null>(null);

  const categories: Tab[] = ['all', 'trade', 'inspect', 'analyze', 'setup', 'safety'];
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: skills.length };
    for (const s of skills) c[s.category] = (c[s.category] ?? 0) + 1;
    return c;
  }, [skills]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return skills.filter((s) => {
      if (tab !== 'all' && s.category !== tab) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.exampleInvocations.some((e) => e.toLowerCase().includes(q))
      );
    });
  }, [skills, tab, search]);

  const selected = useMemo(
    () => filtered.find((s) => s.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId]
  );

  const skillRuns = useMemo(
    () => (selected ? runs.filter((r) => r.skillId === selected.id).slice(0, 10) : []),
    [runs, selected]
  );

  const selectSkill = useCallback((s: Skill) => {
    setSelectedId(s.id);
    const defaults: Record<string, string | number> = {};
    for (const a of s.args) if (a.defaultValue !== undefined) defaults[a.name] = a.defaultValue;
    setArgValues(defaults);
    setLastResult(null);
  }, []);

  const run = useCallback(async () => {
    if (!selected) return;
    for (const a of selected.args) {
      if (a.required && (argValues[a.name] === undefined || argValues[a.name] === '')) {
        setLastResult({ runId: '', status: 'blocked', reason: `Missing required field: ${a.name}` });
        return;
      }
    }
    if (selected.requiresConfirmation) {
      onRequestConfirm(selected, argValues);
      return;
    }
    setRunning(true);
    setLastResult(null);
    try {
      const result = await onInvoke(selected, argValues);
      setLastResult(result);
    } finally {
      setRunning(false);
    }
  }, [selected, argValues, onInvoke, onRequestConfirm]);

  const liveCommand = selected ? renderCommand(selected, argValues) : '';

  return (
    <div className="flex-1 flex flex-col bg-bg overflow-hidden" data-testid="skills-page">
      {/* Header */}
      <div className="h-14 md:h-16 bg-surface border-b border-border flex items-center justify-between px-4 md:px-6 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg bg-surface-2 hover:bg-card-hover text-text-dim hover:text-accent transition-colors"
            aria-label="Back"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg md:text-xl font-bold text-text">Agent Skills</h1>
          <span className="text-2xs text-text-dim">Command Center</span>
        </div>
        <div className="hidden md:flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-text-dim">
            <kbd className="px-1.5 py-0.5 rounded bg-surface-2 text-2xs border border-border font-mono">⌘K</kbd>
            <span>quick launch</span>
          </span>
        </div>
      </div>

      {/* Filter bar */}
      <div className="border-b border-border bg-surface/60 px-4 md:px-6 py-3 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {categories.map((c) => {
            const active = tab === c;
            const cs = c === 'all' ? null : categoryStyle[c];
            return (
              <button
                key={c}
                onClick={() => setTab(c)}
                data-testid={`skills-tab-${c}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all flex items-center gap-1.5 ${
                  active
                    ? cs
                      ? `${cs.bg} ${cs.color} ${cs.border} border`
                      : 'bg-accent text-bg'
                    : 'bg-surface-2 text-text-dim hover:text-text border border-border'
                }`}
              >
                {cs && (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={cs.icon} />
                  </svg>
                )}
                {c}
                <span className="text-2xs opacity-70 tabular-nums">{counts[c] ?? 0}</span>
              </button>
            );
          })}
        </div>
        <div className="md:ml-auto md:w-72">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search skills..."
            data-testid="skills-search"
            className="w-full px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      {/* Split layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: skill cards */}
        <div className="w-1/2 md:w-2/5 border-r border-border overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-text-dim text-sm">No skills match this filter.</div>
          ) : (
            <div className="p-3 md:p-4 space-y-2">
              {filtered.map((s) => {
                const cs = categoryStyle[s.category];
                const active = selected?.id === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => selectSkill(s)}
                    data-testid={`skill-card-${s.id}`}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      active
                        ? `${cs.bg} ${cs.border} shadow-lg`
                        : 'bg-surface border-border hover:border-accent/40'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-md ${cs.bg} ${cs.border} border flex items-center justify-center shrink-0`}>
                        <svg className={`w-4 h-4 ${cs.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={cs.icon} />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-bold text-text truncate">{s.name}</span>
                          {s.destructive && (
                            <span className="text-2xs px-1 py-0 rounded bg-danger/20 text-danger font-semibold">
                              !
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text-dim line-clamp-2 mt-0.5">{s.description}</p>
                        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                          {s.args.map((a) => (
                            <span key={a.name} className="text-2xs px-1 py-0 rounded bg-surface-2 text-text-dim border border-border">
                              {a.name}{a.required ? '*' : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: details + runner */}
        <div className="flex-1 overflow-y-auto">
          {!selected ? (
            <div className="h-full flex items-center justify-center text-text-dim text-sm">
              Select a skill to inspect.
            </div>
          ) : (
            <div className="p-4 md:p-6 space-y-4">
              {/* Hero */}
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-lg ${categoryStyle[selected.category].bg} ${categoryStyle[selected.category].border} border flex items-center justify-center shrink-0`}>
                  <svg className={`w-6 h-6 ${categoryStyle[selected.category].color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={categoryStyle[selected.category].icon} />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold text-text">{selected.name}</h2>
                    <span className={`text-2xs font-semibold uppercase px-2 py-0.5 rounded ${categoryStyle[selected.category].bg} ${categoryStyle[selected.category].color}`}>
                      {categoryStyle[selected.category].label}
                    </span>
                    {selected.destructive && (
                      <span className="text-2xs px-2 py-0.5 rounded bg-danger/20 text-danger font-bold uppercase">
                        Destructive
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text-dim mt-2 leading-relaxed">{selected.description}</p>
                  <code className="inline-block mt-2 text-2xs font-mono text-text-dim bg-surface-2 px-1.5 py-0.5 rounded border border-border">
                    id: {selected.id}
                  </code>
                </div>
              </div>

              {/* Runner */}
              <div className="rounded-lg bg-surface border border-border p-4 space-y-3">
                <h3 className="text-sm font-semibold text-text">Run this skill</h3>
                {selected.args.length === 0 ? (
                  <p className="text-xs text-text-dim italic">No arguments required.</p>
                ) : (
                  <div className="space-y-3">
                    {selected.args.map((arg) => (
                      <div key={arg.name}>
                        <label className="block text-xs font-semibold text-text mb-1">
                          {arg.name}
                          {arg.required && <span className="text-danger ml-1">*</span>}
                          <span className="text-2xs text-text-dim font-normal ml-2">{arg.description}</span>
                        </label>
                        {arg.type === 'enum' ? (
                          <select
                            value={String(argValues[arg.name] ?? arg.defaultValue ?? '')}
                            onChange={(e) => setArgValues((p) => ({ ...p, [arg.name]: e.target.value }))}
                            data-testid={`page-arg-${arg.name}`}
                            className="w-full px-3 py-2 rounded-md bg-bg border border-border text-text text-sm focus:outline-none focus:border-accent"
                          >
                            {(arg.enumValues ?? []).map((v) => <option key={v} value={v}>{v}</option>)}
                          </select>
                        ) : (
                          <input
                            type={arg.type === 'number' ? 'number' : 'text'}
                            value={String(argValues[arg.name] ?? '')}
                            onChange={(e) => setArgValues((p) => ({
                              ...p,
                              [arg.name]: arg.type === 'number' ? Number(e.target.value) : e.target.value,
                            }))}
                            placeholder={String(arg.defaultValue ?? '')}
                            data-testid={`page-arg-${arg.name}`}
                            className="w-full px-3 py-2 rounded-md bg-bg border border-border text-text text-sm font-mono focus:outline-none focus:border-accent"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="px-3 py-2 rounded-md bg-bg border border-border">
                  <div className="text-2xs uppercase text-text-dim tracking-wider mb-1">Command preview</div>
                  <code className="text-sm text-accent font-mono break-all">{liveCommand}</code>
                </div>

                <button
                  onClick={run}
                  disabled={running}
                  data-testid="skills-page-run"
                  className={`w-full px-4 py-2.5 rounded-md text-sm font-bold transition-all ${
                    selected.destructive
                      ? 'bg-danger text-bg hover:bg-danger/90'
                      : 'bg-accent text-bg hover:bg-accent/90'
                  } ${running ? 'opacity-60 cursor-wait' : ''}`}
                >
                  {running ? 'Running…' : selected.requiresConfirmation ? 'Confirm & Run' : 'Run'}
                </button>

                {lastResult && (
                  <div
                    data-testid="page-result"
                    className={`px-3 py-2 rounded-md border text-xs ${
                      lastResult.status === 'ok'
                        ? 'bg-accent/10 border-accent/30 text-accent'
                        : lastResult.status === 'blocked'
                          ? 'bg-warning/10 border-warning/30 text-warning'
                          : 'bg-danger/10 border-danger/30 text-danger'
                    }`}
                  >
                    <div className="font-semibold mb-1 capitalize">{lastResult.status}</div>
                    <div className="whitespace-pre-wrap font-mono">{lastResult.output || lastResult.reason}</div>
                  </div>
                )}
              </div>

              {/* Examples */}
              {selected.exampleInvocations.length > 0 && (
                <div className="rounded-lg bg-surface border border-border p-4">
                  <h3 className="text-sm font-semibold text-text mb-2">Example invocations</h3>
                  <ul className="space-y-1">
                    {selected.exampleInvocations.map((e) => (
                      <li key={e} className="text-xs font-mono text-text-dim bg-bg rounded px-2 py-1 border border-border">
                        {e}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recent runs */}
              {skillRuns.length > 0 && (
                <div className="rounded-lg bg-surface border border-border p-4">
                  <h3 className="text-sm font-semibold text-text mb-2">Recent runs</h3>
                  <ul className="space-y-1">
                    {skillRuns.map((r) => (
                      <li key={r.runId} className="text-xs flex items-center gap-2 py-1">
                        <span className={`text-2xs px-1.5 py-0.5 rounded font-semibold uppercase ${
                          r.status === 'ok'      ? 'bg-accent/20 text-accent'   :
                          r.status === 'blocked' ? 'bg-warning/20 text-warning' :
                                                   'bg-danger/20 text-danger'
                        }`}>{r.status}</span>
                        <code className="flex-1 font-mono text-text-dim truncate">{r.command}</code>
                        <span className="text-2xs text-text-dim tabular-nums">{r.durationMs}ms</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
