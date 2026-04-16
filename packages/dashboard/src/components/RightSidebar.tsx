import type { FeedItem } from '../lib/types';

interface RightSidebarProps {
  feed: FeedItem[];
}

const sourceIcons: Record<string, { icon: string; color: string }> = {
  reuters: { icon: 'R', color: 'bg-orange-500/20 text-orange-400' },
  bloomberg: { icon: 'B', color: 'bg-purple-500/20 text-purple-400' },
  ft: { icon: 'FT', color: 'bg-pink-500/20 text-pink-400' },
  x: { icon: 'X', color: 'bg-blue-500/20 text-blue-400' },
  reddit: { icon: 'r/', color: 'bg-orange-600/20 text-orange-500' },
  truth: { icon: 'T', color: 'bg-red-500/20 text-red-400' },
  tiktok: { icon: 'TT', color: 'bg-pink-600/20 text-pink-500' },
};

const feedTabs = ['News', 'X', 'Truth', 'Reddit', 'TikTok'];

export default function RightSidebar({ feed }: RightSidebarProps) {
  return (
    <aside className="w-80 bg-surface border-l border-border flex flex-col overflow-hidden shrink-0">
      {/* Header */}
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
          <h2 className="text-sm font-semibold uppercase tracking-wide">Feed</h2>
        </div>
        <div className="flex items-center gap-1">
          <div className="status-dot live" />
          <span className="text-xs text-accent">Live</span>
        </div>
      </div>

      {/* Links */}
      <div className="px-4 py-3 border-b border-border space-y-3">
        <div className="p-3 rounded-lg bg-surface-2 hover:bg-card-hover cursor-pointer transition-colors">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-text-dim uppercase">Repository</span>
            <svg className="w-4 h-4 text-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </div>
          <p className="text-sm font-medium">Open the real GitHub repo</p>
          <p className="text-xs text-text-dim">Browse the live OpenTradex source, CLI, dashboard, and deploy history.</p>
        </div>

        <div className="p-3 rounded-lg bg-surface-2 hover:bg-card-hover cursor-pointer transition-colors">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-text-dim uppercase">Community</span>
            <svg className="w-4 h-4 text-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </div>
          <p className="text-sm font-medium">Join the OpenTradex Discord</p>
          <p className="text-xs text-text-dim">Ask questions, share setups, and follow product updates with the operator crew.</p>
        </div>
      </div>

      {/* Feed Tabs */}
      <div className="px-4 py-2 flex items-center gap-1 border-b border-border overflow-x-auto">
        {feedTabs.map((tab, i) => (
          <button
            key={tab}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
              i === 0
                ? 'bg-accent/20 text-accent'
                : 'text-text-dim hover:bg-surface-2'
            }`}
          >
            {tab}
            {i === 0 && <span className="ml-1.5 text-accent">30</span>}
          </button>
        ))}
      </div>

      {/* Feed Items */}
      <div className="flex-1 overflow-y-auto">
        {feed.map((item) => {
          const source = sourceIcons[item.source] || { icon: '?', color: 'bg-gray-500/20 text-gray-400' };
          return (
            <article
              key={item.id}
              className="px-4 py-3 border-b border-border hover:bg-surface-2 cursor-pointer transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${source.color}`}>
                  {source.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-text-dim capitalize">{item.source}</span>
                    <span className="text-xs text-text-dim">·</span>
                    <span className="text-xs text-text-dim">{item.age}</span>
                  </div>
                  <h3 className="text-sm font-medium leading-snug line-clamp-2">{item.title}</h3>
                  {item.summary && (
                    <p className="text-xs text-text-dim mt-1 line-clamp-2">{item.summary}</p>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </aside>
  );
}
