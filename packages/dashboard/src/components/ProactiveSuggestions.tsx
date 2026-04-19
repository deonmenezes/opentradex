import { useState, useEffect } from 'react';
import type { Skill, InvokeResult } from '../lib/skills';
import { categoryStyle } from '../lib/skills';

interface Suggestion {
  skillId: string;
  reason: string;
  priority: 'high' | 'normal' | 'low';
}

interface ProactiveSuggestionsProps {
  skills: Skill[];
  onInvoke: (skill: Skill, args: Record<string, string | number>) => Promise<InvokeResult | null>;
  onRequestConfirm: (skill: Skill, args: Record<string, string | number>) => void;
}

const priorityStyle = {
  high:   'bg-danger/10 border-danger/30 text-danger',
  normal: 'bg-accent/10 border-accent/30 text-accent',
  low:    'bg-surface-2 border-border text-text-dim',
};

// Proactive suggestions panel (US-011). Polls /api/agent/suggest every 20s.
// Each suggestion renders as a clickable pill that either fires the skill
// directly (safe) or triggers the confirm modal (destructive).
export default function ProactiveSuggestions({ skills, onInvoke, onRequestConfirm }: ProactiveSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const r = await fetch('/api/agent/suggest');
        if (!r.ok) return;
        const d = await r.json();
        if (mounted && Array.isArray(d.suggestions)) setSuggestions(d.suggestions);
      } catch { /* ignore */ }
    }
    load();
    const t = setInterval(load, 20_000);
    return () => { mounted = false; clearInterval(t); };
  }, []);

  if (suggestions.length === 0) return null;

  const runSuggestion = (s: Suggestion) => {
    const skill = skills.find((sk) => sk.id === s.skillId);
    if (!skill) return;
    const defaults: Record<string, string | number> = {};
    for (const a of skill.args) if (a.defaultValue !== undefined) defaults[a.name] = a.defaultValue;
    if (skill.requiresConfirmation) onRequestConfirm(skill, defaults);
    else onInvoke(skill, defaults);
  };

  return (
    <div className="px-3 py-2 border-b border-border bg-surface-2/40">
      <div className="flex items-center gap-1.5 mb-2">
        <svg className="w-3.5 h-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <h3 className="text-2xs font-semibold text-text-dim uppercase tracking-wider">Agent Suggests</h3>
      </div>
      <div className="space-y-1.5" data-testid="suggestions">
        {suggestions.map((s, idx) => {
          const skill = skills.find((sk) => sk.id === s.skillId);
          if (!skill) return null;
          const cat = categoryStyle[skill.category];
          return (
            <button
              key={`${s.skillId}-${idx}`}
              onClick={() => runSuggestion(s)}
              data-testid={`suggestion-${s.skillId}`}
              className={`w-full text-left p-2 rounded-md border transition-all hover:scale-[1.01] ${priorityStyle[s.priority]}`}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <div className={`w-5 h-5 rounded ${cat.bg} ${cat.border} border flex items-center justify-center shrink-0`}>
                  <svg className={`w-3 h-3 ${cat.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={cat.icon} />
                  </svg>
                </div>
                <span className="text-xs font-bold text-text truncate">{skill.name}</span>
                <span className={`ml-auto text-2xs px-1 py-0 rounded font-semibold uppercase ${
                  s.priority === 'high'   ? 'bg-danger/20 text-danger'   :
                  s.priority === 'normal' ? 'bg-accent/20 text-accent'   :
                                            'bg-surface-2 text-text-dim'
                }`}>
                  {s.priority}
                </span>
              </div>
              <p className="text-2xs text-text leading-relaxed">{s.reason}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
