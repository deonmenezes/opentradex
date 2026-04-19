import { useState } from 'react';
import type { AgentContext } from '../hooks/useAgentContext';

interface HarnessStatusBadgesProps {
  context: AgentContext | null;
  activeRunCount: number;
}

// Compact status strip for the TopBar (US-014).
// Shows scraper health rollup, trading halt state, active run count, panic cooldown.
// Everything is inferred from /api/agent/context so there's one source of truth.
export default function HarnessStatusBadges({ context, activeRunCount }: HarnessStatusBadgesProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  if (!context) {
    return (
      <div className="hidden lg:flex items-center gap-1 text-2xs text-text-dim" data-testid="harness-status-loading">
        <div className="w-1.5 h-1.5 rounded-full bg-text-dim/40 animate-pulse" />
        <span>loading…</span>
      </div>
    );
  }

  const scrapers = context.scraperHealth ?? [];
  const green = scrapers.filter((s) => s.status === 'green').length;
  const yellow = scrapers.filter((s) => s.status === 'yellow').length;
  const red = scrapers.filter((s) => s.status === 'red').length;
  const total = scrapers.length || 1;

  const scraperStatus = red > 0 ? 'red' : yellow > 0 ? 'yellow' : green > 0 ? 'green' : 'grey';
  const scraperDot = {
    green: 'bg-accent shadow-sm shadow-accent/40',
    yellow: 'bg-warning',
    red: 'bg-danger animate-pulse',
    grey: 'bg-text-dim/40',
  }[scraperStatus];

  const halted = context.tradingHalted?.halted;
  const cooldownUntil = context.tradingHalted?.cooldownUntil;
  const cooldownSec = cooldownUntil ? Math.max(0, Math.round((cooldownUntil - Date.now()) / 1000)) : 0;

  const aiReady = (context.aiProviders ?? []).some((p) => p.configured);

  return (
    <div className="relative hidden lg:block" data-testid="harness-status">
      <button
        onClick={() => setDetailsOpen((v) => !v)}
        title="Harness health (click for details)"
        data-testid="harness-status-trigger"
        className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-surface-2 border border-border hover:border-accent transition-colors"
      >
        {/* Scrapers */}
        <div className="flex items-center gap-1" data-testid="scraper-badge" data-status={scraperStatus}>
          <div className={`w-1.5 h-1.5 rounded-full ${scraperDot}`} />
          <span className="text-2xs text-text-dim tabular-nums">{green}/{total}</span>
        </div>

        {/* Divider */}
        <div className="w-px h-3 bg-border" />

        {/* Active runs */}
        <div className="flex items-center gap-1" data-testid="active-runs-badge">
          <svg className={`w-3 h-3 ${activeRunCount > 0 ? 'text-accent animate-pulse' : 'text-text-dim'}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-2xs text-text-dim tabular-nums">{activeRunCount}</span>
        </div>

        {/* Halt / cooldown */}
        {halted && (
          <>
            <div className="w-px h-3 bg-border" />
            <div className="flex items-center gap-1" data-testid="halt-badge">
              <svg className="w-3 h-3 text-danger animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              <span className="text-2xs text-danger font-semibold uppercase">
                {cooldownSec > 0 ? `${cooldownSec}s` : 'halt'}
              </span>
            </div>
          </>
        )}

        {/* AI not configured warning */}
        {!aiReady && (
          <>
            <div className="w-px h-3 bg-border" />
            <div className="flex items-center gap-1" data-testid="ai-warning-badge" title="No AI provider configured">
              <svg className="w-3 h-3 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </>
        )}
      </button>

      {detailsOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setDetailsOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 rounded-lg bg-surface border border-border shadow-2xl z-50 overflow-hidden" data-testid="harness-status-details">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
              <h3 className="text-xs font-semibold text-text uppercase tracking-wider">Harness Health</h3>
              <span className="text-2xs text-text-dim">{new Date(context.timestamp).toLocaleTimeString()}</span>
            </div>

            {/* Scrapers detail */}
            <div className="px-3 py-2 border-b border-border">
              <div className="text-2xs text-text-dim uppercase mb-1.5">Scrapers ({scrapers.length})</div>
              <div className="grid grid-cols-2 gap-1">
                {scrapers.map((s) => (
                  <div key={s.name} className="flex items-center gap-1.5 text-2xs">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      s.status === 'green' ? 'bg-accent' : s.status === 'yellow' ? 'bg-warning' : 'bg-danger'
                    }`} />
                    <span className="text-text flex-1 capitalize">{s.name}</span>
                    <span className="text-text-dim tabular-nums">{s.count}</span>
                    <span className="text-text-dim/70 tabular-nums w-8 text-right">{s.ageSec}s</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk state */}
            <div className="px-3 py-2 border-b border-border">
              <div className="text-2xs text-text-dim uppercase mb-1.5">Risk</div>
              <div className="grid grid-cols-2 gap-y-1 text-2xs">
                <span className="text-text-dim">Equity</span>
                <span className="text-text tabular-nums text-right">
                  ${context.risk.equity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
                <span className="text-text-dim">Day P&L</span>
                <span className={`tabular-nums text-right ${context.risk.dailyPnL >= 0 ? 'text-accent' : 'text-danger'}`}>
                  ${context.risk.dailyPnL.toFixed(2)}
                </span>
                <span className="text-text-dim">Open positions</span>
                <span className="text-text tabular-nums text-right">{context.risk.openPositions}</span>
                <span className="text-text-dim">Day trades</span>
                <span className="text-text tabular-nums text-right">{context.risk.dailyTrades}</span>
              </div>
            </div>

            {/* Rails */}
            {context.rails.length > 0 && (
              <div className="px-3 py-2 border-b border-border">
                <div className="text-2xs text-text-dim uppercase mb-1.5">Rails</div>
                <div className="flex flex-wrap gap-1">
                  {context.rails.map((r) => (
                    <span key={r.id} className={`text-2xs px-1.5 py-0.5 rounded ${
                      r.enabled ? 'bg-accent/15 text-accent' : 'bg-surface-2 text-text-dim'
                    }`}>
                      {r.kind}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Trading halt reason */}
            {halted && context.tradingHalted?.reason && (
              <div className="px-3 py-2 bg-danger/10 border-b border-border">
                <div className="text-2xs text-danger font-semibold uppercase mb-0.5">Trading Halted</div>
                <div className="text-2xs text-text">{context.tradingHalted.reason}</div>
                {cooldownSec > 0 && (
                  <div className="text-2xs text-text-dim mt-0.5">Cooldown: {cooldownSec}s remaining</div>
                )}
              </div>
            )}

            <div className="px-3 py-2 flex items-center justify-between bg-bg/40">
              <span className="text-2xs text-text-dim">Mode lock: <span className="text-text font-mono">{context.modeLock}</span></span>
              <button onClick={() => setDetailsOpen(false)} className="text-2xs text-text-dim hover:text-text">
                Close
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
