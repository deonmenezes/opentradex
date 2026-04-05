"use client";

import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowUpDown } from "lucide-react";
import type { Market } from "@/lib/types";
import { kalshiUrl } from "@/lib/types";

interface MarketScannerProps {
  markets: Market[];
}

type SortKey = "volume" | "mid" | "ticker";

export function MarketScanner({ markets }: MarketScannerProps) {
  const [sortBy, setSortBy] = useState<SortKey>("volume");

  const sorted = [...markets].sort((a, b) => {
    if (sortBy === "volume") return b.volume - a.volume;
    if (sortBy === "mid") return b.mid - a.mid;
    return a.ticker.localeCompare(b.ticker);
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="h-9 flex items-center justify-between px-3 border-b border-border bg-card shrink-0">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Markets
        </span>
        <button
          onClick={() =>
            setSortBy((p) =>
              p === "volume" ? "mid" : p === "mid" ? "ticker" : "volume"
            )
          }
          className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          <ArrowUpDown className="h-2.5 w-2.5" />
          {sortBy}
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full">
          <table className="w-full text-[10px]">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="text-muted-foreground/40 border-b border-border/50">
                <th className="text-left px-3 py-1.5 font-medium">Ticker</th>
                <th className="text-right px-2 py-1.5 font-medium w-16">Bid/Ask</th>
                <th className="text-right px-2 py-1.5 font-medium w-12">Mid</th>
                <th className="text-right px-3 py-1.5 font-medium w-14">Vol</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((m) => (
                <tr
                  key={m.id}
                  className="border-b border-border/20 hover:bg-secondary/20 transition-colors"
                >
                  <td className="px-3 py-1.5">
                    <a
                      href={kalshiUrl(m.ticker, m.title)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block hover:text-primary transition-colors"
                    >
                      <div className="font-mono font-medium truncate max-w-[140px]">
                        {m.ticker}
                      </div>
                      <div className="text-muted-foreground/30 truncate max-w-[140px] text-[9px]">
                        {m.title}
                      </div>
                    </a>
                  </td>
                  <td className="text-right px-2 py-1.5 font-mono text-muted-foreground/50">
                    {m.yes_bid.toFixed(0)}
                    <span className="text-muted-foreground/20">/</span>
                    {m.yes_ask.toFixed(0)}
                  </td>
                  <td className="text-right px-2 py-1.5 font-mono font-medium">
                    {(m.mid * 100).toFixed(0)}
                    <span className="text-muted-foreground/30">%</span>
                  </td>
                  <td className="text-right px-3 py-1.5 font-mono text-muted-foreground/50">
                    {formatVolume(m.volume)}
                  </td>
                </tr>
              ))}
              {markets.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="text-center py-8 text-muted-foreground/30"
                  >
                    No market data
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </ScrollArea>
      </div>
    </div>
  );
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}
