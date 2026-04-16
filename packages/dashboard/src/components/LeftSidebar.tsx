import type { Position, Trade, Market } from '../lib/types';

interface LeftSidebarProps {
  positions: Position[];
  trades: Trade[];
  markets: Market[];
}

export default function LeftSidebar({ positions, trades, markets }: LeftSidebarProps) {
  return (
    <aside className="w-72 bg-surface border-r border-border flex flex-col overflow-hidden shrink-0">
      {/* Positions */}
      <section className="border-b border-border">
        <div className="panel-header">
          <h2 className="text-sm font-semibold text-text-dim uppercase tracking-wide">
            Positions
          </h2>
          <span className="text-xs text-text-dim">{positions.length}</span>
        </div>
        <div className="max-h-48 overflow-y-auto">
          {positions.map((pos) => (
            <div
              key={pos.id}
              className="px-4 py-3 border-b border-border last:border-b-0 hover:bg-surface-2 cursor-pointer"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{pos.symbol}</span>
                  <a href="#" className="text-text-dim hover:text-accent">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
                <span className={`badge ${pos.side === 'yes' || pos.side === 'long' ? 'badge-yes' : 'badge-no'}`}>
                  {pos.side.toUpperCase()}
                </span>
              </div>
              <div className="text-xs text-text-dim mb-2 line-clamp-1">{pos.title}</div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-dim">
                  {pos.size}x @ ${pos.avgPrice.toFixed(2)}
                </span>
                <div className="flex items-center gap-2">
                  <span className={pos.pnl >= 0 ? 'text-accent' : 'text-danger'}>
                    {pos.pnlPercent >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(1)}pp
                  </span>
                  <span className="text-text-dim">{pos.confidence}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Recent Trades */}
      <section className="border-b border-border">
        <div className="panel-header">
          <h2 className="text-sm font-semibold text-text-dim uppercase tracking-wide">
            Recent Trades
          </h2>
        </div>
        <div className="max-h-32 overflow-y-auto">
          {trades.map((trade) => (
            <div
              key={trade.id}
              className="px-4 py-2 flex items-center justify-between border-b border-border last:border-b-0 hover:bg-surface-2"
            >
              <div className="flex items-center gap-2">
                <span className={trade.status === 'open' ? 'text-text-dim' : (trade.pnl && trade.pnl >= 0 ? 'text-accent' : 'text-danger')}>
                  {trade.status === 'open' ? '−' : (trade.pnl && trade.pnl >= 0 ? '+' : '−')}
                </span>
                <span className="text-sm">{trade.symbol}</span>
                <span className={`text-xs ${trade.side === 'yes' || trade.side === 'long' ? 'text-accent' : 'text-danger'}`}>
                  {trade.side.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                {trade.pnl !== undefined && (
                  <span className={trade.pnl >= 0 ? 'text-accent' : 'text-danger'}>
                    {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                  </span>
                )}
                <span className="text-text-dim">{trade.age}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Markets */}
      <section className="flex-1 flex flex-col overflow-hidden">
        <div className="panel-header">
          <h2 className="text-sm font-semibold text-text-dim uppercase tracking-wide">
            Markets
          </h2>
        </div>
        <div className="overflow-y-auto flex-1">
          {/* Table Header */}
          <div className="px-4 py-2 grid grid-cols-4 text-xs text-text-dim uppercase border-b border-border sticky top-0 bg-surface">
            <span>Ticker</span>
            <span className="text-right">Bid/Ask</span>
            <span className="text-right">Mid</span>
            <span className="text-right">Vol</span>
          </div>
          {/* Table Rows */}
          {markets.map((market) => (
            <div
              key={market.id}
              className="px-4 py-2 grid grid-cols-4 text-xs border-b border-border hover:bg-surface-2 cursor-pointer"
            >
              <div>
                <div className="font-medium text-sm">{market.symbol}</div>
                <div className="text-text-dim line-clamp-1 text-2xs">{market.title}</div>
              </div>
              <span className="text-right self-center">{market.bidAsk}</span>
              <span className="text-right self-center font-medium">{market.mid}</span>
              <span className="text-right self-center text-text-dim">{market.volume}</span>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}
