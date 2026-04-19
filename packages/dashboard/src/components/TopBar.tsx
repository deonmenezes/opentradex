import { useState, useEffect, memo } from 'react';
import type { HarnessStatus, WsMeta } from '../lib/types';
import type { AgentContext } from '../hooks/useAgentContext';
import HarnessStatusBadges from './HarnessStatusBadges';

interface TopBarProps {
  status: HarnessStatus;
  wsMeta?: WsMeta;
  agentContext?: AgentContext | null;
  activeRunCount?: number;
  onRunCycle?: () => void;
  onToggleAutoLoop?: () => void;
  onSetLoopInterval?: (minutes: number) => void;
  onToggleLeftSidebar?: () => void;
  onToggleRightSidebar?: () => void;
  onShowTrades?: () => void;
  onShowMarkets?: () => void;
  onShowPayments?: () => void;
  onShowSkills?: () => void;
  onOpenPalette?: () => void;
  onOpenSetup?: () => void;
  onOpenChain?: () => void;
  onOpenHelp?: () => void;
}

// Memoized TopBar to prevent unnecessary re-renders
export default memo(function TopBar({
  status,
  wsMeta,
  agentContext,
  activeRunCount = 0,
  onRunCycle,
  onToggleAutoLoop,
  onSetLoopInterval,
  onToggleLeftSidebar,
  onToggleRightSidebar,
  onShowTrades,
  onShowMarkets,
  onShowPayments,
  onShowSkills,
  onOpenPalette,
  onOpenSetup,
  onOpenChain,
  onOpenHelp,
}: TopBarProps) {
  const [loopMenuOpen, setLoopMenuOpen] = useState(false);
  const loopIntervals = [1, 2, 5, 10, 15, 30];

  const handlePickInterval = (minutes: number) => {
    setLoopMenuOpen(false);
    if (onSetLoopInterval) onSetLoopInterval(minutes);
    else if (onToggleAutoLoop) onToggleAutoLoop();
  };

  const handleStopLoop = () => {
    setLoopMenuOpen(false);
    if (onSetLoopInterval) onSetLoopInterval(0);
    else if (onToggleAutoLoop) onToggleAutoLoop();
  };
  const [pnlFlash, setPnlFlash] = useState(false);
  const [prevPnL, setPrevPnL] = useState(status.dayPnL);

  // Flash animation when P&L changes
  useEffect(() => {
    if (status.dayPnL !== prevPnL) {
      setPnlFlash(true);
      setPrevPnL(status.dayPnL);
      const timer = setTimeout(() => setPnlFlash(false), 500);
      return () => clearTimeout(timer);
    }
  }, [status.dayPnL, prevPnL]);

  const modeColors = {
    'paper-only': 'bg-accent/20 text-accent border border-accent/30',
    'paper-default': 'bg-warning/20 text-warning border border-warning/30',
    'live-allowed': 'bg-danger/20 text-danger border border-danger/30 animate-pulse',
  };

  const modeLabels = {
    'paper-only': 'PAPER',
    'paper-default': 'PAPER',
    'live-allowed': 'LIVE',
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

  const formatPnL = (n: number) => {
    const sign = n >= 0 ? '+' : '';
    return sign + new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
  };

  return (
    <header className="h-14 md:h-16 bg-surface border-b border-border flex items-center justify-between px-3 md:px-5 shrink-0">
      {/* Left: Mobile Menu + Logo */}
      <div className="flex items-center gap-2 md:gap-4">
        {/* Mobile Menu Button - Left Sidebar */}
        <button
          onClick={onToggleLeftSidebar}
          className="lg:hidden p-2 rounded-lg bg-surface-2 hover:bg-card-hover text-text-dim hover:text-accent transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
          </svg>
        </button>

        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent/60 flex items-center justify-center shadow-lg shadow-accent/20">
            <svg className="w-5 h-5 text-bg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <span className="font-bold text-text hidden sm:block">OPENTRADEX</span>
        </div>

        {/* Connection Status - three-state dot (green/yellow/red) with tooltip */}
        {(() => {
          const conn = status.connection;
          const dotColor =
            conn === 'connected' ? 'bg-accent shadow-sm shadow-accent' :
            conn === 'reconnecting' || conn === 'connecting' ? 'bg-warning animate-pulse' :
            'bg-danger';
          const label =
            conn === 'connected' ? 'Live' :
            conn === 'reconnecting' ? 'Reconnecting' :
            conn === 'connecting' ? 'Connecting' :
            'Offline';
          const latencyStr =
            wsMeta && typeof wsMeta.latencyMs === 'number' && wsMeta.latencyMs >= 0
              ? `${wsMeta.latencyMs}ms`
              : '—';
          const attemptsStr = wsMeta ? wsMeta.attempts : 0;
          const tooltip = `Gateway: ${label}\nLatency: ${latencyStr}\nReconnect attempts: ${attemptsStr}`;
          return (
            <div
              title={tooltip}
              data-testid="connection-badge"
              data-connection={conn}
              className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-surface-2"
            >
              <div className={`w-2 h-2 rounded-full ${dotColor}`} />
              <span className="text-xs text-text-dim">{label}</span>
              {wsMeta && wsMeta.latencyMs >= 0 && conn === 'connected' && (
                <span className="text-2xs text-text-dim/70 tabular-nums">{latencyStr}</span>
              )}
            </div>
          );
        })()}

        {/* Trading Mode — click opens the setup wizard so the user can switch mode + provider */}
        <button
          onClick={onOpenSetup}
          title="Click to change mode / set up an AI provider"
          className={`hidden sm:flex items-center gap-1.5 px-2 md:px-3 py-1 rounded-lg text-xs md:text-sm font-semibold transition-opacity hover:opacity-80 ${modeColors[status.mode]}`}
        >
          {modeLabels[status.mode]}
          <svg className="w-3 h-3 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* Center: Capital & P&L — compact, inline */}
      <div className="flex items-center gap-4 md:gap-5">
        {/* Capital */}
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xs text-text-dim uppercase tracking-wide">Portfolio</span>
          <span className="text-sm md:text-base font-semibold text-text tabular-nums">
            {formatCurrency(status.capital)}
          </span>
        </div>

        {/* Day P&L */}
        <div className={`flex items-baseline gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
          status.dayPnL >= 0 ? 'bg-accent/10' : 'bg-danger/10'
        } ${pnlFlash ? 'ring-1 ring-accent/40' : ''}`}>
          <span className="text-2xs text-text-dim uppercase tracking-wide">Day</span>
          <span className={`text-sm font-semibold tabular-nums ${status.dayPnL >= 0 ? 'text-accent' : 'text-danger'}`}>
            {formatPnL(status.dayPnL)}
          </span>
        </div>

        {/* Central AUTONOMOUS toggle — flips the agent's autoloop on/off.
            Paper-mode by default; live-mode is still gated on `tradingMode=live-allowed`. */}
        <button
          onClick={() => {
            if (status.isAutoLoop) {
              if (onSetLoopInterval) onSetLoopInterval(0);
              else if (onToggleAutoLoop) onToggleAutoLoop();
            } else {
              const minutes = status.cycleInterval || 5;
              if (onSetLoopInterval) onSetLoopInterval(minutes);
              else if (onToggleAutoLoop) onToggleAutoLoop();
            }
          }}
          data-testid="autonomous-toggle"
          data-active={status.isAutoLoop}
          aria-pressed={status.isAutoLoop}
          title={status.isAutoLoop
            ? `Autonomous ON — scanning every ${status.cycleInterval}m. Click to stop.`
            : 'Click to start autonomous trading (paper mode). Live mode still requires explicit confirmation.'}
          className={`relative flex items-center gap-2 px-3 md:px-5 py-2 rounded-lg font-bold text-xs md:text-sm uppercase tracking-wider transition-all ${
            status.isAutoLoop
              ? 'bg-accent text-bg shadow-lg shadow-accent/50 ring-2 ring-accent/60'
              : 'bg-surface-2 text-text-dim border-2 border-dashed border-border hover:border-accent hover:text-accent'
          }`}
        >
          {status.isAutoLoop && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-accent" />
            </span>
          )}
          <svg
            className={`w-4 h-4 ${status.isAutoLoop ? 'animate-spin' : ''}`}
            style={{ animationDuration: '3s' }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2}
              d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="hidden sm:inline">
            {status.isAutoLoop ? `Autonomous · ${status.cycleInterval}m` : 'Autonomous'}
          </span>
          <span className="sm:hidden">
            {status.isAutoLoop ? 'ON' : 'AUTO'}
          </span>
        </button>

        {/* Stats - inline chips on large screens */}
        <div className="hidden xl:flex items-center gap-3 text-xs">
          <button
            onClick={onShowTrades}
            className="flex items-baseline gap-1 text-text-dim hover:text-text transition-colors"
            aria-label="View all trades"
          >
            <span className="text-text font-medium tabular-nums">{status.trades}</span>
            <span>trades</span>
          </button>
          <button
            onClick={onShowMarkets}
            className="flex items-baseline gap-1 text-text-dim hover:text-text transition-colors"
            aria-label="View all markets"
          >
            <span className="text-accent font-medium">live</span>
            <span>markets</span>
          </button>
          <button
            onClick={onShowPayments}
            className="flex items-baseline gap-1 text-text-dim hover:text-text transition-colors"
            aria-label="Agentic payments (x402)"
            title="x402 Agentic Payments"
          >
            <span className="text-accent font-medium">x402</span>
            <span>pay</span>
          </button>
          <div className="flex items-baseline gap-1 text-text-dim">
            <span className={`font-medium tabular-nums ${status.winRate >= 50 ? 'text-accent' : 'text-warning'}`}>{status.winRate}%</span>
            <span>win</span>
          </div>
          <div className="flex items-baseline gap-1 text-text-dim">
            <span className="text-text font-medium tabular-nums">{status.openPositions}</span>
            <span>open</span>
          </div>
        </div>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Harness health badges (scraper/halt/active-runs) */}
        <HarnessStatusBadges context={agentContext ?? null} activeRunCount={activeRunCount} />

        {/* Command Palette trigger (⌘K) */}
        <button
          onClick={onOpenPalette}
          data-testid="palette-trigger"
          title="Open command palette (⌘K)"
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-2 border border-border hover:border-accent transition-colors text-xs text-text-dim hover:text-text"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="hidden md:inline">Skills</span>
          <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-bg text-2xs border border-border font-mono">⌘K</kbd>
        </button>

        {/* Chain builder trigger */}
        {onOpenChain && (
          <button
            onClick={onOpenChain}
            data-testid="chain-trigger"
            title="Build a skill chain (c)"
            className="hidden md:inline-flex p-2 rounded-lg bg-surface-2 hover:bg-card-hover text-text-dim hover:text-accent transition-colors"
            aria-label="Chain builder"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </button>
        )}

        {/* Help trigger */}
        {onOpenHelp && (
          <button
            onClick={onOpenHelp}
            data-testid="help-trigger"
            title="Keyboard shortcuts (?)"
            className="hidden md:inline-flex p-2 rounded-lg bg-surface-2 hover:bg-card-hover text-text-dim hover:text-accent transition-colors"
            aria-label="Keyboard shortcuts"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        )}

        {/* Skills page link */}
        <button
          onClick={onShowSkills}
          data-testid="skills-nav"
          title="Open skills page"
          className="hidden md:inline-flex p-2 rounded-lg bg-surface-2 hover:bg-card-hover text-text-dim hover:text-accent transition-colors"
          aria-label="Skills"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </button>

        {/* Run Cycle - Responsive */}
        <button
          onClick={onRunCycle}
          className="flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-lg bg-accent text-bg font-semibold text-sm shadow-lg shadow-accent/20 hover:shadow-accent/40 hover:scale-105 transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          </svg>
          <span className="hidden sm:inline">Run</span>
        </button>

        {/* Auto Loop with interval picker */}
        <div className="relative hidden sm:block">
          <button
            onClick={() => setLoopMenuOpen((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-sm transition-all ${
              status.isAutoLoop
                ? 'bg-accent text-bg shadow-lg shadow-accent/30'
                : 'bg-surface-2 text-text border border-border hover:border-accent'
            }`}
          >
            <svg className={`w-4 h-4 ${status.isAutoLoop ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="hidden md:inline">
              {status.isAutoLoop ? `Loop · ${status.cycleInterval}m` : 'Loop'}
            </span>
            <svg className="w-3 h-3 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {loopMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setLoopMenuOpen(false)} />
              <div className="absolute right-0 mt-2 w-52 rounded-lg bg-surface border border-border shadow-xl z-50 overflow-hidden">
                <div className="px-3 py-2 text-2xs uppercase tracking-wide text-text-dim border-b border-border">
                  Cron Interval
                </div>
                {loopIntervals.map((m) => (
                  <button
                    key={m}
                    onClick={() => handlePickInterval(m)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-2 transition-colors flex items-center justify-between ${
                      status.isAutoLoop && status.cycleInterval === m ? 'bg-accent/10 text-accent' : 'text-text'
                    }`}
                  >
                    <span>Every {m} minute{m > 1 ? 's' : ''}</span>
                    {status.isAutoLoop && status.cycleInterval === m && (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
                {status.isAutoLoop && (
                  <button
                    onClick={handleStopLoop}
                    className="w-full text-left px-3 py-2 text-sm text-danger hover:bg-danger/10 border-t border-border"
                  >
                    Stop loop
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Mobile Menu Button - Right Sidebar */}
        <button
          onClick={onToggleRightSidebar}
          className="lg:hidden p-2 rounded-lg bg-surface-2 hover:bg-card-hover text-text-dim hover:text-accent transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
        </button>
      </div>
    </header>
  );
});
