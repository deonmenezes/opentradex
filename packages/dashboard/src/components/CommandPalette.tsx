import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { Skill, InvokeResult } from '../lib/skills';
import { renderCommand, fuzzyScore, categoryStyle } from '../lib/skills';

interface CommandPaletteProps {
  open: boolean;
  skills: Skill[];
  recentRuns: string[]; // skill IDs, most-recent first
  onClose: () => void;
  onInvoke: (skill: Skill, args: Record<string, string | number>) => Promise<InvokeResult | null>;
  onRequestConfirm: (skill: Skill, args: Record<string, string | number>) => void;
}

type ViewStep = 'list' | 'args';

export default function CommandPalette({
  open,
  skills,
  recentRuns,
  onClose,
  onInvoke,
  onRequestConfirm,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const [step, setStep] = useState<ViewStep>('list');
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [argValues, setArgValues] = useState<Record<string, string | number>>({});
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<InvokeResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus search on open, reset on close
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      setStep('list');
      setSelectedSkill(null);
      setArgValues({});
      setLastResult(null);
      const t = setTimeout(() => inputRef.current?.focus(), 40);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Rank: fuzzy on name + description + example invocations. Boost recent runs.
  const ranked = useMemo(() => {
    const q = query.trim();
    const recentBoost = new Map<string, number>();
    recentRuns.slice(0, 10).forEach((id, i) => recentBoost.set(id, 30 - i * 3));

    const scored = skills.map((s) => {
      const nameScore = fuzzyScore(q, s.name) * 2;
      const idScore = fuzzyScore(q, s.id) * 1.5;
      const descScore = fuzzyScore(q, s.description);
      const exScore = Math.max(...s.exampleInvocations.map((e) => fuzzyScore(q, e)), 0);
      const catScore = fuzzyScore(q, categoryStyle[s.category].label);
      const base = Math.max(nameScore, idScore, descScore, exScore, catScore);
      const boost = recentBoost.get(s.id) ?? 0;
      return { skill: s, score: base + boost };
    });

    if (!q) {
      // No query — sort by recency then category priority
      return scored
        .sort((a, b) => (recentBoost.get(b.skill.id) ?? 0) - (recentBoost.get(a.skill.id) ?? 0))
        .map((x) => x.skill);
    }

    return scored
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.skill);
  }, [query, skills, recentRuns]);

  // Keep active index in bounds
  useEffect(() => {
    if (activeIdx >= ranked.length) setActiveIdx(Math.max(0, ranked.length - 1));
  }, [ranked.length, activeIdx]);

  // Scroll active into view
  useEffect(() => {
    if (step !== 'list') return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx, step]);

  const beginSkill = useCallback((skill: Skill) => {
    setSelectedSkill(skill);
    // Prefill defaults
    const defaults: Record<string, string | number> = {};
    for (const a of skill.args) {
      if (a.defaultValue !== undefined) defaults[a.name] = a.defaultValue;
    }
    setArgValues(defaults);
    setStep('args');
  }, []);

  const runSkill = useCallback(async () => {
    if (!selectedSkill) return;
    // Validate required fields
    for (const a of selectedSkill.args) {
      if (a.required && (argValues[a.name] === undefined || argValues[a.name] === '')) {
        setLastResult({ runId: '', status: 'blocked', reason: `Missing required field: ${a.name}` });
        return;
      }
    }

    // Destructive → bubble up to parent to show confirm modal
    if (selectedSkill.requiresConfirmation) {
      onRequestConfirm(selectedSkill, argValues);
      onClose();
      return;
    }

    setRunning(true);
    setLastResult(null);
    try {
      const result = await onInvoke(selectedSkill, argValues);
      setLastResult(result);
      if (result?.status === 'ok') {
        // Auto-close after 1.2s on success
        setTimeout(() => onClose(), 1200);
      }
    } finally {
      setRunning(false);
    }
  }, [selectedSkill, argValues, onInvoke, onRequestConfirm, onClose]);

  // Keyboard: up/down/enter/esc
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (step === 'args') { setStep('list'); setSelectedSkill(null); setLastResult(null); }
        else onClose();
        return;
      }
      if (step === 'list') {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setActiveIdx((i) => Math.min(ranked.length - 1, i + 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setActiveIdx((i) => Math.max(0, i - 1));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const s = ranked[activeIdx];
          if (s) beginSkill(s);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, step, ranked, activeIdx, beginSkill, onClose]);

  if (!open) return null;

  const liveCommand = selectedSkill ? renderCommand(selectedSkill, argValues) : '';

  return (
    <div
      data-testid="command-palette"
      className="fixed inset-0 z-[90] flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 pt-[10vh]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl rounded-xl bg-surface border border-border shadow-2xl overflow-hidden">
        {step === 'list' && (
          <>
            {/* Search */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-surface-2/30">
              <svg className="w-5 h-5 text-text-dim shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
                placeholder="Run a skill — search by name, description, or example..."
                className="flex-1 bg-transparent text-text placeholder:text-text-dim focus:outline-none text-base"
                data-testid="command-palette-input"
              />
              <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-bg text-2xs text-text-dim border border-border font-mono">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-[60vh] overflow-y-auto">
              {ranked.length === 0 ? (
                <div className="px-4 py-12 text-center text-text-dim text-sm">
                  No skills match "{query}".
                </div>
              ) : (
                ranked.map((skill, idx) => {
                  const active = idx === activeIdx;
                  const cat = categoryStyle[skill.category];
                  const isRecent = recentRuns.slice(0, 5).includes(skill.id);
                  return (
                    <div
                      key={skill.id}
                      data-idx={idx}
                      data-testid={`palette-skill-${skill.id}`}
                      onClick={() => beginSkill(skill)}
                      onMouseEnter={() => setActiveIdx(idx)}
                      className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-l-2 transition-colors ${
                        active
                          ? 'bg-accent/10 border-accent'
                          : 'border-transparent hover:bg-surface-2'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-md ${cat.bg} ${cat.border} border flex items-center justify-center shrink-0`}>
                        <svg className={`w-4 h-4 ${cat.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={cat.icon} />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-text truncate">{skill.name}</span>
                          {skill.destructive && (
                            <span className="text-2xs px-1.5 py-0.5 rounded bg-danger/20 text-danger font-semibold">
                              DESTRUCTIVE
                            </span>
                          )}
                          {isRecent && (
                            <span className="text-2xs px-1.5 py-0.5 rounded bg-accent/20 text-accent">recent</span>
                          )}
                        </div>
                        <p className="text-xs text-text-dim truncate mt-0.5">{skill.description}</p>
                      </div>
                      <span className={`text-2xs ${cat.color} px-2 py-0.5 rounded ${cat.bg} hidden sm:block`}>{cat.label}</span>
                      {active && (
                        <kbd className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-bg text-2xs text-text-dim border border-border font-mono">
                          ↵
                        </kbd>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-border bg-surface-2/30 flex items-center justify-between text-2xs text-text-dim">
              <span>{ranked.length} skill{ranked.length !== 1 ? 's' : ''}</span>
              <span className="flex items-center gap-3">
                <span><kbd className="font-mono">↑↓</kbd> navigate</span>
                <span><kbd className="font-mono">↵</kbd> select</span>
                <span><kbd className="font-mono">esc</kbd> close</span>
              </span>
            </div>
          </>
        )}

        {step === 'args' && selectedSkill && (
          <>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <button
                onClick={() => { setStep('list'); setSelectedSkill(null); setLastResult(null); }}
                className="p-1 rounded hover:bg-surface-2 text-text-dim hover:text-text"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-text">{selectedSkill.name}</h2>
                <p className="text-xs text-text-dim mt-0.5">{selectedSkill.description}</p>
              </div>
              <span className={`text-2xs ${categoryStyle[selectedSkill.category].color} ${categoryStyle[selectedSkill.category].bg} px-2 py-0.5 rounded`}>
                {categoryStyle[selectedSkill.category].label}
              </span>
            </div>

            <div className="p-4 space-y-3">
              {selectedSkill.args.length === 0 ? (
                <p className="text-sm text-text-dim italic">No arguments required.</p>
              ) : (
                selectedSkill.args.map((arg) => (
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
                        data-testid={`arg-${arg.name}`}
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
                        data-testid={`arg-${arg.name}`}
                        className="w-full px-3 py-2 rounded-md bg-bg border border-border text-text text-sm font-mono focus:outline-none focus:border-accent"
                      />
                    )}
                  </div>
                ))
              )}

              {/* Live command preview */}
              <div className="px-3 py-2 rounded-md bg-bg border border-border">
                <div className="text-2xs uppercase text-text-dim tracking-wider mb-1">Command preview</div>
                <code className="text-sm text-accent font-mono break-all">{liveCommand}</code>
              </div>

              {selectedSkill.exampleInvocations.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-text-dim hover:text-text">Examples</summary>
                  <ul className="mt-2 space-y-1 pl-4">
                    {selectedSkill.exampleInvocations.map((e) => (
                      <li key={e} className="font-mono text-2xs text-text-dim">{e}</li>
                    ))}
                  </ul>
                </details>
              )}

              {lastResult && (
                <div
                  data-testid="invoke-result"
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

            <div className="px-4 pb-4 flex gap-2">
              <button
                onClick={() => { setStep('list'); setSelectedSkill(null); setLastResult(null); }}
                className="flex-1 px-4 py-2 rounded-md bg-surface-2 text-text border border-border hover:bg-card-hover text-sm font-medium"
              >
                Back
              </button>
              <button
                onClick={runSkill}
                disabled={running}
                data-testid="palette-run"
                className={`flex-1 px-4 py-2 rounded-md text-sm font-bold transition-all ${
                  selectedSkill.destructive
                    ? 'bg-danger text-bg hover:bg-danger/90'
                    : 'bg-accent text-bg hover:bg-accent/90'
                } ${running ? 'opacity-60 cursor-wait' : ''}`}
              >
                {running ? 'Running…' : selectedSkill.requiresConfirmation ? `Confirm & Run` : 'Run'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
