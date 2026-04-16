import { useState, useEffect } from 'react';
import type { HarnessStatus } from '../lib/types';

interface TopBarProps {
  status: HarnessStatus;
  onRunCycle?: () => void;
  onToggleAutoLoop?: () => void;
}

export default function TopBar({ status, onRunCycle, onToggleAutoLoop }: TopBarProps) {
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

  const modeIcons = {
    'paper-only': 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    'paper-default': 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    'live-allowed': 'M13 10V3L4 14h7v7l9-11h-7z',
  };

  const modeLabels = {
    'paper-only': 'PAPER ONLY',
    'paper-default': 'PAPER',
    'live-allowed': 'LIVE TRADING',
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

  const formatPnL = (n: number) => {
    const sign = n >= 0 ? '+' : '';
    return sign + new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
  };

  const formatPercent = (n: number) => {
    const sign = n >= 0 ? '+' : '';
    return sign + n.toFixed(2) + '%';
  };

  return (
    <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-5 shrink-0">
      {/* Left: Logo + Status */}
      <div className="flex items-center gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <span className="font-semibold text-text">OPENTRADEX</span>
        </div>

        {/* Connection Status */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-surface-2">
          <div className={`status-dot ${status.connection === 'connected' ? 'ready' : 'error'}`} />
          <span className="text-sm text-text-dim capitalize">{status.connection === 'connected' ? 'Ready' : status.connection}</span>
        </div>

        {/* Claude Code Badge */}
        <div className="px-3 py-1 rounded-full bg-surface-2 text-sm text-text-dim">
          CLAUDE-CODE
        </div>

        {/* Trading Mode - Enhanced */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold ${modeColors[status.mode]}`}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={modeIcons[status.mode]} />
          </svg>
          {modeLabels[status.mode]}
        </div>

        {/* Active Rails */}
        <div className="flex items-center gap-1">
          {Object.entries(status.rails)
            .filter(([, enabled]) => enabled)
            .slice(0, 2)
            .map(([rail]) => (
              <span key={rail} className="px-2 py-1 rounded bg-surface-2 text-xs text-text-dim uppercase">
                {rail}
              </span>
            ))}
        </div>
      </div>

      {/* Center: Capital & P&L - PROMINENT DISPLAY */}
      <div className="flex items-center gap-8">
        {/* Capital - Large Display */}
        <div className="text-center px-6 py-2 rounded-xl bg-surface-2/50 border border-border">
          <div className="text-xs text-text-dim uppercase tracking-wider mb-1">Portfolio Value</div>
          <div className="text-3xl font-bold text-text tracking-tight">{formatCurrency(status.capital)}</div>
        </div>

        {/* Day P&L - Prominent with Flash Animation */}
        <div className={`text-center px-6 py-2 rounded-xl transition-all duration-300 ${
          status.dayPnL >= 0
            ? 'bg-accent/10 border border-accent/30'
            : 'bg-danger/10 border border-danger/30'
        } ${pnlFlash ? (status.dayPnL >= 0 ? 'ring-2 ring-accent shadow-lg shadow-accent/20' : 'ring-2 ring-danger shadow-lg shadow-danger/20') : ''}`}>
          <div className="text-xs text-text-dim uppercase tracking-wider mb-1">Day P&L</div>
          <div className={`text-2xl font-bold tracking-tight ${status.dayPnL >= 0 ? 'text-accent' : 'text-danger'}`}>
            {formatPnL(status.dayPnL)}
          </div>
          <div className={`text-xs font-medium ${status.dayPnL >= 0 ? 'text-accent/80' : 'text-danger/80'}`}>
            {formatPercent(status.dayPnLPercent || 0)}
          </div>
        </div>

        {/* Stats Row - Compact Cards */}
        <div className="flex items-center gap-3">
          <div className="text-center px-4 py-2 rounded-lg bg-surface-2 hover:bg-card-hover transition-colors cursor-default group" title="Total trades executed today">
            <div className="text-xl font-bold text-text group-hover:text-accent transition-colors">{status.trades}</div>
            <div className="text-2xs text-text-dim uppercase tracking-wide">Trades</div>
          </div>
          <div className="text-center px-4 py-2 rounded-lg bg-surface-2 hover:bg-card-hover transition-colors cursor-default group" title="Win rate percentage">
            <div className={`text-xl font-bold ${status.winRate >= 50 ? 'text-accent' : 'text-warning'} group-hover:scale-105 transition-transform`}>{status.winRate}%</div>
            <div className="text-2xs text-text-dim uppercase tracking-wide">Win Rate</div>
          </div>
          <div className="text-center px-4 py-2 rounded-lg bg-surface-2 hover:bg-card-hover transition-colors cursor-default group" title="Currently open positions">
            <div className="text-xl font-bold text-text group-hover:text-accent transition-colors">{status.openPositions}</div>
            <div className="text-2xs text-text-dim uppercase tracking-wide">Open</div>
          </div>
          <div className="text-center px-4 py-2 rounded-lg bg-surface-2 hover:bg-card-hover transition-colors cursor-default group" title="Scan cycles completed">
            <div className="text-xl font-bold text-text group-hover:text-accent transition-colors">{status.cycles}</div>
            <div className="text-2xs text-text-dim uppercase tracking-wide">Cycles</div>
          </div>
        </div>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-3">
        {/* Thesis Input */}
        <div className="relative">
          <input
            type="text"
            placeholder="Drop a thesis or catalyst..."
            className="w-52 px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-sm focus:border-accent focus:outline-none"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </span>
        </div>

        {/* Interval Selector */}
        <div className="flex items-center bg-surface-2 rounded-lg">
          {['1M', '5M', '10M', '15M', '30M'].map((interval) => (
            <button
              key={interval}
              className={`px-3 py-1.5 text-sm ${
                status.cycleInterval === parseInt(interval)
                  ? 'bg-accent text-bg rounded-lg'
                  : 'text-text-dim hover:text-text'
              }`}
            >
              {interval}
            </button>
          ))}
        </div>

        {/* Run Cycle - Primary Action */}
        <button
          onClick={onRunCycle}
          className="btn btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-semibold shadow-lg shadow-accent/20 hover:shadow-accent/40 hover:scale-105 transition-all"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Run Cycle
        </button>

        {/* Auto Loop Toggle */}
        <button
          onClick={onToggleAutoLoop}
          className={`btn flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all ${
            status.isAutoLoop
              ? 'bg-accent text-bg shadow-lg shadow-accent/30 ring-2 ring-accent/50'
              : 'bg-surface-2 text-text border border-border hover:border-accent hover:bg-card-hover'
          }`}
        >
          <svg className={`w-5 h-5 ${status.isAutoLoop ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ animationDuration: '3s' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {status.isAutoLoop ? 'LOOPING' : 'Auto Loop'}
          {status.isAutoLoop && (
            <span className="ml-1 px-1.5 py-0.5 text-2xs bg-bg/30 rounded">
              {status.cycleInterval}M
            </span>
          )}
        </button>

        {/* Settings */}
        <button className="p-2.5 rounded-lg bg-surface-2 hover:bg-card-hover text-text-dim hover:text-accent border border-transparent hover:border-accent/30 transition-all" title="Settings">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    </header>
  );
}
