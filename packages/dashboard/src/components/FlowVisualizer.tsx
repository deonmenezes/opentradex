import { useMemo, useState, useEffect, useRef } from 'react';
import type { Skill, SkillRun, InvokeResult } from '../lib/skills';
import { categoryStyle } from '../lib/skills';

interface FlowVisualizerProps {
  skills: Skill[];
  runs: SkillRun[];
  onInvoke: (skill: Skill, args: Record<string, string | number>) => Promise<InvokeResult | null>;
  onRequestConfirm: (skill: Skill, args: Record<string, string | number>) => void;
}

// Flow graph column order — setup gates analyze+inspect which gate trade which gates safety.
// Each column is a stage in the typical decision flow.
const COLUMNS: Array<{ key: string; label: string; categories: Array<Skill['category']>; x: number }> = [
  { key: 'setup',    label: 'Setup',     categories: ['setup'],              x: 80  },
  { key: 'inspect',  label: 'Inspect',   categories: ['inspect', 'analyze'], x: 310 },
  { key: 'trade',    label: 'Execute',   categories: ['trade'],              x: 540 },
  { key: 'safety',   label: 'Safeguard', categories: ['safety'],             x: 770 },
];

const NODE_H = 42;
const NODE_W = 170;
const V_GAP = 10;
const COL_TOP = 56;

