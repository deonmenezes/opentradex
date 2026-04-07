"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Link2,
  Radio,
  Send,
  ShieldCheck,
  Terminal,
  TrendingUp,
  Waves,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HarnessBootPanel } from "@/components/HarnessBootPanel";
import type { PromptEntry, StreamLine, WorkspaceSummary } from "@/lib/types";

interface LiveStreamProps {
  lines: StreamLine[];
  liveStatus: string;
  customPrompt: string;
  prompts: PromptEntry[];
  queuedPrompts: PromptEntry[];
  workspace: WorkspaceSummary | null;
  onCustomPromptChange: (value: string) => void;
  onSendCommand: (prompt: string, channel: string) => void;
}

type ChannelId =
  | "all"
  | "command"
  | "markets"
  | "feeds"
  | "risk"
  | "execution"
  | "tradingview";

type GroupedLine =
  | { kind: "text"; text: string }
  | { kind: "tools"; tools: { tool: StreamLine; result?: StreamLine }[] }
  | { kind: "result"; result: string };

type ChatMessage =
  | {
      id: string;
      role: "user";
      channel: ChannelId;
      body: string;
      createdAt: string;
    }
  | {
      id: string;
      role: "assistant" | "result";
      channel: ChannelId;
      body: string;
      createdAt: string;
    }
  | {
      id: string;
      role: "tool";
      channel: ChannelId;
      tools: { tool: StreamLine; result?: StreamLine }[];
      createdAt: string;
    };

const CHANNEL_META: Record<
  Exclude<ChannelId, "all">,
  { label: string; description: string; icon: typeof Terminal }
> = {
  command: {
    label: "Command",
    description: "Direct the harness and launch missions.",
    icon: Terminal,
  },
  markets: {
    label: "Markets",
    description: "Cross-market comparison and contract selection.",
    icon: TrendingUp,
  },
  feeds: {
    label: "Feeds",
    description: "News and social flow for fresh catalysts.",
    icon: Waves,
  },
  risk: {
    label: "Risk",
    description: "Portfolio review, sizing, and exits.",
    icon: ShieldCheck,
  },
  execution: {
    label: "Execution",
    description: "Trade readiness, routing, and outcomes.",
    icon: CheckCircle2,
  },
  tradingview: {
    label: "TradingView",
    description: "Watchlist and chart-context lane.",
    icon: Link2,
  },
};

