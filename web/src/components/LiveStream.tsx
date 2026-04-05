"use client";

import { useRef, useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send,
  Terminal,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";
import type { StreamLine } from "@/lib/types";

interface LiveStreamProps {
  lines: StreamLine[];
  liveStatus: string;
  customPrompt: string;
  onCustomPromptChange: (v: string) => void;
  onSendCommand: (prompt: string) => void;
}

export function LiveStream({
  lines,
  liveStatus,
  customPrompt,
  onCustomPromptChange,
  onSendCommand,
}: LiveStreamProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const prevLinesCount = useRef(0);

  useEffect(() => {
    if (lines.length > 0 && lines.length !== prevLinesCount.current) {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    prevLinesCount.current = lines.length;
  }, [lines.length]);

  const grouped = groupLines(lines);

  return (
    <div className="flex flex-col h-full">
      <div className="h-9 flex items-center justify-between px-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Live Stream
          </span>
        </div>
        {liveStatus === "running" && (
          <span className="text-[10px] text-primary font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary pulse-glow" />
            Streaming
          </span>
        )}
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 space-y-0.5">
          {lines.length === 0 && liveStatus !== "running" && (
            <p className="text-muted-foreground/40 text-center py-12 text-xs">
              Run a cycle to see live agent output
            </p>
          )}
          {lines.length === 0 && liveStatus === "running" && (
            <div className="flex items-center gap-2 justify-center py-12">
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
            </div>
          )}
          {grouped.map((group, i) => (
            <GroupedBlock key={i} group={group} />
          ))}
          <div ref={endRef} />
        </div>
      </ScrollArea>

      <div className="h-11 flex items-center gap-2 px-3 border-t border-border bg-card shrink-0">
        <span className="text-muted-foreground/30 text-xs font-mono">
          {">"}
        </span>
        <input
          type="text"
          value={customPrompt}
          onChange={(e) => onCustomPromptChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && customPrompt.trim()) {
              onSendCommand(customPrompt);
              onCustomPromptChange("");
            }
          }}
          placeholder="Send a command to the agent..."
          className="flex-1 bg-transparent text-xs focus:outline-none placeholder:text-muted-foreground/30"
        />
        <button
          onClick={() => {
            if (customPrompt.trim()) {
              onSendCommand(customPrompt);
              onCustomPromptChange("");
            }
          }}
          className="text-muted-foreground/40 hover:text-primary transition-colors"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

type GroupedLine =
  | { kind: "text"; text: string }
  | { kind: "tools"; tools: { tool: StreamLine; result?: StreamLine }[] }
  | { kind: "result"; result: string };

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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.type === "text") {
      flushTools();
      textBuffer += (textBuffer ? "\n" : "") + (line.text || "");
    } else if (line.type === "tool_use") {
      flushText();
      const next = lines[i + 1];
      const result = next?.type === "tool_result" ? next : undefined;
      toolBuffer.push({ tool: line, result });
      if (result) i++;
    } else if (line.type === "tool_result") {
      // orphan
    } else if (line.type === "result") {
      flushText();
      flushTools();
      out.push({ kind: "result", result: line.result || "" });
    }
  }
  flushText();
  flushTools();
  return out;
}

function GroupedBlock({ group }: { group: GroupedLine }) {
  if (group.kind === "text") return <TextBlock text={group.text} />;
  if (group.kind === "tools") return <ToolGroup tools={group.tools} />;
  if (group.kind === "result") return <ResultBlock text={group.result} />;
  return null;
}

