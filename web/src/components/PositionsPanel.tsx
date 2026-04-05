"use client";

import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExternalLink, ChevronDown, ChevronRight } from "lucide-react";
import type { Trade, PositionPrice } from "@/lib/types";
import { kalshiUrl } from "@/lib/types";

interface PositionsPanelProps {
  positions: Trade[];
  trades: Trade[];
  prices?: PositionPrice[];
}

export function PositionsPanel({ positions, trades, prices = [] }: PositionsPanelProps) {
  const priceMap = new Map(prices.map((p) => [p.ticker, p]));
  const totalUnrealized = prices.reduce((sum, p) => sum + p.unrealized_pnl, 0);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="h-9 flex items-center justify-between px-3 border-b border-border bg-card shrink-0">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Positions
        </span>
        <div className="flex items-center gap-2">
          {prices.length > 0 && (
            <span
              className={`text-[10px] font-mono font-medium ${
                totalUnrealized >= 0 ? "text-primary" : "text-destructive"
              }`}
            >
              {totalUnrealized >= 0 ? "+" : ""}${totalUnrealized.toFixed(2)}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground/50 font-mono">
            {positions.length}
          </span>
        </div>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 space-y-1">
          {positions.length === 0 && (
            <p className="text-xs text-muted-foreground/40 py-8 text-center">
              No open positions
            </p>
          )}
          {positions.map((t) => (
            <PositionCard key={t.id} trade={t} price={priceMap.get(t.ticker)} />
          ))}

          {trades.length > 0 && (
            <div className="pt-2">
              <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-medium px-2 pb-1">
                Recent Trades
              </p>
              {trades.slice(0, 10).map((t) => (
                <TradeRow key={t.id} trade={t} />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function PositionCard({ trade: t, price }: { trade: Trade; price?: PositionPrice }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-md bg-secondary/20 overflow-hidden">
      <button
        className="w-full text-left px-3 py-2.5 hover:bg-secondary/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-muted-foreground/40 shrink-0">
              {expanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </span>
            <span className="font-mono text-[11px] font-medium truncate">
              {t.ticker}
            </span>
            <a
              href={kalshiUrl(t.ticker, t.title)}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-muted-foreground/30 hover:text-primary transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {price && (
              <span
                className={`text-[10px] font-mono font-medium ${
                  price.unrealized_pnl >= 0 ? "text-primary" : "text-destructive"
                }`}
              >
                {price.unrealized_pnl >= 0 ? "+" : ""}${price.unrealized_pnl.toFixed(2)}
              </span>
            )}
            <span
              className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                t.side === "yes"
                  ? "bg-primary/15 text-primary"
                  : "bg-destructive/15 text-destructive"
              }`}
            >
              {t.side.toUpperCase()}
            </span>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground/50 truncate mt-1 pl-[18px]">
          {t.title}
        </p>

        <div className="flex items-center gap-3 mt-1 pl-[18px] text-[10px]">
          <span className="text-muted-foreground/60 font-mono">
            {t.contracts}x @ ${t.entry_price.toFixed(2)}
          </span>
          {price && (
            <span className="text-muted-foreground/40 font-mono">
              now ${price.mark_price.toFixed(2)}
            </span>
          )}
          <span className="text-primary font-medium">
            {(t.edge * 100).toFixed(1)}pp
          </span>
          <span className="text-muted-foreground/40 capitalize text-[9px]">
            {t.confidence}
          </span>
        </div>
      </button>

      {expanded && t.reasoning && (
        <div className="px-3 pb-2.5 border-t border-border/20">
          <div className="pl-[18px] pt-2">
            <p className="text-[11px] text-foreground/70 leading-relaxed whitespace-pre-wrap">
              {t.reasoning}
            </p>
            {t.estimated_prob > 0 && (
              <div className="flex gap-4 mt-2 text-[10px] text-muted-foreground/50 font-mono">
                <span>est {(t.estimated_prob * 100).toFixed(0)}%</span>
                <span>mkt {(t.entry_price * 100).toFixed(0)}%</span>
                <span className="text-primary/70">
                  edge {(t.edge * 100).toFixed(1)}pp
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TradeRow({ trade: t }: { trade: Trade }) {
  return (
    <a
      href={kalshiUrl(t.ticker, t.title)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-secondary/20 transition-colors group"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={`text-[10px] font-mono ${
            t.outcome === "win"
              ? "text-primary"
              : t.outcome === "loss"
                ? "text-destructive"
                : "text-muted-foreground/40"
          }`}
        >
          {t.outcome === "win" ? "+" : t.outcome === "loss" ? "-" : "~"}
        </span>
        <span className="font-mono text-[10px] truncate text-muted-foreground/70 group-hover:text-foreground/80 transition-colors">
          {t.ticker}
        </span>
        <span
          className={`text-[9px] ${t.side === "yes" ? "text-primary/50" : "text-destructive/50"}`}
        >
          {t.side.toUpperCase()}
        </span>
      </div>
      <div className="flex items-center gap-2 text-[10px] shrink-0">
        {t.settled ? (
          <span
            className={`font-mono ${t.pnl >= 0 ? "text-primary/70" : "text-destructive/70"}`}
          >
            {t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}
          </span>
        ) : (
          <span className="text-muted-foreground/30">open</span>
        )}
        <span className="text-muted-foreground/25 text-[9px]">
          {formatRelativeTime(t.timestamp)}
        </span>
      </div>
    </a>
  );
}

function formatRelativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}