// Flow Visualizer (US-007). SVG-rendered DAG showing the agent's decision flow
// from Setup → Inspect/Analyze → Trade → Safety. Each node is a skill; click
// to launch. Edges show the common chain paths. Nodes pulse when a run is active.
export default function FlowVisualizer({ skills, runs, onInvoke, onRequestConfirm }: FlowVisualizerProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [recentRunIds, setRecentRunIds] = useState<Set<string>>(new Set());
  const lastRunCount = useRef(runs.length);

  // When a new run arrives, pulse its skill node for 2 seconds.
  useEffect(() => {
    if (runs.length > lastRunCount.current) {
      const newRun = runs[0];
      if (newRun) {
        setRecentRunIds((prev) => {
          const next = new Set(prev);
          next.add(newRun.skillId);
          return next;
        });
        const id = newRun.skillId;
        setTimeout(() => {
          setRecentRunIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }, 2000);
      }
    }
    lastRunCount.current = runs.length;
  }, [runs]);

  // Group skills into columns. Each column tracks its own vertical offset.
  const nodes = useMemo(() => {
    const placed: Array<{ skill: Skill; x: number; y: number; col: number }> = [];
    for (let c = 0; c < COLUMNS.length; c++) {
      const col = COLUMNS[c];
      const colSkills = skills.filter((s) => col.categories.includes(s.category));
      colSkills.forEach((skill, i) => {
        placed.push({
          skill,
          x: col.x,
          y: COL_TOP + i * (NODE_H + V_GAP),
          col: c,
        });
      });
    }
    return placed;
  }, [skills]);

  // Edges: each node connects to every node in the next column (many-to-many fan-out).
  // This reflects "after you inspect, you can trade anything". Filtered to setup→inspect
  // and inspect→trade and trade→safety only (the canonical flow).
  const edges = useMemo(() => {
    const byCol: Record<number, typeof nodes> = {};
    nodes.forEach((n) => {
      byCol[n.col] = byCol[n.col] || [];
      byCol[n.col].push(n);
    });
    const list: Array<{ x1: number; y1: number; x2: number; y2: number; key: string }> = [];
    for (let c = 0; c < COLUMNS.length - 1; c++) {
      const from = byCol[c] || [];
      const to = byCol[c + 1] || [];
      // Single anchored edge per column pair (midpoint-to-midpoint) to avoid visual noise
      if (from.length === 0 || to.length === 0) continue;
      for (const f of from) {
        for (const t of to) {
          list.push({
            x1: f.x + NODE_W,
            y1: f.y + NODE_H / 2,
            x2: t.x,
            y2: t.y + NODE_H / 2,
            key: `${f.skill.id}->${t.skill.id}`,
          });
        }
      }
    }
    return list;
  }, [nodes]);

  const maxRows = useMemo(() => {
    let max = 0;
    for (const col of COLUMNS) {
      const count = skills.filter((s) => col.categories.includes(s.category)).length;
      if (count > max) max = count;
    }
    return max;
  }, [skills]);

  const svgH = Math.max(240, COL_TOP + maxRows * (NODE_H + V_GAP) + 30);
  const svgW = COLUMNS[COLUMNS.length - 1].x + NODE_W + 80;

  const handleClick = (skill: Skill) => {
    const defaults: Record<string, string | number> = {};
    for (const a of skill.args) if (a.defaultValue !== undefined) defaults[a.name] = a.defaultValue;
    // If any required arg lacks a default, jump to confirm or skills page instead of silently failing.
    const missing = skill.args.filter((a) => a.required && defaults[a.name] === undefined);
    if (missing.length > 0) {
      window.location.hash = 'skills';
      return;
    }
    if (skill.requiresConfirmation) onRequestConfirm(skill, defaults);
    else onInvoke(skill, defaults);
  };

  const hoveredSkill = hovered ? skills.find((s) => s.id === hovered) ?? null : null;

  return (
    <div className="border-b border-border bg-surface/40" data-testid="flow-visualizer">
      <div className="px-3 pt-2 pb-1 flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <h3 className="text-2xs font-semibold text-text-dim uppercase tracking-wider flex-1">Flow Visualizer</h3>
        <span className="text-2xs text-text-dim">{skills.length} skills</span>
      </div>
      <div className="px-2 pb-3 overflow-x-auto">
        <svg width={svgW} height={svgH} className="min-w-full" role="img" aria-label="Skill flow graph">
          {/* Column headers */}
          {COLUMNS.map((col) => (
            <g key={col.key}>
              <text x={col.x + NODE_W / 2} y={28} fontSize="10" fill="currentColor"
                textAnchor="middle" className="text-text-dim uppercase tracking-wider font-semibold">
                {col.label}
              </text>
              <line x1={col.x} y1={38} x2={col.x + NODE_W} y2={38} stroke="currentColor"
                className="text-border" strokeWidth={1} strokeDasharray="2 2" />
            </g>
          ))}

          {/* Edges */}
          {edges.map((e) => {
            const mx = (e.x1 + e.x2) / 2;
            return (
              <path
                key={e.key}
                d={`M ${e.x1} ${e.y1} C ${mx} ${e.y1} ${mx} ${e.y2} ${e.x2} ${e.y2}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={hovered && e.key.startsWith(hovered + '->') ? 1.5 : 0.5}
                className={hovered && e.key.startsWith(hovered + '->') ? 'text-accent' : 'text-border'}
                opacity={hovered && !e.key.startsWith(hovered + '->') ? 0.15 : 0.6}
              />
            );
          })}

          {/* Nodes */}
          {nodes.map((n) => {
            const cat = categoryStyle[n.skill.category];
            const isHover = hovered === n.skill.id;
            const isActive = recentRunIds.has(n.skill.id);
            const isDestructive = n.skill.destructive;
            return (
              <g
                key={n.skill.id}
                transform={`translate(${n.x}, ${n.y})`}
                onMouseEnter={() => setHovered(n.skill.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => handleClick(n.skill)}
                data-testid={`flow-node-${n.skill.id}`}
                style={{ cursor: 'pointer' }}
              >
                {isActive && (
                  <rect
                    x={-4} y={-4} width={NODE_W + 8} height={NODE_H + 8} rx={10}
                    fill="currentColor" className="text-accent" opacity={0.25}>
                    <animate attributeName="opacity" values="0.25;0;0.25" dur="1.5s" repeatCount="3" />
                  </rect>
                )}
                <rect
                  width={NODE_W} height={NODE_H} rx={8}
                  fill="currentColor"
                  className={isHover ? cat.bg.replace('/10', '/30') : cat.bg}
                  stroke="currentColor"
                  strokeWidth={isHover ? 2 : 1}
                />
                <rect
                  width={NODE_W} height={NODE_H} rx={8}
                  fill="none" stroke="currentColor"
                  className={cat.border}
                  strokeWidth={isHover ? 2 : 1}
                />
                <circle cx={14} cy={NODE_H / 2} r={6} fill="currentColor" className={cat.color} opacity={0.8} />
                <text x={28} y={NODE_H / 2 - 2} fontSize="11" fontWeight={600} fill="currentColor" className="text-text">
                  {n.skill.name.length > 20 ? n.skill.name.slice(0, 18) + '…' : n.skill.name}
                </text>
                <text x={28} y={NODE_H / 2 + 12} fontSize="9" fill="currentColor" className="text-text-dim">
                  {n.skill.id}
                </text>
                {isDestructive && (
                  <g transform={`translate(${NODE_W - 18}, 6)`}>
                    <circle cx={6} cy={6} r={5} fill="currentColor" className="text-danger" opacity={0.9} />
                    <text x={6} y={9} fontSize="8" fontWeight={700} fill="currentColor"
                      className="text-bg" textAnchor="middle">!</text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      {hoveredSkill && (
        <div className="px-3 py-2 border-t border-border bg-bg/60 text-2xs text-text-dim" data-testid="flow-tooltip">
          <span className="font-semibold text-text">{hoveredSkill.name}:</span> {hoveredSkill.description}
          {hoveredSkill.destructive && (
            <span className="ml-2 inline-block px-1.5 py-0 rounded bg-danger/20 text-danger font-semibold uppercase text-2xs">
              Destructive
            </span>
          )}
        </div>
      )}
    </div>
  );
}