function TextBlock({ text }: { text: string }) {
  return (
    <div className="py-1 px-1">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

function ResultBlock({ text }: { text: string }) {
  return (
    <div className="my-2 rounded-lg border border-primary/20 bg-primary/5 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-primary/10">
        <CheckCircle2 className="h-3 w-3 text-primary" />
        <span className="text-[10px] text-primary font-semibold uppercase tracking-wider">
          Cycle Complete
        </span>
      </div>
      <div className="p-3">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={markdownComponents}
        >
          {text}
        </ReactMarkdown>
      </div>
    </div>
  );
}

function ToolGroup({
  tools,
}: {
  tools: { tool: StreamLine; result?: StreamLine }[];
}) {
  const [expanded, setExpanded] = useState(false);

  const summary = tools
    .map((t) => {
      const name = t.tool.tool || "tool";
      const short = formatToolInput(t.tool.input || "");
      return { name, short };
    });

  return (
    <div className="my-0.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-1.5 px-1 py-0.5 text-left hover:bg-secondary/20 rounded transition-colors group"
      >
        <span className="text-muted-foreground/30 mt-px shrink-0">
          {expanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </span>
        <div className="flex flex-wrap gap-x-3 gap-y-0 flex-1 min-w-0">
          {summary.map((s, i) => (
            <span key={i} className="flex items-center gap-1 text-[10px] text-muted-foreground/50 font-mono shrink-0">
              <span className="text-primary/50 font-medium">{s.name}</span>
              <span className="truncate max-w-[200px]">{s.short}</span>
              {tools[i].result && (
                <CheckCircle2 className="h-2.5 w-2.5 text-primary/30 shrink-0" />
              )}
            </span>
          ))}
        </div>
      </button>

      {expanded && (
        <div className="ml-4 mt-1 space-y-1 mb-1">
          {tools.map((t, i) => (
            <ToolDetail key={i} tool={t.tool} result={t.result} />
          ))}
        </div>
      )}
    </div>
  );
}

function ToolDetail({
  tool,
  result,
}: {
  tool: StreamLine;
  result?: StreamLine;
}) {
  const resultText = result?.text;
  const isNoOutput =
    resultText === "(Bash completed with no output)" || !resultText;

  return (
    <div className="rounded border border-border/30 bg-background/30 text-[10px]">
      {tool.input && (
        <pre className="px-2.5 py-1.5 font-mono text-muted-foreground/50 whitespace-pre-wrap break-all leading-relaxed">
          {tool.input}
        </pre>
      )}
      {resultText && !isNoOutput && (
        <pre className="px-2.5 py-1.5 font-mono text-muted-foreground/40 whitespace-pre-wrap break-all max-h-32 overflow-y-auto leading-relaxed border-t border-border/20">
          {resultText}
        </pre>
      )}
    </div>
  );
}

const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-[13px] font-bold text-foreground mt-2.5 mb-1 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-[12px] font-bold text-foreground mt-2 mb-1 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-[11px] font-semibold text-foreground/90 mt-2 mb-0.5 first:mt-0">
      {children}
    </h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="text-[12px] text-foreground/80 leading-relaxed mb-1 last:mb-0">
      {children}
    </p>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="text-foreground/60">{children}</em>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="text-[12px] text-foreground/80 ml-3 mb-1 space-y-0 list-disc list-outside">
      {children}
    </ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="text-[12px] text-foreground/80 ml-3 mb-1 space-y-0 list-decimal list-outside">
      {children}
    </ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary/80 hover:text-primary underline underline-offset-2 transition-colors"
    >
      {children}
    </a>
  ),
  code: ({ children, className }: { children?: React.ReactNode; className?: string }) => {
    if (className?.includes("language-")) {
      return (
        <code className="block bg-background/50 border border-border/30 rounded px-2.5 py-1.5 text-[10px] font-mono text-foreground/60 overflow-x-auto my-1 whitespace-pre">
          {children}
        </code>
      );
    }
    return (
      <code className="bg-background/50 rounded px-1 py-0.5 text-[10px] font-mono text-primary/70">
        {children}
      </code>
    );
  },
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="my-1">{children}</pre>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-2 border-primary/20 pl-2.5 my-1 text-foreground/50 italic">
      {children}
    </blockquote>
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="overflow-x-auto my-1.5 rounded border border-border/30">
      <table className="w-full text-[10px]">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead className="bg-secondary/30 border-b border-border/30">
      {children}
    </thead>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="text-left px-2 py-1 font-semibold text-foreground/70 text-[10px]">
      {children}
    </th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="px-2 py-1 text-foreground/60 border-t border-border/15 font-mono">
      {children}
    </td>
  ),
  hr: () => <hr className="border-border/20 my-2" />,
};

function formatToolInput(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    if (parsed.command) {
      const cmd = parsed.command as string;
      return cmd.length > 60 ? cmd.slice(0, 60) + "..." : cmd;
    }
    if (parsed.query) return parsed.query;
    if (parsed.file_path) {
      const fp = parsed.file_path as string;
      const parts = fp.split("/");
      return parts.length > 2 ? ".../" + parts.slice(-2).join("/") : fp;
    }
    if (parsed.pattern) return parsed.pattern;
    return raw.length > 60 ? raw.slice(0, 60) + "..." : raw;
  } catch {
    return raw.length > 60 ? raw.slice(0, 60) + "..." : raw;
  }
}
