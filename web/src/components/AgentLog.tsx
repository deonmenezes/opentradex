"use client";

import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot } from "lucide-react";
import type { AgentCycle } from "@/lib/types";

interface AgentLogProps {
  cycles: AgentCycle[];
}

export function AgentLog({ cycles }: AgentLogProps) {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="flex flex-col h-full border-t border-border">
      <div className="h-9 flex items-center justify-between px-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2">
          <Bot className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Agent Log
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground/60 font-mono">
          {cycles.length}
        </span>
      </div>

      <ScrollArea className="flex-1">
        {cycles.length === 0 && (
          <p className="text-xs text-muted-foreground/40 text-center py-8">
            No cycles yet
          </p>
        )}
        <div className="divide-y divide-border/30">
          {cycles.map((c) => (
            <button
              key={c.id}
              onClick={() => setExpanded(expanded === c.id ? null : c.id)}
              className="w-full text-left px-3 py-2 hover:bg-secondary/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    c.status === "ok" ? "bg-primary" : "bg-destructive"
                  }`}
                />
                <span className="text-[10px] text-muted-foreground/60 font-mono">
                  {c.timestamp.slice(11, 19)}
                </span>
                <span className="text-[10px] text-muted-foreground/40">
                  {c.duration_s}s
                </span>
                {c.trades_made > 0 && (
                  <span className="text-[9px] text-primary font-medium ml-auto">
                    {c.trades_made} trade{c.trades_made > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              {expanded === c.id && c.output_summary && (
                <p className="text-[10px] text-muted-foreground/60 mt-1.5 leading-relaxed whitespace-pre-wrap">
                  {c.output_summary.slice(0, 500)}
                </p>
              )}
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
