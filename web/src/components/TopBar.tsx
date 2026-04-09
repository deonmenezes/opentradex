"use client";

import { Activity, AlertTriangle, CheckCircle2, Play, Radio, Repeat, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LiveReadinessCheck, WorkspaceSummary } from "@/lib/types";

interface TopBarProps {
  workspace: WorkspaceSummary | null;
  readinessChecks: LiveReadinessCheck[];
  canArmLive: boolean;
  authProbeMessage: string;
  liveBalance: number | null;
  modeBusy: boolean;
  liveStatus: string;
  agentStatus: string;
  loopInterval: number;
  onRunCycle: () => void;
  onStartLoop: () => void;
  onRefresh: () => void;
  onLoopIntervalChange: (value: number) => void;
  onSetExecutionMode: (mode: "paper" | "live") => void;
}

const INTERVALS = [
  { value: 60, label: "1m" },
  { value: 300, label: "5m" },
  { value: 600, label: "10m" },
  { value: 900, label: "15m" },
  { value: 1800, label: "30m" },
];

export function TopBar({
  workspace,
  readinessChecks,
  canArmLive,
  authProbeMessage,
  liveBalance,
  modeBusy,
  liveStatus,
  agentStatus,
  loopInterval,
  onRunCycle,
  onStartLoop,
  onRefresh,
  onLoopIntervalChange,
  onSetExecutionMode,
}: TopBarProps) {
  const executionMode = workspace?.mode || "paper";
  const executionRail = workspace?.executionRail || workspace?.primaryMarket || "kalshi";
  const researchRails = workspace?.researchRails?.length
    ? workspace.researchRails.join(", ")
    : (workspace?.enabledMarkets || []).filter((rail) => rail !== executionRail).join(", ") || "none";
  const tradingviewState = workspace?.tradingview.enabled
    ? workspace.tradingview.connectorMode === "mcp"
      ? workspace.tradingview.configured
        ? "mcp ready"
        : "mcp setup needed"
      : "watchlist"
    : "off";
  const failedChecks = readinessChecks.filter((check) => !check.ok);
  return (
    <header className="shrink-0 border-b border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,250,246,0.82))] px-4 py-3 backdrop-blur xl:px-5">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/8 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-emerald-700">
                <Activity className="h-3.5 w-3.5" />
                OpenTradex
              </div>
              <StatusPill
                label={liveStatus === "running" ? "agent running" : liveStatus === "error" ? "needs attention" : "ready"}
                tone={liveStatus === "running" ? "ok" : liveStatus === "error" ? "bad" : "warn"}
              />
              {workspace ? <StatusPill label={`runtime ${workspace.runtime}`} tone="neutral" /> : null}
              <StatusPill label={`rail ${executionRail}`} tone="neutral" />
              <StatusPill label={`research ${researchRails}`} tone="neutral" />
              <StatusPill label={`tradingview ${tradingviewState}`} tone="neutral" />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <span className="font-medium text-slate-900">Command cockpit</span>
              <span className="text-slate-400">/</span>
              <span>
                {workspace?.dashboardSurface === "chat"
                  ? "channel-based operator chat"
                  : "stream-first control surface"}
              </span>
              {agentStatus ? (
                <>
                  <span className="text-slate-400">/</span>
                  <span className="truncate text-slate-500">{agentStatus}</span>
                </>
              ) : null}
              {liveBalance !== null ? (
                <>
                  <span className="text-slate-400">/</span>
                  <span className="text-slate-500">live balance ${liveBalance.toFixed(2)}</span>
                </>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 xl:min-w-[46rem]">
              <Button size="sm" onClick={onRunCycle} className="h-9 gap-1.5 rounded-full px-4 text-xs">
                <Play className="h-3.5 w-3.5" />
                Run cycle
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={onStartLoop}
                className="h-9 gap-1.5 rounded-full px-4 text-xs"
              >
                <Repeat className="h-3.5 w-3.5" />
                Auto loop
              </Button>
              <div className="flex items-center gap-1.5 rounded-full border border-slate-900/8 bg-white/82 px-2 py-1">
                <span className="px-1 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
                  Loop
                </span>
                {INTERVALS.map((interval) => (
                  <button
                    key={interval.value}
                    onClick={() => onLoopIntervalChange(interval.value)}
                    className={`rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] transition-colors ${
                      loopInterval === interval.value
                        ? "bg-slate-900 text-white"
                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    }`}
                  >
                    {interval.label}
                  </button>
                ))}
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={onRefresh}
                className="h-9 w-9 rounded-full"
              >
                <RotateCw className="h-4 w-4" />
              </Button>
              <div className="flex items-center rounded-full border border-slate-900/8 bg-white/82 p-1 shadow-sm">
                <button
                  type="button"
                  disabled={modeBusy || executionMode === "paper"}
                  onClick={() => onSetExecutionMode("paper")}
                  className={`h-9 rounded-full px-4 text-xs font-medium transition-colors ${
                    executionMode === "paper"
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  } ${modeBusy ? "cursor-wait opacity-70" : ""}`}
                >
                  Paper
                </button>
                <button
                  type="button"
                  disabled={modeBusy || executionMode === "live" || !canArmLive}
                  onClick={() => {
                    if (window.confirm("Arm live Kalshi trading for this workspace? Real orders may be submitted.")) {
                      onSetExecutionMode("live");
                    }
                  }}
                  className={`h-9 rounded-full px-4 text-xs font-medium transition-colors ${
                    executionMode === "live"
                      ? "bg-rose-500 text-white"
                      : canArmLive
                        ? "text-emerald-700 hover:bg-emerald-50"
                        : "text-slate-400"
                  } ${modeBusy ? "cursor-wait opacity-70" : ""}`}
                  title={!canArmLive && executionMode !== "live" ? `${failedChecks.length} checks blocked` : "Arm live trading"}
                >
                  Live
                </button>
              </div>
            </div>
          </div>

        {failedChecks.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            {failedChecks.map((check) => (
              <span
                key={check.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-800"
                title={check.detail}
              >
                <AlertTriangle className="h-3 w-3" />
                {check.label}
              </span>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[11px] text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {authProbeMessage}
          </div>
        )}
      </div>
    </header>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "neutral" | "ok" | "warn" | "bad";
}) {
  const tones = {
    neutral: "border-slate-900/8 bg-white/75 text-slate-500",
    ok: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warn: "border-amber-200 bg-amber-50 text-amber-800",
    bad: "border-rose-200 bg-rose-50 text-rose-700",
  };

  return (
    <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${tones[tone]}`}>
      {label}
    </span>
  );
}
