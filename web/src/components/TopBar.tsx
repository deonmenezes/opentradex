"use client";

import { Activity, ExternalLink, FolderGit2, MessageCircle, Play, Repeat, RotateCw, Sparkles, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WorkspaceSummary } from "@/lib/types";

interface TopBarProps {
  workspace: WorkspaceSummary | null;
  liveStatus: string;
  agentStatus: string;
  queuedCount: number;
  rationale: string;
  loopInterval: number;
  onRationaleChange: (value: string) => void;
  onSubmitRationale: () => void;
  onRunCycle: () => void;
  onStartLoop: () => void;
  onRefresh: () => void;
  onLoopIntervalChange: (value: number) => void;
}

const INTERVALS = [
  { value: 60, label: "1m" },
  { value: 300, label: "5m" },
  { value: 600, label: "10m" },
  { value: 900, label: "15m" },
  { value: 1800, label: "30m" },
];

const REPO_URL = "https://github.com/deonmenezes/opentradex";
const DISCORD_URL = "https://discord.gg/rFdwJC8z";

export function TopBar({
  workspace,
  liveStatus,
  agentStatus,
  queuedCount,
  rationale,
  loopInterval,
  onRationaleChange,
  onSubmitRationale,
  onRunCycle,
  onStartLoop,
  onRefresh,
  onLoopIntervalChange,
}: TopBarProps) {
  const tradingviewLabel = workspace?.tradingview.enabled
    ? workspace.tradingview.connectorMode === "mcp"
      ? workspace.tradingview.configured
        ? "TradingView MCP"
        : "TradingView MCP (needs setup)"
      : "TradingView watchlist"
    : null;

  return (
    <header className="shrink-0 border-b border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,250,246,0.82))] px-4 py-3 backdrop-blur xl:px-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/8 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-emerald-700">
              <Activity className="h-3.5 w-3.5" />
              OpenTradex
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-slate-900/8 bg-white/80 px-3 py-1 text-[11px] text-slate-600">
              <span
                className={`h-2 w-2 rounded-full ${
                  liveStatus === "running"
                    ? "bg-emerald-500 pulse-glow"
                    : liveStatus === "error"
                      ? "bg-rose-500"
                      : "bg-amber-500"
                }`}
              />
              {liveStatus === "running"
                ? "Agent running"
                : liveStatus === "error"
                  ? "Needs attention"
                  : "Ready"}
            </div>
            {workspace && (
              <>
                <InfoPill label={workspace.runtime} />
                <InfoPill label={`${workspace.mode} mode`} />
                <InfoPill label={workspace.primaryMarket} />
                {tradingviewLabel ? <InfoPill label={tradingviewLabel} /> : null}
              </>
            )}
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
            {queuedCount > 0 ? (
              <>
                <span className="text-slate-400">/</span>
                <span className="text-amber-600">{queuedCount} queued</span>
              </>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 xl:min-w-[44rem] xl:grid-cols-[minmax(0,1fr)_auto_auto] xl:items-center">
          <label className="flex min-w-0 items-center gap-2 rounded-2xl border border-slate-900/8 bg-white/86 px-3 py-2 shadow-sm">
            <Sparkles className="h-4 w-4 shrink-0 text-amber-500" />
            <input
              type="text"
              value={rationale}
              onChange={(event) => onRationaleChange(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && onSubmitRationale()}
              placeholder="Drop a thesis or catalyst and let the harness research it."
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
            />
          </label>

          <div className="flex items-center gap-1 rounded-full border border-slate-900/8 bg-white/82 p-1">
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

          <div className="flex items-center gap-1.5">
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
            <Button
              size="icon"
              variant="ghost"
              onClick={onRefresh}
              className="h-9 w-9 rounded-full"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {workspace ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-900/8 bg-white/75 px-2.5 py-1">
            <Workflow className="h-3 w-3" />
            Channels: {workspace.channels.join(", ")}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-900/8 bg-white/75 px-2.5 py-1">
            Rails: {workspace.enabledMarkets.join(", ")}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-900/8 bg-white/75 px-2.5 py-1">
            Feeds: {workspace.integrations.join(", ")}
          </span>
          <TopLinkPill href={REPO_URL} label="GitHub repo" icon={FolderGit2} />
          <TopLinkPill href={DISCORD_URL} label="Discord" icon={MessageCircle} />
        </div>
      ) : null}
    </header>
  );
}

function InfoPill({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-slate-900/8 bg-white/75 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">
      {label}
    </span>
  );
}

function TopLinkPill({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: typeof FolderGit2;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-900/10 bg-white/80 px-2.5 py-1 text-[11px] font-medium text-slate-700 transition-colors hover:border-slate-900/18 hover:bg-white"
    >
      <Icon className="h-3 w-3" />
      {label}
      <ExternalLink className="h-3 w-3 text-slate-400" />
    </a>
  );
}
