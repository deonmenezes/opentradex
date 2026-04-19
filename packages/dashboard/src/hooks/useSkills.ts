import { useState, useEffect, useCallback, useRef } from 'react';
import type { Skill, SkillRun, InvokeResult } from '../lib/skills';

const API_BASE = '/api';
const POLL_MS = 3_000;

// Central hook for the Agent Command Center. Owns the skills registry, the runs
// log (polled every 3s from the gateway), and the invoke helper with confirmation
// plumbing. Components subscribe instead of each making their own fetches.
export function useSkills() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [runs, setRuns] = useState<SkillRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  // Load skills once, runs continuously
  useEffect(() => {
    mountedRef.current = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function loadSkills() {
      try {
        const res = await fetch(`${API_BASE}/agent/skills`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (mountedRef.current) {
          setSkills(Array.isArray(data.skills) ? data.skills : []);
          setLoading(false);
        }
      } catch (e) {
        if (mountedRef.current) {
          setError(e instanceof Error ? e.message : 'Failed to load skills');
          setLoading(false);
        }
      }
    }

    async function loadRuns() {
      try {
        const res = await fetch(`${API_BASE}/agent/runs?limit=100`);
        if (!res.ok) return;
        const data = await res.json();
        if (mountedRef.current && Array.isArray(data.runs)) {
          setRuns(data.runs);
        }
      } catch { /* swallow — next tick */ }
    }

    loadSkills();
    loadRuns();
    timer = setInterval(loadRuns, POLL_MS);

    return () => {
      mountedRef.current = false;
      if (timer) clearInterval(timer);
    };
  }, []);

  const invoke = useCallback(
    async (skill: Skill, args: Record<string, string | number>, confirmed = false): Promise<InvokeResult | null> => {
      try {
        const res = await fetch(`${API_BASE}/agent/skills/${skill.id}/invoke`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ args, confirmed, source: 'user' }),
        });
        const data: InvokeResult = await res.json();
        // Refresh runs immediately (poll is 3s)
        fetch(`${API_BASE}/agent/runs?limit=100`)
          .then((r) => r.json())
          .then((d) => { if (mountedRef.current && Array.isArray(d.runs)) setRuns(d.runs); })
          .catch(() => {});
        return data;
      } catch (e) {
        return {
          runId: '',
          status: 'failed',
          reason: e instanceof Error ? e.message : 'Network error',
        };
      }
    },
    []
  );

  const recentSkillIds = runs.slice(0, 20).map((r) => r.skillId);

  return { skills, runs, loading, error, invoke, recentSkillIds };
}
