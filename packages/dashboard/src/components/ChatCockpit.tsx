import { useState, useRef, useEffect } from 'react';
import type { HarnessStatus } from '../lib/types';

interface ChatCockpitProps {
  selectedChannel: string;
  onChannelChange: (channel: string) => void;
  onCommand: (command: string) => Promise<string>;
  status: HarnessStatus;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const channels = [
  { id: 'all', name: 'ALL CHANNELS', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10', count: 2 },
  { id: 'command', name: 'COMMAND', icon: 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', count: 0 },
  { id: 'markets', name: 'MARKETS', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', count: 0 },
  { id: 'feeds', name: 'FEEDS', icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z', count: 1 },
];

const missionCards = [
  { id: '1', title: 'CONNECTOR AUDIT', description: 'Audit this OpenTradex workspace. Tell me which rails, feeds, channels, and credentials are configured, what is still missing, and the smartest next step.' },
  { id: '2', title: 'CROSS-MARKET SCAN', description: 'Scan the enabled market rails, compare overlapping themes, and surface the best 3 setups before recommending one paper trade or pass.' },
  { id: '3', title: 'TRADINGVIEW PASS', description: 'Use the TradingView lane and focus on this watchlist: SPY, QQQ, BTCUSD, NQ1!. Tell me which symbols or macro instruments deserve attention.' },
];

export default function ChatCockpit({ selectedChannel, onChannelChange, onCommand, status }: ChatCockpitProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await onCommand(input.trim());
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Failed to process command. Please try again.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMissionClick = (description: string) => {
    setInput(description);
  };

  return (
    <main className="flex-1 flex overflow-hidden">
      {/* Channels Sidebar */}
      <div className="w-64 bg-surface border-r border-border flex flex-col shrink-0">
        <div className="p-4 border-b border-border">
          <h2 className="text-xs font-semibold text-accent uppercase tracking-widest mb-2">
            Messaging Channels
          </h2>
          <p className="text-xs text-text-dim">
            Route prompts by desk so the assistant knows whether you want markets, feeds, risk, execution, or TradingView context.
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {channels.map((channel) => (
            <button
              key={channel.id}
              onClick={() => onChannelChange(channel.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors ${
                selectedChannel === channel.id
                  ? 'bg-surface-2 border border-border'
                  : 'hover:bg-surface-2'
              }`}
            >
              <svg className="w-4 h-4 text-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={channel.icon} />
              </svg>
              <span className="text-sm flex-1 text-left">{channel.name}</span>
              <span className="text-xs text-text-dim bg-surface-2 px-1.5 py-0.5 rounded">
                {channel.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-bg overflow-hidden">
        {/* Chat Header */}
        <div className="h-12 px-4 flex items-center border-b border-border bg-surface">
          <span className="text-xs font-semibold text-danger uppercase tracking-widest">
            Chat Cockpit
          </span>
          <span className="mx-3 text-text-dim">/</span>
          <span className="text-sm text-text-dim">Direct the harness and launch missions.</span>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center">
              {/* Status Badge */}
              <div className="mb-6 px-4 py-2 rounded-lg bg-accent/10 border border-accent/30 text-accent text-sm">
                TRADINGVIEW MCP READY
              </div>

              {/* Mission Cards */}
              <div className="grid grid-cols-3 gap-4 max-w-3xl">
                {missionCards.map((card) => (
                  <button
                    key={card.id}
                    onClick={() => handleMissionClick(card.description)}
                    className="p-4 rounded-lg bg-surface border border-border hover:border-accent hover:bg-surface-2 transition-all text-left group"
                  >
                    <h3 className="text-xs font-semibold text-text-dim uppercase tracking-wide mb-2 group-hover:text-accent">
                      {card.title}
                    </h3>
                    <p className="text-xs text-text-dim line-clamp-4">
                      {card.description}
                    </p>
                  </button>
                ))}
              </div>

              {/* Quick Actions */}
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => handleMissionClick('Audit the workspace and tell me what is missing.')}
                  className="px-4 py-2 rounded-lg bg-surface-2 border border-border text-sm hover:bg-card-hover hover:border-accent transition-colors"
                >
                  Audit the workspace and tell me what is missing.
                </button>
                <button
                  onClick={() => handleMissionClick('Warm boot the harness and propose the best paper trade.')}
                  className="px-4 py-2 rounded-lg bg-surface-2 border border-border text-sm hover:bg-card-hover hover:border-accent transition-colors"
                >
                  Warm boot the harness and propose the best paper trade.
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-2xl px-4 py-3 rounded-lg ${
                      msg.role === 'user'
                        ? 'bg-accent text-bg'
                        : 'bg-surface border border-border'
                    }`}
                  >
                    <pre className="whitespace-pre-wrap font-sans text-sm">{msg.content}</pre>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-surface border border-border px-4 py-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
                      <div className="w-2 h-2 bg-accent rounded-full animate-pulse delay-100" />
                      <div className="w-2 h-2 bg-accent rounded-full animate-pulse delay-200" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-border bg-surface">
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded bg-accent/20 text-accent text-xs font-medium">
              COMMAND
            </div>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the harness what to scan, compare, explain, or trade"
              className="flex-1 px-4 py-2.5 rounded-lg bg-input-bg border border-border text-sm focus:border-accent focus:outline-none"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="p-2.5 rounded-lg bg-accent text-bg hover:bg-accent-dim disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
