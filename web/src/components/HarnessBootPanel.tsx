"use client";

import type { WorkspaceSummary } from "@/lib/types";

const cockpitLanes = [
  {
    id: "command",
    name: "Command",
    detail: "Direct the harness, launch scans, and ask for a clean next move.",
  },
  {
    id: "markets",
    name: "Markets",
    detail: "Cross-market comparison across Kalshi, Polymarket, and active rails.",
  },
  {
    id: "feeds",
    name: "Feeds",
    detail: "News and social context for catalysts, narrative shifts, and timing.",
  },
  {
    id: "risk",
    name: "Risk",
    detail: "Position review, sizing discipline, and reasons to pass.",
  },
  {
    id: "execution",
    name: "Execution",
    detail: "Supported trade routing, order readiness, and cycle recap.",
  },
  {
    id: "tradingview",
    name: "TradingView",
    detail: "Watchlist or MCP-backed chart context for symbols, macro, and timing.",
  },
];

function buildMissions(workspace: WorkspaceSummary | null) {
  const watchlist = workspace?.tradingview.watchlist.join(", ") || "SPY, QQQ, BTCUSD, NQ1!";

  return [
    {
      label: "Connector audit",
      prompt:
        "Audit this OpenTradex workspace. Tell me which rails, feeds, channels, and credentials are configured, what is still missing, and the smartest next local step.",
    },
    {
      label: "Cross-market scan",
      prompt:
        "Scan the enabled market rails, compare overlapping themes, and surface the best 3 setups before recommending one paper trade or pass.",
    },
    {
      label: "TradingView pass",
      prompt: `Use the TradingView lane and focus on this watchlist: ${watchlist}. Tell me which symbols or macro instruments deserve attention right now and why.`,
    },
    {
      label: "Risk review",
      prompt:
        "Run a strict risk-manager review of the portfolio and open theses. Cut weak ideas, flag unsupported execution paths, and list only what survives.",
    },
    {
      label: "News recap",
      prompt:
        "Summarize the latest feeds, separate what is new from what is already priced in, and point me to one market worth deeper research.",
    },
    {
      label: "Explain setup",
      prompt:
        "Explain this OpenTradex setup like an operator boot briefing: runtime, rails, dashboard surface, channels, and where live execution is actually supported.",
    },
  ];
}

export function HarnessBootPanel({
  workspace,
  onLaunchMission,
}: {
  workspace: WorkspaceSummary | null;
  onLaunchMission: (prompt: string) => void;
}) {
  const missions = buildMissions(workspace);

  return (
    <div className="relative overflow-hidden rounded-[1.6rem] border border-[#553249] bg-[linear-gradient(180deg,#321126_0%,#240b1c_100%)] p-5 text-[#f7e6ee] shadow-[0_30px_120px_rgba(24,6,14,0.45)]">
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:22px_22px] opacity-40" />

      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.28em] text-[#f3a96f]">
            OpenTradex onboarding
          </p>
          <h3 className="mt-3 text-3xl font-semibold tracking-tight text-white">
            Start in chat, route by channel, keep the rails honest.
          </h3>
          <p className="mt-3 max-w-xl text-sm leading-7 text-[#e9c9d9]/80">
            This cockpit is meant to feel like an operator interface, not a flat log.
            Pick a lane, send a mission, and use the right connector for the job.
          </p>
        </div>

        <div className="rounded-full border border-[#724b62] bg-[#4a2038]/80 px-3 py-1.5 font-mono text-[0.68rem] uppercase tracking-[0.24em] text-[#ffd9a4]">
          {workspace?.dashboardSurface === "chat" ? "Chat cockpit active" : "Stream surface active"}
        </div>
      </div>

      <div className="relative mt-5 grid gap-3 xl:grid-cols-5">
        {cockpitLanes
          .filter((lane) => (lane.id === "tradingview" ? workspace?.tradingview.enabled : true))
          .map((lane) => (
            <div
              key={lane.id}
              className="rounded-[1.2rem] border border-[#6f475f] bg-[#40172f]/70 p-3"
            >
              <p className="font-mono text-[0.66rem] uppercase tracking-[0.24em] text-[#f3a96f]">
                {lane.name}
              </p>
              <p className="mt-2 text-[0.82rem] leading-6 text-[#f4dfea]/78">{lane.detail}</p>
            </div>
          ))}
      </div>

      <div className="relative mt-5 flex flex-wrap gap-2">
        {workspace?.enabledMarkets.map((market) => (
          <span
            key={market}
            className="rounded-full border border-[#724b62] bg-[#4a2038]/70 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#f7d3a7]"
          >
            {market}
          </span>
        ))}
        {workspace?.tradingview.enabled ? (
          <span className="rounded-full border border-[#724b62] bg-[#4a2038]/70 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#f7d3a7]">
            {workspace.tradingview.connectorMode === "mcp"
              ? workspace.tradingview.configured
                ? "tradingview mcp ready"
                : "tradingview mcp incomplete"
              : "tradingview watchlist"}
          </span>
        ) : null}
      </div>

      <div className="relative mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {missions.map((mission) => (
          <button
            key={mission.label}
            onClick={() => onLaunchMission(mission.prompt)}
            className="rounded-[1.2rem] border border-[#724b62] bg-[#4a2038]/58 px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-[#9e6985] hover:bg-[#572542]/72"
          >
            <p className="font-mono text-[0.66rem] uppercase tracking-[0.24em] text-[#f7d3a7]">
              {mission.label}
            </p>
            <p className="mt-2 text-[0.82rem] leading-6 text-[#f4dfea]/78">
              {mission.prompt}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
