import { useState, useMemo } from 'react';
import type { Skill } from '../lib/skills';
import { categoryStyle, renderCommand } from '../lib/skills';

interface ChainStep {
  id: string;
  skillId: string;
  args: Record<string, string | number>;
  confirmed?: boolean;
}

interface ChainResult {
  skillId: string;
  status: string;
  output: string;
  runId?: string;
  args: Record<string, unknown>;
}

interface ChainBuilderProps {
  skills: Skill[];
  onClose?: () => void;
}

const API_BASE = (import.meta as unknown as { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE || '/api';

// Chain Builder (US-009). Lets the user queue 2-6 skills, preview a dry-run,
// then execute them sequentially. Destructive skills must be pre-confirmed via
// the checkbox since the chain runs through without per-step modal prompts.
// Template token: any string arg containing {previous.output} is substituted
// at runtime with the previous step's output (truncated to 200 chars).
export default function ChainBuilder({ skills, onClose }: ChainBuilderProps) {
  const [steps, setSteps] = useState<ChainStep[]>([]);
  const [running, setRunning] = useState(false);
  const [dryRunResults, setDryRunResults] = useState<ChainResult[] | null>(null);
  const [liveResults, setLiveResults] = useState<ChainResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const addStep = (skillId: string) => {
    if (steps.length >= 6) return;
    const skill = skills.find((s) => s.id === skillId);
    if (!skill) return;
    const defaults: Record<string, string | number> = {};
    for (const a of skill.args) if (a.defaultValue !== undefined) defaults[a.name] = a.defaultValue;
    setSteps((prev) => [...prev, { id: `step-${Date.now()}-${prev.length}`, skillId, args: defaults, confirmed: false }]);
    setDryRunResults(null);
    setLiveResults([]);
  };

  const removeStep = (id: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== id));
    setDryRunResults(null);
  };

  const moveStep = (id: string, dir: -1 | 1) => {
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  };

  const updateStepArg = (id: string, argName: string, value: string | number) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, args: { ...s.args, [argName]: value } } : s)));
    setDryRunResults(null);
  };

  const setStepConfirmed = (id: string, v: boolean) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, confirmed: v } : s)));
  };

  const resolvedPreview = useMemo(() => {
    return steps.map((step) => {
      const skill = skills.find((s) => s.id === step.skillId);
      if (!skill) return { step, skill: null, command: '<unknown>' };
      return { step, skill, command: renderCommand(skill, step.args) };
    });
  }, [steps, skills]);

  const submit = async (dryRun: boolean) => {
    if (steps.length === 0) return;
    setRunning(true);
    setError(null);
    if (dryRun) setDryRunResults(null);
    else setLiveResults([]);
    try {
      const r = await fetch(`${API_BASE}/agent/chains/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          steps: steps.map((s) => ({ skillId: s.skillId, args: s.args, confirmed: s.confirmed === true })),
          dryRun,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      if (dryRun) setDryRunResults(d.steps ?? []);
      else setLiveResults(d.steps ?? []);
    } catch (e) {
      setError(`Chain failed: ${(e as Error).message}`);
    } finally {
      setRunning(false);
    }
  };

  // Fallback when no skills loaded yet
  if (skills.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-surface border border-border rounded-xl p-6 text-text-dim">
          Loading skills…
        </div>
      </div>
    );
  }

  const hasBlockedStep = liveResults.some((r) => r.status === 'blocked' || r.status === 'failed');

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" data-testid="chain-builder">
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-3 border-b border-border flex items-center gap-3">
          <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <div className="flex-1">
            <h2 className="text-base font-bold text-text">Chain Builder</h2>
            <p className="text-2xs text-text-dim">Queue 2-6 skills in sequence. Destructive ones must be pre-confirmed.</p>
          </div>
          <button onClick={onClose} data-testid="chain-close"
            className="p-1.5 rounded-lg hover:bg-surface-2 text-text-dim hover:text-text transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body: split — steps left, live results right */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-0">
          {/* Left: step list + skill picker */}
          <div className="p-4 border-r border-border space-y-3">
            <div className="text-2xs text-text-dim uppercase tracking-wider font-semibold">Steps ({steps.length}/6)</div>
            {steps.length === 0 && (
              <div className="p-4 rounded-lg border border-dashed border-border text-center text-text-dim text-xs">
                Add steps from the skill list below. First step's output becomes
                available as <code className="text-accent">{'{previous.output}'}</code> in step 2's args.
              </div>
            )}
            {steps.map((step, i) => {
              const skill = skills.find((s) => s.id === step.skillId);
              if (!skill) return null;
              const cat = categoryStyle[skill.category];
              const liveRes = liveResults[i];
              return (
                <div key={step.id} data-testid={`chain-step-${i}`}
                  className={`rounded-lg border p-2.5 ${
                    liveRes?.status === 'ok' ? 'border-accent/40 bg-accent/5' :
                    liveRes?.status === 'failed' || liveRes?.status === 'blocked' ? 'border-danger/40 bg-danger/5' :
                    'border-border bg-surface-2/40'
                  }`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-2xs text-text-dim font-mono w-4">{i + 1}.</span>
                    <div className={`w-5 h-5 rounded ${cat.bg} ${cat.border} border flex items-center justify-center shrink-0`}>
                      <svg className={`w-3 h-3 ${cat.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={cat.icon} />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-text flex-1 truncate">{skill.name}</span>
                    {skill.destructive && (
                      <span className="text-2xs px-1 py-0 rounded bg-danger/20 text-danger font-semibold uppercase">
                        Destructive
                      </span>
                    )}
                    <button onClick={() => moveStep(step.id, -1)} disabled={i === 0} data-testid={`chain-up-${i}`}
                      className="text-text-dim hover:text-text disabled:opacity-30 disabled:cursor-not-allowed p-0.5">↑</button>
                    <button onClick={() => moveStep(step.id, 1)} disabled={i === steps.length - 1} data-testid={`chain-down-${i}`}
                      className="text-text-dim hover:text-text disabled:opacity-30 disabled:cursor-not-allowed p-0.5">↓</button>
                    <button onClick={() => removeStep(step.id)} data-testid={`chain-remove-${i}`}
                      className="text-text-dim hover:text-danger p-0.5">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  {skill.args.length > 0 && (
                    <div className="space-y-1.5 mt-2">
                      {skill.args.map((a) => (
                        <div key={a.name} className="flex items-center gap-2">
                          <label className="text-2xs text-text-dim w-20 shrink-0">{a.name}</label>
                          {a.type === 'enum' ? (
                            <select value={String(step.args[a.name] ?? a.defaultValue ?? '')}
                              onChange={(e) => updateStepArg(step.id, a.name, e.target.value)}
                              className="flex-1 text-xs bg-bg border border-border rounded px-2 py-1 text-text">
                              <option value="">—</option>
                              {a.enumValues?.map((v) => <option key={v} value={v}>{v}</option>)}
                            </select>
                          ) : (
                            <input type={a.type === 'number' ? 'number' : 'text'}
                              value={String(step.args[a.name] ?? '')}
                              placeholder={a.description}
                              onChange={(e) => updateStepArg(step.id, a.name, a.type === 'number' ? Number(e.target.value) : e.target.value)}
                              data-testid={`chain-arg-${i}-${a.name}`}
                              className="flex-1 text-xs bg-bg border border-border rounded px-2 py-1 text-text font-mono" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {skill.destructive && (
                    <label className="flex items-center gap-2 mt-2 text-2xs text-text-dim cursor-pointer">
                      <input type="checkbox" checked={step.confirmed === true}
                        onChange={(e) => setStepConfirmed(step.id, e.target.checked)}
                        data-testid={`chain-confirm-${i}`}
                        className="accent-danger" />
                      <span>Pre-confirmed (chain will not prompt)</span>
                    </label>
                  )}
                  {liveRes && (
                    <div className={`mt-2 p-1.5 rounded text-2xs font-mono ${
                      liveRes.status === 'ok' ? 'bg-accent/10 text-accent' :
                      liveRes.status === 'blocked' ? 'bg-warning/10 text-warning' :
                      'bg-danger/10 text-danger'
                    }`}>
                      <span className="font-semibold uppercase mr-1">[{liveRes.status}]</span>
                      {liveRes.output.slice(0, 120)}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Skill picker */}
            <div className="mt-3 pt-3 border-t border-border">
              <div className="text-2xs text-text-dim uppercase tracking-wider mb-1.5">Add step</div>
              <div className="grid grid-cols-2 gap-1">
                {skills.slice(0, 10).map((s) => {
                  const cat = categoryStyle[s.category];
                  return (
                    <button key={s.id}
                      onClick={() => addStep(s.id)}
                      disabled={steps.length >= 6}
                      data-testid={`chain-add-${s.id}`}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded text-2xs hover:bg-surface-2 transition-colors text-left ${
                        steps.length >= 6 ? 'opacity-40 cursor-not-allowed' : ''
                      }`}>
                      <div className={`w-3.5 h-3.5 rounded ${cat.bg} ${cat.border} border flex items-center justify-center shrink-0`}>
                        <svg className={`w-2 h-2 ${cat.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={cat.icon} />
                        </svg>
                      </div>
                      <span className="text-text truncate">{s.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: dry-run preview / live results */}
          <div className="p-4 space-y-3">
            <div className="text-2xs text-text-dim uppercase tracking-wider font-semibold">
              {liveResults.length > 0 ? 'Results' : dryRunResults ? 'Dry Run Preview' : 'Preview'}
            </div>

            {resolvedPreview.length === 0 ? (
              <div className="text-xs text-text-dim italic">No steps yet.</div>
            ) : (
              <div className="space-y-2">
                {resolvedPreview.map((p, i) => (
                  <div key={i} className="p-2 rounded bg-bg border border-border">
                    <div className="text-2xs text-text-dim mb-0.5">Step {i + 1}: {p.skill?.name ?? 'unknown'}</div>
                    <code className="block text-2xs font-mono text-text break-all">{p.command}</code>
                    {dryRunResults?.[i] && (
                      <div className="mt-1 text-2xs text-accent font-mono">{dryRunResults[i].output}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="p-2 rounded bg-danger/10 border border-danger/30 text-2xs text-danger" data-testid="chain-error">
                {error}
              </div>
            )}

            {hasBlockedStep && (
              <div className="p-2 rounded bg-warning/10 border border-warning/30 text-2xs text-warning">
                Chain stopped early. Review the blocked/failed step and pre-confirm destructive steps.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border flex items-center gap-2">
          <span className="text-2xs text-text-dim flex-1">
            {steps.length > 0 && `${steps.length} step${steps.length === 1 ? '' : 's'} · destructive pre-confirmed: ${steps.filter((s) => s.confirmed).length}/${steps.filter((s) => {
              const sk = skills.find((k) => k.id === s.skillId);
              return sk?.destructive;
            }).length}`}
          </span>
          <button
            onClick={() => submit(true)}
            disabled={running || steps.length === 0}
            data-testid="chain-dryrun"
            className="px-3 py-1.5 rounded text-xs bg-surface-2 border border-border text-text hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Dry Run
          </button>
          <button
            onClick={() => submit(false)}
            disabled={running || steps.length === 0}
            data-testid="chain-run"
            className="px-3 py-1.5 rounded text-xs bg-accent text-bg font-semibold hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {running ? 'Running…' : 'Run Chain'}
          </button>
        </div>
      </div>
    </div>
  );
}
