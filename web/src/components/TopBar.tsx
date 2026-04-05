"use client";

import { Activity, Play, Repeat, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TopBarProps {
  liveStatus: string;
  agentStatus: string;
  rationale: string;
  loopInterval: number;
  onRationaleChange: (v: string) => void;
  onSubmitRationale: () => void;
  onRunCycle: () => void;
  onStartLoop: () => void;
  onRefresh: () => void;
  onLoopIntervalChange: (v: number) => void;
}

const INTERVALS = [
  { value: 60, label: "1m" },
  { value: 300, label: "5m" },
  { value: 600, label: "10m" },
  { value: 900, label: "15m" },
  { value: 1800, label: "30m" },
];

export function TopBar({
  liveStatus,
  agentStatus,
  rationale,
  loopInterval,
  onRationaleChange,
  onSubmitRationale,
  onRunCycle,
  onStartLoop,
  onRefresh,
  onLoopIntervalChange,
}: TopBarProps) {
  return (
    <header className="h-14 flex items-center gap-4 px-5 border-b border-border bg-card shrink-0 overflow-hidden max-w-full">
      <div className="flex items-center gap-3 mr-2">
        <Activity className="h-5 w-5 text-primary" />
        <span className="font-semibold text-sm tracking-tight">
          Open Trademaxxxing
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            liveStatus === "running"
              ? "bg-primary pulse-glow"
              : liveStatus === "error"
                ? "bg-destructive"
                : "bg-muted-foreground/40"
          }`}
        />
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {liveStatus === "running"
            ? "Running"
            : liveStatus === "error"
              ? "Error"
              : "Idle"}
        </span>
      </div>

      {agentStatus && (
        <span className="text-xs text-muted-foreground/60 truncate max-w-48">
          {agentStatus}
        </span>
      )}

      <div className="flex-1 max-w-lg ml-auto">
        <div className="relative">
          <input
            type="text"
            value={rationale}
            onChange={(e) => onRationaleChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSubmitRationale()}
            placeholder="Enter a thesis to research & trade..."
            className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/40 transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {INTERVALS.map((i) => (
          <button
            key={i.value}
            onClick={() => onLoopIntervalChange(i.value)}
            className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
              loopInterval === i.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            {i.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <Button size="sm" onClick={onRunCycle} className="h-7 text-xs gap-1.5">
          <Play className="h-3 w-3" />
          Run
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={onStartLoop}
          className="h-7 text-xs gap-1.5"
        >
          <Repeat className="h-3 w-3" />
          Loop
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={onRefresh}
          className="h-7 w-7"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </Button>
      </div>
    </header>
  );
}