export function LiveStream({
  lines,
  liveStatus,
  customPrompt,
  prompts,
  queuedPrompts,
  workspace,
  onCustomPromptChange,
  onSendCommand,
}: LiveStreamProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const [selectedChannel, setSelectedChannel] = useState<ChannelId>("command");
  const showHarnessBoot = liveStatus !== "running" && lines.length < 8 && prompts.length === 0;

  const availableChannels = useMemo<ChannelId[]>(() => {
    const base: ChannelId[] = ["all", "command", "markets", "feeds", "risk", "execution"];
    if (workspace?.channels.includes("tradingview") || workspace?.enabledMarkets.includes("tradingview")) {
      base.push("tradingview");
    }
    return base;
  }, [workspace]);

  useEffect(() => {
    if (!availableChannels.includes(selectedChannel)) {
      setSelectedChannel("command");
    }
  }, [availableChannels, selectedChannel]);

  const messages = useMemo(
    () => buildMessages(prompts, lines),
    [prompts, lines]
  );

  const channelCounts = useMemo(() => {
    const counts = new Map<ChannelId, number>();
    counts.set("all", messages.length);
    for (const channel of availableChannels) {
      if (channel === "all") continue;
      counts.set(channel, messages.filter((message) => message.channel === channel).length);
    }
    return counts;
  }, [availableChannels, messages]);

  const filteredMessages = useMemo(() => {
    if (selectedChannel === "all") {
      return messages;
    }
    return messages.filter((message) => message.channel === selectedChannel);
  }, [messages, selectedChannel]);

  const quickPrompts = useMemo(
    () => getQuickPrompts(selectedChannel, workspace),
    [selectedChannel, workspace]
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [filteredMessages.length, showHarnessBoot]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[linear-gradient(180deg,#120815_0%,#190b17_32%,#120815_100%)] text-[#f7e6ee]">
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden min-h-0 overflow-hidden border-r border-[#4f3042] bg-[#1b0c18]/85 xl:block">
          <div className="flex h-full min-h-0 flex-col">
            <div className="border-b border-[#4f3042] px-4 py-4">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.28em] text-[#f3a96f]">
                Messaging channels
              </p>
              <p className="mt-2 text-sm leading-6 text-[#e6cfda]/72">
                Route prompts by desk so the assistant knows whether you want markets, feeds,
                risk, execution, or TradingView context.
              </p>
            </div>

            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-2 p-3">
                {availableChannels.map((channel) => (
                  <ChannelButton
                    key={channel}
                    channel={channel}
                    selected={selectedChannel === channel}
                    count={channelCounts.get(channel) || 0}
                    onClick={() => setSelectedChannel(channel)}
                  />
                ))}

                <div className="mt-4 rounded-[1.2rem] border border-[#58364c] bg-[#271120]/80 p-3">
                  <p className="font-mono text-[0.66rem] uppercase tracking-[0.24em] text-[#f3a96f]">
                    Connectors
                  </p>
                  <div className="mt-3 space-y-2 text-[12px]">
                    <ConnectorRow
                      label={workspace?.primaryMarket || "kalshi"}
                      detail={workspace?.mode === "live" ? "live rail armed" : "paper rail active"}
                    />
                    <ConnectorRow
                      label="feeds"
                      detail={workspace?.integrations.join(", ") || "apify, rss"}
                    />
                    {workspace?.tradingview.enabled ? (
                      <ConnectorRow
                        label="tradingview"
                        detail={
                          workspace.tradingview.connectorMode === "mcp"
                            ? workspace.tradingview.configured
                              ? `${workspace.tradingview.transport} mcp ready`
                              : `${workspace.tradingview.transport} mcp needs setup`
                            : `watchlist: ${workspace.tradingview.watchlist.join(", ")}`
                        }
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        </aside>

        <div className="flex min-h-0 flex-col overflow-hidden">
          <div className="border-b border-[#4f3042] bg-[#1b0c18]/75 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.28em] text-[#f3a96f]">
                  Chat cockpit
                </p>
                <div className="mt-2 flex items-center gap-2 text-sm text-[#f4dfea]">
                  <Radio className={`h-3.5 w-3.5 ${liveStatus === "running" ? "text-emerald-400" : "text-[#f3a96f]"}`} />
                  <span>{selectedChannel === "all" ? "All channels" : CHANNEL_META[selectedChannel].label}</span>
                  <span className="text-[#8b6578]">/</span>
                  <span className="text-[#d4b5c3]/72">
                    {selectedChannel === "all"
                      ? "Full operator conversation"
                      : CHANNEL_META[selectedChannel].description}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 xl:hidden">
                {availableChannels.map((channel) => (
                  <CompactChannelButton
                    key={channel}
                    channel={channel}
                    selected={selectedChannel === channel}
                    onClick={() => setSelectedChannel(channel)}
                  />
                ))}
              </div>
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-4 p-4">
              {showHarnessBoot ? (
                <HarnessBootPanel
                  workspace={workspace}
                  onLaunchMission={(prompt) => onSendCommand(prompt, "command")}
                />
              ) : null}

              {showHarnessBoot ? (
                <p className="px-1 text-center text-xs text-[#c9abbb]/48">
                  Pick a mission above or drop your own prompt into the selected channel.
                </p>
              ) : null}

              {!showHarnessBoot && filteredMessages.length === 0 ? (
                <div className="rounded-[1.2rem] border border-dashed border-[#5c3b4f] bg-[#1b0c18]/45 px-4 py-5 text-sm text-[#d3bac6]/68">
                  No messages in this channel yet. Send a prompt to start the conversation.
                </div>
              ) : null}

              {filteredMessages.map((message) => (
                <ChatBlock key={message.id} message={message} />
              ))}

              {liveStatus === "running" && filteredMessages.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-6">
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400 [animation-delay:0ms]" />
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400 [animation-delay:150ms]" />
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400 [animation-delay:300ms]" />
                </div>
              ) : null}

              <div ref={endRef} />
            </div>
          </ScrollArea>

          <div className="border-t border-[#4f3042] bg-[#1b0c18]/80 px-4 py-3">
            {queuedPrompts.length > 0 ? (
              <div className="mb-3 rounded-[1rem] border border-[#654154] bg-[#2a1121] px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[#84586f] bg-[#3b1730] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[#f3a96f]">
                    queue
                  </span>
                  <span className="text-[12px] text-[#f4dfea]/84">
                    {queuedPrompts.length} prompt{queuedPrompts.length === 1 ? "" : "s"} waiting for the current pass to finish.
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {queuedPrompts.map((prompt) => (
                    <span
                      key={prompt.id}
                      className="rounded-full border border-[#724b62] bg-[#4a2038]/58 px-3 py-1 text-[11px] text-[#f4dfea]/78"
                    >
                      {prompt.channel}: {prompt.text.slice(0, 72)}
                      {prompt.text.length > 72 ? "..." : ""}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mb-3 flex flex-wrap gap-2">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => onSendCommand(prompt, selectedChannel === "all" ? "command" : selectedChannel)}
                  className="rounded-full border border-[#654154] bg-[#311425] px-3 py-1.5 text-[11px] text-[#f4dfea]/82 transition-colors hover:border-[#92667f] hover:bg-[#442039]"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 rounded-[1.2rem] border border-[#654154] bg-[#2a1121] px-3 py-2">
              <span className="rounded-full border border-[#84586f] bg-[#3b1730] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[#f3a96f]">
                {selectedChannel === "all" ? "command" : selectedChannel}
              </span>
              <input
                type="text"
                value={customPrompt}
                onChange={(event) => onCustomPromptChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && customPrompt.trim()) {
                    onSendCommand(customPrompt, selectedChannel === "all" ? "command" : selectedChannel);
                    onCustomPromptChange("");
                  }
                }}
                placeholder={getPlaceholder(selectedChannel, workspace)}
                className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#a88598]"
              />
              <button
                onClick={() => {
                  if (customPrompt.trim()) {
                    onSendCommand(customPrompt, selectedChannel === "all" ? "command" : selectedChannel);
                    onCustomPromptChange("");
                  }
                }}
                className="rounded-full border border-[#84586f] bg-[#3b1730] p-2 text-[#ffd7ae] transition-colors hover:border-[#b47f99] hover:bg-[#53233f]"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChannelButton({
  channel,
  selected,
  count,
  onClick,
}: {
  channel: ChannelId;
  selected: boolean;
  count: number;
  onClick: () => void;
}) {
  if (channel === "all") {
    return (
      <button
        onClick={onClick}
        className={`w-full rounded-[1rem] border px-3 py-3 text-left transition-colors ${
          selected
            ? "border-[#95687f] bg-[#3d182f] text-white"
            : "border-[#523345] bg-[#24101d] text-[#dec4d0] hover:border-[#7c5469] hover:bg-[#311425]"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[0.68rem] uppercase tracking-[0.22em]">All channels</span>
          <span className="rounded-full border border-current/20 px-2 py-0.5 text-[10px]">{count}</span>
        </div>
        <p className="mt-2 text-[12px] text-current/70">Full operator conversation across every lane.</p>
      </button>
    );
  }

  const meta = CHANNEL_META[channel];
  const Icon = meta.icon;

  return (
    <button
      onClick={onClick}
      className={`w-full rounded-[1rem] border px-3 py-3 text-left transition-colors ${
        selected
          ? "border-[#95687f] bg-[#3d182f] text-white"
          : "border-[#523345] bg-[#24101d] text-[#dec4d0] hover:border-[#7c5469] hover:bg-[#311425]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-mono text-[0.68rem] uppercase tracking-[0.22em]">
          <Icon className="h-3.5 w-3.5" />
          {meta.label}
        </span>
        <span className="rounded-full border border-current/20 px-2 py-0.5 text-[10px]">{count}</span>
      </div>
      <p className="mt-2 text-[12px] text-current/70">{meta.description}</p>
    </button>
  );
}

function CompactChannelButton({
  channel,
  selected,
  onClick,
}: {
  channel: ChannelId;
  selected: boolean;
  onClick: () => void;
}) {
  const label = channel === "all" ? "All" : CHANNEL_META[channel].label;
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] ${
        selected
          ? "border-[#95687f] bg-[#3d182f] text-white"
          : "border-[#523345] bg-[#24101d] text-[#dec4d0]"
      }`}
    >
      {label}
    </button>
  );
}

function ConnectorRow({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="rounded-lg border border-[#4e3143] bg-[#1d0d18] px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#f3a96f]">{label}</p>
      <p className="mt-1 text-[12px] leading-5 text-[#ead4de]/70">{detail}</p>
    </div>
  );
}

function ChatBlock({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-[1.2rem] border border-[#8c5e77] bg-[#4a2038] px-4 py-3 shadow-[0_10px_30px_rgba(24,6,14,0.25)]">
          <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[#ffd7ae]">
            <span>Operator</span>
            <span className="text-[#b6859d]">/</span>
            <span>{message.channel}</span>
          </div>
          <p className="text-sm leading-7 text-[#fff3f8]">{message.body}</p>
        </div>
      </div>
    );
  }

  if (message.role === "tool") {
    return <ToolBlock message={message} />;
  }

  const title = message.role === "result" ? "Cycle complete" : "Harness";
  const borderColor = message.role === "result" ? "border-emerald-400/30" : "border-[#5c3b4f]";
  const background = message.role === "result" ? "bg-emerald-500/10" : "bg-[#21111b]";

  return (
    <div className={`max-w-[92%] rounded-[1.2rem] border ${borderColor} ${background} px-4 py-3 shadow-[0_10px_30px_rgba(24,6,14,0.18)]`}>
      <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[#f3a96f]">
        <span>{title}</span>
        <span className="text-[#765268]">/</span>
        <span>{message.channel}</span>
      </div>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {message.body}
      </ReactMarkdown>
    </div>
  );
}

function ToolBlock({
  message,
}: {
  message: Extract<ChatMessage, { role: "tool" }>;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="max-w-[92%] rounded-[1.2rem] border border-[#5c3b4f] bg-[#1c0d16] px-4 py-3">
      <button
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-start gap-2 text-left"
      >
        <span className="mt-0.5 text-[#b793a5]">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[#f3a96f]">
            <span>Tool trace</span>
            <span className="text-[#765268]">/</span>
            <span>{message.channel}</span>
          </div>
          <p className="mt-2 text-[12px] leading-6 text-[#e6cfda]/74">
            {message.tools
              .map((item) => item.tool.tool || "tool")
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </button>

      {expanded ? (
        <div className="mt-3 space-y-2 border-t border-[#4f3042] pt-3">
          {message.tools.map((item, index) => (
            <div key={`${message.id}-${index}`} className="rounded-lg border border-[#4e3143] bg-[#130913]">
              {item.tool.input ? (
                <pre className="whitespace-pre-wrap break-all px-3 py-2 font-mono text-[11px] leading-6 text-[#e8d4dd]/72">
                  {item.tool.input}
                </pre>
              ) : null}
              {item.result?.text ? (
                <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap break-all border-t border-[#4e3143] px-3 py-2 font-mono text-[11px] leading-6 text-[#bda1af]">
                  {item.result.text}
                </pre>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function buildMessages(prompts: PromptEntry[], lines: StreamLine[]): ChatMessage[] {
  const promptMessages: ChatMessage[] = prompts.map((prompt) => ({
    id: prompt.id,
    role: "user",
    channel: (prompt.channel as ChannelId) || "command",
    body: prompt.state === "queued" ? `${prompt.text}\n\n_Queued until the current run finishes._` : prompt.text,
    createdAt: prompt.createdAt,
  }));

  const grouped = groupLines(lines);
  const streamMessages: ChatMessage[] = grouped.map((group, index) => {
    const createdAt = new Date(Date.now() + index).toISOString();
    if (group.kind === "text") {
      return {
        id: `stream-text-${index}`,
        role: "assistant",
        channel: classifyChannel(group.text),
        body: group.text,
        createdAt,
      };
    }

    if (group.kind === "result") {
      return {
        id: `stream-result-${index}`,
        role: "result",
        channel: classifyChannel(group.result),
        body: group.result,
        createdAt,
      };
    }

    return {
      id: `stream-tool-${index}`,
      role: "tool",
      channel: classifyToolChannel(group.tools),
      tools: group.tools,
      createdAt,
    };
  });

  return [...promptMessages, ...streamMessages];
}

function groupLines(lines: StreamLine[]): GroupedLine[] {
  const out: GroupedLine[] = [];
  let textBuffer = "";
  let toolBuffer: { tool: StreamLine; result?: StreamLine }[] = [];

  const flushText = () => {
    if (textBuffer.trim()) {
      out.push({ kind: "text", text: textBuffer.trim() });
    }
    textBuffer = "";
  };

  const flushTools = () => {
    if (toolBuffer.length > 0) {
      out.push({ kind: "tools", tools: [...toolBuffer] });
      toolBuffer = [];
    }
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.type === "text") {
      flushTools();
      textBuffer += `${textBuffer ? "\n" : ""}${line.text || ""}`;
      continue;
    }

    if (line.type === "tool_use") {
      flushText();
      const next = lines[index + 1];
      const result = next?.type === "tool_result" ? next : undefined;
      toolBuffer.push({ tool: line, result });
      if (result) index += 1;
      continue;
    }

    if (line.type === "result") {
      flushText();
      flushTools();
      out.push({ kind: "result", result: line.result || "" });
    }
  }

  flushText();
  flushTools();
  return out;
}

function classifyToolChannel(tools: { tool: StreamLine; result?: StreamLine }[]): ChannelId {
  const haystack = tools
    .map((item) => `${item.tool.tool || ""} ${item.tool.input || ""} ${item.result?.text || ""}`.toLowerCase())
    .join(" ");
  return classifyChannel(haystack);
}

function classifyChannel(text: string): ChannelId {
  const value = text.toLowerCase();
  if (value.includes("tradingview") || value.includes("watchlist") || value.includes("chart")) {
    return "tradingview";
  }
  if (value.includes("risk") || value.includes("portfolio") || value.includes("exposure") || value.includes("kelly") || value.includes("exit")) {
    return "risk";
  }
  if (value.includes("trade") || value.includes("execution") || value.includes("order") || value.includes("fill") || value.includes("contracts")) {
    return "execution";
  }
  if (value.includes("news") || value.includes("rss") || value.includes("twitter") || value.includes("reddit") || value.includes("tiktok") || value.includes("headline") || value.includes("feed")) {
    return "feeds";
  }
  if (value.includes("kalshi") || value.includes("polymarket") || value.includes("market") || value.includes("bid") || value.includes("ask") || value.includes("probability")) {
    return "markets";
  }
  return "command";
}

function getQuickPrompts(channel: ChannelId, workspace: WorkspaceSummary | null) {
  const watchlist = workspace?.tradingview.watchlist.join(", ") || "SPY, QQQ, BTCUSD, NQ1!";

  switch (channel) {
    case "markets":
      return [
        "Compare the strongest overlapping Kalshi and Polymarket themes.",
        "Find one liquid macro contract worth deeper work.",
      ];
    case "feeds":
      return [
        "Summarize what changed in the last hour.",
        "Separate new information from priced-in narrative.",
      ];
    case "risk":
      return [
        "Audit the open book and tell me what should be cut.",
        "List the weakest assumption in each active thesis.",
      ];
    case "execution":
      return [
        "Tell me if there is one executable trade right now or a clear pass.",
        "Check supported rails before proposing a trade.",
      ];
    case "tradingview":
      return [
        `Scan the TradingView watchlist: ${watchlist}.`,
        "Tell me which symbols deserve a closer look and why.",
      ];
    case "all":
      return [
        "Explain the full workspace setup.",
        "Give me the smartest next command.",
      ];
    default:
      return [
        "Audit the workspace and tell me what is missing.",
        "Warm boot the harness and propose the best paper trade.",
      ];
  }
}

function getPlaceholder(channel: ChannelId, workspace: WorkspaceSummary | null) {
  if (channel === "tradingview") {
    const watchlist = workspace?.tradingview.watchlist.join(", ") || "SPY, QQQ, BTCUSD, NQ1!";
    return `Ask about the TradingView lane, watchlist, or connector setup (${watchlist})`;
  }
  if (channel === "risk") {
    return "Ask for exits, exposure review, weak theses, or sizing discipline";
  }
  if (channel === "execution") {
    return "Ask whether a trade is actually supported, executable, and worth firing";
  }
  if (channel === "feeds") {
    return "Ask what changed in the feeds and what matters now";
  }
  if (channel === "markets") {
    return "Ask for a cross-market scan, compare rails, or find a contract";
  }
  return "Ask the harness what to scan, compare, explain, or trade";
}

const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="mb-1 text-[13px] font-bold text-white first:mt-0">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mb-1 text-[12px] font-bold text-white first:mt-0">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mb-0.5 text-[11px] font-semibold text-[#fff7fb] first:mt-0">{children}</h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-1 text-[12px] leading-7 text-[#f2dce5]/84 last:mb-0">{children}</p>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-white">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="text-[#ffd7ae]">{children}</em>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="ml-4 mb-1 list-disc space-y-0 text-[12px] text-[#f2dce5]/84">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="ml-4 mb-1 list-decimal space-y-0 text-[12px] text-[#f2dce5]/84">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="leading-7">{children}</li>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[#ffd7ae] underline underline-offset-2 transition-colors hover:text-white"
    >
      {children}
    </a>
  ),
  code: ({ children, className }: { children?: React.ReactNode; className?: string }) => {
    if (className?.includes("language-")) {
      return (
        <code className="my-1 block overflow-x-auto rounded bg-[#120913] px-2.5 py-1.5 font-mono text-[10px] text-[#f7e6ee]/70">
          {children}
        </code>
      );
    }
    return (
      <code className="rounded bg-[#120913] px-1 py-0.5 font-mono text-[10px] text-[#ffd7ae]">
        {children}
      </code>
    );
  },
  pre: ({ children }: { children?: React.ReactNode }) => <pre className="my-1">{children}</pre>,
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="my-1 border-l-2 border-[#8f627a] pl-2.5 italic text-[#d6bdc8]">
      {children}
    </blockquote>
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-1.5 overflow-x-auto rounded border border-[#5c3b4f]">
      <table className="w-full text-[10px]">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead className="border-b border-[#5c3b4f] bg-[#2a1121]">{children}</thead>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="px-2 py-1 text-left font-semibold text-[#fff3f8]/75">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border-t border-[#4f3042] px-2 py-1 font-mono text-[#ead4de]/68">{children}</td>
  ),
  hr: () => <hr className="my-2 border-[#4f3042]" />,
};
