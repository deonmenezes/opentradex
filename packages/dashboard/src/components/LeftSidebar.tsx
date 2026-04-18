import { useState, memo, useMemo } from 'react';
import type { Position, Trade, Market } from '../lib/types';

interface LeftSidebarProps {
  positions: Position[];
  trades: Trade[];
  markets: Market[];
  onClose?: () => void;
  onPositionAction?: (action: 'add' | 'reduce' | 'close', position: Position) => void;
  onMarketSelect?: (market: Market) => void;
}

// Exchange icons/colors
const exchangeStyles: Record<string, { bg: string; text: string }> = {
  kalshi: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  polymarket: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  alpaca: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  crypto: { bg: 'bg-orange-500/20', text: 'text-orange-400' },
  tradingview: { bg: 'bg-green-500/20', text: 'text-green-400' },
};

export default memo(function LeftSidebar({ positions, trades, markets, onClose, onPositionAction, onMarketSelect }: LeftSidebarProps) {
  const [positionSort, setPositionSort] = useState<'pnl' | 'size'>('pnl');

  // Memoized sorted positions
  const sortedPositions = useMemo(() => {
    return [...positions].sort((a, b) => {
      if (positionSort === 'pnl') return Math.abs(b.pnl) - Math.abs(a.pnl);
      return b.size - a.size;
    });
  }, [positions, positionSort]);

  // Memoized totals
  const { totalPnL } = useMemo(() => ({
    totalPnL: positions.reduce((sum, p) => sum + p.pnl, 0),
  }), [positions]);

  return (
    <aside className="w-80 lg:w-full h-full bg-surface border-r border-border flex flex-col overflow-hidden shrink-0">
      {/* Mobile Header with Close */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-surface-2">
        <h2 className="font-semibold text-text">Trading</h2>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-card-hover text-text-dim hover:text-text transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Positions - Houston-style */}
      <section className="border-b border-border">
        <div className="hs-section-header">
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h2 className="hs-section-label">Positions</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${totalPnL >= 0 ? 'bg-accent/20 text-accent' : 'bg-danger/20 text-danger'}`}>
              {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
            </span>
            <span className="text-xs text-text-dim bg-surface-2 px-2 py-0.5 rounded">{positions.length}</span>
          </div>
        </div>
        {/* Sort Controls */}
        <div className="px-4 py-2 flex items-center gap-2 border-b border-border bg-surface-2/50">
          <span className="text-2xs text-text-dim">Sort:</span>
          <button
            onClick={() => setPositionSort('pnl')}
            className={`text-2xs px-2 py-0.5 rounded ${positionSort === 'pnl' ? 'bg-accent/20 text-accent' : 'text-text-dim hover:text-text'}`}
          >
            P&L
          </button>
          <button
            onClick={() => setPositionSort('size')}
            className={`text-2xs px-2 py-0.5 rounded ${positionSort === 'size' ? 'bg-accent/20 text-accent' : 'text-text-dim hover:text-text'}`}
          >
            Size
          </button>
        </div>
        <div className="max-h-56 overflow-y-auto">
          {sortedPositions.map((pos) => {
            const style = exchangeStyles[pos.exchange] || { bg: 'bg-gray-500/20', text: 'text-gray-400' };
            const priceChange = pos.currentPrice - pos.avgPrice;
            const priceDirection = priceChange >= 0 ? 'up' : 'down';

            return (
              <div
                key={pos.id}
                className="hs-row group"
              >
                {/* Header Row */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-2xs px-1.5 py-0.5 rounded font-medium ${style.bg} ${style.text}`}>
                      {pos.exchange.slice(0, 3).toUpperCase()}
                    </span>
                    <span className="font-semibold text-sm text-text">{pos.symbol}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); window.open(`https://www.google.com/search?q=${encodeURIComponent(pos.symbol + ' ' + pos.exchange)}`, '_blank'); }}
                      className="text-text-dim hover:text-accent opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Search market info"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </button>
                  </div>
                  <span className={`badge text-xs font-bold ${pos.side === 'yes' || pos.side === 'long' ? 'badge-yes' : 'badge-no'}`}>
                    {pos.side.toUpperCase()}
                  </span>
                </div>

                {/* Title */}
                <div className="text-xs text-text-dim mb-2 line-clamp-1">{pos.title}</div>

                {/* Price Row with Animation */}
                <div className="flex items-center justify-between text-xs mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-text-dim">{pos.size}x</span>
                    <span className="text-text-dim">@</span>
                    <span className="text-text font-medium">${pos.avgPrice.toFixed(2)}</span>
                    <svg className={`w-3 h-3 ${priceDirection === 'up' ? 'text-accent' : 'text-danger'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={priceDirection === 'up' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
                    </svg>
                    <span className={`font-semibold ${priceDirection === 'up' ? 'text-accent' : 'text-danger'}`}>
                      ${pos.currentPrice.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* P&L Row - Prominent */}
                <div className="flex items-center justify-between">
                  <div className={`text-sm font-bold ${pos.pnl >= 0 ? 'text-accent' : 'text-danger'}`}>
                    {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)}
                    <span className="text-xs font-normal ml-1">
                      ({pos.pnlPercent >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`text-2xs px-1.5 py-0.5 rounded ${
                      pos.confidence === 'High' ? 'bg-accent/20 text-accent' :
                      pos.confidence === 'Medium' ? 'bg-warning/20 text-warning' :
                      'bg-danger/20 text-danger'
                    }`}>
                      {pos.confidence}
                    </span>
                  </div>
                </div>

                {/* Quick Actions - Show on Hover */}
                <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); onPositionAction?.('add', pos); }}
                    className="text-2xs px-2 py-1 rounded bg-accent/20 text-accent hover:bg-accent/30 transition-colors"
                  >
                    Add
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onPositionAction?.('reduce', pos); }}
                    className="text-2xs px-2 py-1 rounded bg-warning/20 text-warning hover:bg-warning/30 transition-colors"
                  >
                    Reduce
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onPositionAction?.('close', pos); }}
                    className="text-2xs px-2 py-1 rounded bg-danger/20 text-danger hover:bg-danger/30 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            );
          })}
          {positions.length === 0 && (
            <div
              data-testid="empty-positions"
              className="px-4 py-8 flex flex-col items-center gap-2 text-center"
            >
              <svg className="w-8 h-8 text-text-dim/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <div className="text-sm font-medium text-text">No open positions</div>
              <div className="text-2xs text-text-dim max-w-[12rem] leading-relaxed">
                Try <code className="px-1 py-0.5 bg-surface-2 rounded text-accent">scan markets</code> in the chat to find an opportunity.
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Recent Trades - Houston-style */}
      <section className="border-b border-border">
        <div className="hs-section-header">
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <h2 className="hs-section-label">Recent trades</h2>
          </div>
          <span className="text-xs text-text-dim">Last {trades.length}</span>
        </div>
        <div className="max-h-40 overflow-y-auto">
          {trades.map((trade) => {
            // Exchange style available: exchangeStyles[trade.exchange]
            return (
              <div
                key={trade.id}
                className="hs-row flex items-center justify-between group"
              >
                <div className="flex items-center gap-2">
                  {/* Status Icon */}
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    trade.status === 'open' ? 'bg-warning/20' :
                    (trade.pnl && trade.pnl >= 0 ? 'bg-accent/20' : 'bg-danger/20')
                  }`}>
                    {trade.status === 'open' ? (
                      <div className="w-2 h-2 rounded-full bg-warning animate-pulse" />
                    ) : trade.pnl && trade.pnl >= 0 ? (
                      <svg className="w-3 h-3 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-3 h-3 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-sm text-text">{trade.symbol}</span>
                      <span className={`text-2xs px-1 py-0.5 rounded font-medium ${
                        trade.side === 'yes' || trade.side === 'long'
                          ? 'bg-accent/20 text-accent'
                          : 'bg-danger/20 text-danger'
                      }`}>
                        {trade.side.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-2xs text-text-dim">
                      {trade.size}x @ ${trade.price.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  {trade.pnl !== undefined ? (
                    <div className={`text-sm font-semibold ${trade.pnl >= 0 ? 'text-accent' : 'text-danger'}`}>
                      {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                    </div>
                  ) : (
                    <div className="text-sm text-warning font-medium">Open</div>
                  )}
                  <div className="text-2xs text-text-dim">{trade.age}</div>
                </div>
              </div>
            );
          })}
          {trades.length === 0 && (
            <div className="px-4 py-6 text-center text-text-dim text-sm">
              No recent trades
            </div>
          )}
        </div>
      </section>

      {/* Markets - Houston-style */}
      <section className="flex-1 flex flex-col overflow-hidden">
        <div className="hs-section-header">
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h2 className="hs-section-label">Market scanner</h2>
          </div>
          <span className="text-xs text-text-dim bg-surface-2 px-2 py-0.5 rounded-md">{markets.length}</span>
        </div>
        <div className="overflow-y-auto flex-1">
          {/* Table Header */}
          <div className="px-4 py-2 grid grid-cols-4 gap-2 text-2xs text-text-dim uppercase border-b border-border sticky top-0 bg-surface font-medium tracking-wider">
            <span>Market</span>
            <span className="text-right">Bid/Ask</span>
            <span className="text-right">Price</span>
            <span className="text-right">Volume</span>
          </div>
          {/* Table Rows */}
          {markets.map((market) => {
            const style = exchangeStyles[market.exchange] || { bg: 'bg-gray-500/20', text: 'text-gray-400' };
            return (
              <div
                key={market.id}
                onClick={() => onMarketSelect?.(market)}
                className="hs-row grid grid-cols-4 gap-2 text-xs group"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-2xs px-1 py-0.5 rounded font-medium ${style.bg} ${style.text}`}>
                      {market.exchange.slice(0, 3).toUpperCase()}
                    </span>
                    <span className="font-semibold text-sm text-text truncate">{market.symbol}</span>
                  </div>
                  <div className="text-text-dim line-clamp-1 text-2xs">{market.title}</div>
                </div>
                <span className="text-right self-center text-text-dim font-mono">{market.bidAsk}</span>
                <span className="text-right self-center font-semibold text-text">{typeof market.mid === 'number' ? (market.mid > 100 ? `$${market.mid.toLocaleString()}` : market.mid + '¢') : market.mid}</span>
                <span className="text-right self-center text-text-dim text-2xs">{market.volume}</span>
              </div>
            );
          })}
          {markets.length === 0 && (
            <div
              data-testid="empty-scanner"
              className="px-4 py-8 flex flex-col items-center gap-2 text-center"
            >
              <svg className="w-8 h-8 text-text-dim/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <div className="text-sm font-medium text-text">Scanner idle</div>
              <div className="text-2xs text-text-dim max-w-[13rem] leading-relaxed">
                Hit the <span className="text-accent">⚡ Cross-Market Scan</span> mission to discover live opportunities.
              </div>
            </div>
          )}
        </div>
      </section>
    </aside>
  );
});
