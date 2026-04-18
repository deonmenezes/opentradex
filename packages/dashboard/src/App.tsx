import { useState, useCallback, useEffect } from 'react';
import TopBar from './components/TopBar';
import LeftSidebar from './components/LeftSidebar';
import ChatCockpit from './components/ChatCockpit';
import RightSidebar from './components/RightSidebar';
import SetupWizard from './components/SetupWizard';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from './components/Resizable';
import TradesPage from './pages/TradesPage';
import MarketsPage from './pages/MarketsPage';
import PaymentsPage from './pages/PaymentsPage';
import { useHarness } from './hooks/useHarness';
import type { Position, Market, FeedItem, Connector } from './lib/types';

type View = 'cockpit' | 'trades' | 'markets' | 'payments';

export default function App() {
  const { status, positions, trades, markets, feed, wsMeta, sendCommand, runCycle, toggleAutoLoop, setLoopInterval, reconnect } = useHarness();
  const [selectedChannel, setSelectedChannel] = useState<string>('command');
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [view, setView] = useState<View>(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash.replace('#', '') : '';
    return hash === 'trades' || hash === 'markets' || hash === 'payments' ? (hash as View) : 'cockpit';
  });

  // On first load: if the user has never dismissed setup AND no AI provider is configured,
  // auto-open the wizard. Respect a localStorage sentinel so we don't nag on every reload.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem('opentradex.setup.dismissed') === '1') return;
    let cancelled = false;
    fetch('/api/ai/providers')
      .then((r) => r.json())
      .then((data: { providers?: Array<{ configured: boolean }> }) => {
        if (cancelled) return;
        const anyConfigured = (data.providers ?? []).some((p) => p.configured);
        if (!anyConfigured) setSetupOpen(true);
      })
      .catch(() => { /* backend unreachable — leave setup closed */ });
    return () => { cancelled = true; };
  }, []);

  const handleOpenSetup = useCallback(() => setSetupOpen(true), []);
  const handleCloseSetup = useCallback(() => {
    setSetupOpen(false);
    try { localStorage.setItem('opentradex.setup.dismissed', '1'); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash.replace('#', '');
      if (h === 'trades' || h === 'markets' || h === 'payments' || h === 'cockpit' || h === '') {
        setView((h as View) || 'cockpit');
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const toggleLeftSidebar = useCallback(() => {
    setLeftSidebarOpen(prev => !prev);
    setRightSidebarOpen(false);
  }, []);

  const toggleRightSidebar = useCallback(() => {
    setRightSidebarOpen(prev => !prev);
    setLeftSidebarOpen(false);
  }, []);

  // Position action handler
  const handlePositionAction = useCallback(async (action: 'add' | 'reduce' | 'close', position: Position) => {
    const commands: Record<string, string> = {
      add: `add to position ${position.symbol} on ${position.exchange}`,
      reduce: `reduce position ${position.symbol} on ${position.exchange} by 50%`,
      close: `close position ${position.symbol} on ${position.exchange}`,
    };
    await sendCommand(commands[action]);
  }, [sendCommand]);

  // Market selection handler
  const handleMarketSelect = useCallback(async (market: Market) => {
    await sendCommand(`analyze ${market.symbol} on ${market.exchange}`);
  }, [sendCommand]);

  // Connector action handler
  const handleConnectorAction = useCallback(async (c: Connector) => {
    if (c.status === 'connected') {
      await sendCommand(`status for ${c.name} connector`);
    } else {
      await sendCommand(`connect to ${c.name}`);
    }
  }, [sendCommand]);

  // Feed action handler
  const handleFeedAction = useCallback(async (action: 'open' | 'save' | 'analyze', item: FeedItem) => {
    if (action === 'analyze') {
      await sendCommand(`analyze news: "${item.title}" from ${item.source}`);
    } else if (action === 'save') {
      console.log('Saved feed item:', item.title);
      // In production, this would save to a watchlist or bookmarks
    }
    // 'open' is handled in the component itself by opening the URL
  }, [sendCommand]);

  return (
    <div className="h-screen w-screen flex flex-col bg-bg overflow-hidden">
      {/* Top Bar */}
      <TopBar
        status={status}
        wsMeta={wsMeta}
        onRunCycle={runCycle}
        onToggleAutoLoop={toggleAutoLoop}
        onSetLoopInterval={setLoopInterval}
        onToggleLeftSidebar={toggleLeftSidebar}
        onToggleRightSidebar={toggleRightSidebar}
        onShowTrades={() => setView('trades')}
        onShowMarkets={() => setView('markets')}
        onShowPayments={() => setView('payments')}
        onOpenSetup={handleOpenSetup}
      />

      {status.connection === 'disconnected' && (
        <div
          data-testid="disconnect-toast"
          className="flex items-center gap-3 px-4 py-2.5 bg-danger/15 border-b border-danger/40 text-danger text-sm"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="flex-1">
            Lost connection to harness gateway. {wsMeta.attempts > 0 ? `Reconnect attempts: ${wsMeta.attempts}.` : ''}
          </span>
          <button
            onClick={reconnect}
            data-testid="disconnect-retry"
            className="px-3 py-1 rounded-md bg-danger text-bg font-semibold text-xs hover:bg-danger/80 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Step-by-step mode + API key setup. Auto-opens on first boot, also reachable
          from the mode badge in the TopBar. */}
      <SetupWizard
        open={setupOpen}
        initialMode={status.mode}
        onClose={handleCloseSetup}
      />

      {view === 'trades' && (
        <TradesPage trades={trades} onBack={() => setView('cockpit')} />
      )}

      {view === 'payments' && (
        <PaymentsPage onBack={() => setView('cockpit')} />
      )}

      {view === 'markets' && (
        <MarketsPage
          markets={markets}
          onBack={() => setView('cockpit')}
          onSelectMarket={(m) => { handleMarketSelect(m); setView('cockpit'); }}
          onConnectorAction={handleConnectorAction}
        />
      )}

      {/* Main Content */}
      {view === 'cockpit' && (
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Overlay */}
        {(leftSidebarOpen || rightSidebarOpen) && (
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-20"
            onClick={() => { setLeftSidebarOpen(false); setRightSidebarOpen(false); }}
          />
        )}

        {/* Mobile: drawer layout */}
        <div className="flex-1 flex overflow-hidden lg:hidden">
          <div className={`
            ${leftSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            fixed left-0 top-0 h-full z-30
            transition-transform duration-300 ease-in-out
          `}>
            <LeftSidebar
              positions={positions}
              trades={trades}
              markets={markets}
              onClose={() => setLeftSidebarOpen(false)}
              onPositionAction={handlePositionAction}
              onMarketSelect={handleMarketSelect}
            />
          </div>
          <ChatCockpit
            selectedChannel={selectedChannel}
            onChannelChange={setSelectedChannel}
            onCommand={sendCommand}
            status={status}
          />
          <div className={`
            ${rightSidebarOpen ? 'translate-x-0' : 'translate-x-full'}
            fixed right-0 top-0 h-full z-30
            transition-transform duration-300 ease-in-out
          `}>
            <RightSidebar
              feed={feed}
              onClose={() => setRightSidebarOpen(false)}
              onFeedAction={handleFeedAction}
            />
          </div>
        </div>

        {/* Desktop: resizable 3-pane layout */}
        <ResizablePanelGroup orientation="horizontal" className="hidden lg:flex flex-1">
          <ResizablePanel defaultSize="22%" minSize="15%" maxSize="40%">
            <LeftSidebar
              positions={positions}
              trades={trades}
              markets={markets}
              onPositionAction={handlePositionAction}
              onMarketSelect={handleMarketSelect}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize="56%" minSize="30%">
            <ChatCockpit
              selectedChannel={selectedChannel}
              onChannelChange={setSelectedChannel}
              onCommand={sendCommand}
              status={status}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize="22%" minSize="15%" maxSize="40%">
            <RightSidebar
              feed={feed}
              onFeedAction={handleFeedAction}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      )}
    </div>
  );
}
