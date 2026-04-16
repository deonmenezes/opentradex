import type { HarnessStatus } from '../lib/types';

interface TopBarProps {
  status: HarnessStatus;
}

export default function TopBar({ status }: TopBarProps) {
  const modeColors = {
    'paper-only': 'bg-accent/20 text-accent',
    'paper-default': 'bg-warning/20 text-warning',
    'live-allowed': 'bg-danger/20 text-danger',
  };

  const modeLabels = {
    'paper-only': 'PAPER ONLY',
    'paper-default': 'PAPER',
    'live-allowed': 'LIVE',
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  const formatPnL = (n: number) => {
    const sign = n >= 0 ? '+' : '';
    return sign + formatCurrency(n);
  };

  return (
    <header className="h-14 bg-surface border-b border-border flex items-center justify-between px-4 shrink-0">
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

        {/* Trading Mode */}
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${modeColors[status.mode]}`}>
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

      {/* Center: Stats */}
      <div className="flex items-center gap-6">
        {/* Capital */}
        <div className="text-center">
          <div className="text-2xl font-bold text-text">{formatCurrency(status.capital)}</div>
          <div className={`text-sm ${status.dayPnL >= 0 ? 'text-accent' : 'text-danger'}`}>
            {formatPnL(status.dayPnL)}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-lg font-semibold">{status.trades}</div>
            <div className="text-xs text-text-dim">TRADES</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold">{status.winRate}%</div>
            <div className="text-xs text-text-dim">WIN RATE</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold">{status.openPositions}</div>
            <div className="text-xs text-text-dim">OPEN</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold">{status.cycles}</div>
            <div className="text-xs text-text-dim">CYCLES</div>
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

        {/* Run Cycle */}
        <button className="btn btn-primary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Run cycle
        </button>

        {/* Auto Loop */}
        <button
          className={`btn ${status.isAutoLoop ? 'btn-primary' : 'btn-secondary'} flex items-center gap-2`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Auto loop
        </button>

        {/* Refresh */}
        <button className="p-2 rounded-lg bg-surface-2 hover:bg-card-hover text-text-dim hover:text-text">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
    </header>
  );
}
