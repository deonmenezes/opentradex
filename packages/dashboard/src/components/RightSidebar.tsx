import { useState, useMemo } from 'react';
import type { FeedItem } from '../lib/types';

interface RightSidebarProps {
  feed: FeedItem[];
}

const sourceIcons: Record<string, { icon: string; color: string; fullName: string }> = {
  reuters: { icon: 'R', color: 'bg-orange-500/20 text-orange-400', fullName: 'Reuters' },
  bloomberg: { icon: 'B', color: 'bg-purple-500/20 text-purple-400', fullName: 'Bloomberg' },
  ft: { icon: 'FT', color: 'bg-pink-500/20 text-pink-400', fullName: 'Financial Times' },
  x: { icon: '𝕏', color: 'bg-blue-500/20 text-blue-400', fullName: 'X (Twitter)' },
  reddit: { icon: 'r/', color: 'bg-orange-600/20 text-orange-500', fullName: 'Reddit' },
  truth: { icon: 'T', color: 'bg-red-500/20 text-red-400', fullName: 'Truth Social' },
  tiktok: { icon: 'TT', color: 'bg-pink-600/20 text-pink-500', fullName: 'TikTok' },
};

const feedTabs = [
  { id: 'all', label: 'All', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
  { id: 'news', label: 'News', icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z' },
  { id: 'social', label: 'Social', icon: 'M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z' },
];

export default function RightSidebar({ feed }: RightSidebarProps) {
  const [activeTab, setActiveTab] = useState('all');
  const [readItems, setReadItems] = useState<Set<string>>(new Set());

  // Filter feed based on active tab
  const filteredFeed = useMemo(() => {
    if (activeTab === 'all') return feed;
    if (activeTab === 'news') return feed.filter(item => ['reuters', 'bloomberg', 'ft'].includes(item.source));
    if (activeTab === 'social') return feed.filter(item => ['x', 'reddit', 'truth', 'tiktok'].includes(item.source));
    return feed;
  }, [feed, activeTab]);

  const unreadCount = feed.length - readItems.size;

  const markAsRead = (id: string) => {
    setReadItems(prev => new Set([...prev, id]));
  };

  return (
    <aside className="w-80 bg-surface border-l border-border flex flex-col overflow-hidden shrink-0">
      {/* Header - Enhanced */}
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
          <h2 className="text-sm font-semibold text-text uppercase tracking-wide">Live Feed</h2>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent/20 text-accent animate-pulse">
              {unreadCount} new
            </span>
          )}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-accent/10 border border-accent/30">
            <div className="status-dot live" />
            <span className="text-xs text-accent font-medium">Live</span>
          </div>
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

      {/* Feed Tabs - Functional */}
      <div className="px-3 py-2 flex items-center gap-1 border-b border-border">
        {feedTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-accent/20 text-accent border border-accent/30'
                : 'text-text-dim hover:bg-surface-2 hover:text-text border border-transparent'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
            </svg>
            {tab.label}
            {activeTab === tab.id && (
              <span className="ml-1 text-2xs bg-accent/30 px-1.5 py-0.5 rounded-full">
                {filteredFeed.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Feed Items - Enhanced */}
      <div className="flex-1 overflow-y-auto">
        {filteredFeed.map((item) => {
          const source = sourceIcons[item.source] || { icon: '?', color: 'bg-gray-500/20 text-gray-400', fullName: item.source };
          const isRead = readItems.has(item.id);

          return (
            <article
              key={item.id}
              onClick={() => markAsRead(item.id)}
              className={`px-4 py-3 border-b border-border cursor-pointer transition-all group ${
                isRead ? 'bg-transparent hover:bg-surface-2' : 'bg-surface-2/30 hover:bg-surface-2'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Source Icon */}
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${source.color} group-hover:scale-105 transition-transform`}>
                  {source.icon}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Meta Row */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium ${source.color.split(' ')[1]}`}>{source.fullName}</span>
                    <span className="text-text-dim">·</span>
                    <span className="text-xs text-text-dim">{item.age}</span>
                    {!isRead && (
                      <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                    )}
                  </div>

                  {/* Title */}
                  <h3 className={`text-sm font-medium leading-snug line-clamp-2 ${isRead ? 'text-text-dim' : 'text-text'}`}>
                    {item.title}
                  </h3>

                  {/* Summary */}
                  {item.summary && (
                    <p className="text-xs text-text-dim mt-1.5 line-clamp-2 leading-relaxed">
                      {item.summary}
                    </p>
                  )}

                  {/* Actions on Hover */}
                  <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="text-2xs px-2 py-1 rounded bg-surface-2 text-text-dim hover:text-accent hover:bg-accent/20 transition-colors">
                      Open
                    </button>
                    <button className="text-2xs px-2 py-1 rounded bg-surface-2 text-text-dim hover:text-accent hover:bg-accent/20 transition-colors">
                      Save
                    </button>
                    <button className="text-2xs px-2 py-1 rounded bg-surface-2 text-text-dim hover:text-accent hover:bg-accent/20 transition-colors">
                      Analyze
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}

        {filteredFeed.length === 0 && (
          <div className="px-4 py-12 text-center">
            <svg className="w-12 h-12 mx-auto text-text-dim/30 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
            <p className="text-sm text-text-dim">No items in this feed</p>
          </div>
        )}
      </div>
    </aside>
  );
}
