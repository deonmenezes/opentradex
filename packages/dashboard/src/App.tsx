import { useState, useCallback, useEffect } from 'react';
import TopBar from './components/TopBar';
import LeftSidebar from './components/LeftSidebar';
import ChatCockpit from './components/ChatCockpit';
import RightSidebar from './components/RightSidebar';
import SetupWizard from './components/SetupWizard';
import CommandPalette from './components/CommandPalette';
import ConfirmModal from './components/ConfirmModal';
import AgentConsole from './components/AgentConsole';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from './components/Resizable';
import TradesPage from './pages/TradesPage';
import MarketsPage from './pages/MarketsPage';
import PaymentsPage from './pages/PaymentsPage';
import SkillsPage from './pages/SkillsPage';
import { useHarness } from './hooks/useHarness';
import { useSkills } from './hooks/useSkills';
import { useAgentContext } from './hooks/useAgentContext';
import { renderCommand } from './lib/skills';
import type { Skill } from './lib/skills';
import type { Position, Market, FeedItem, Connector } from './lib/types';

type View = 'cockpit' | 'trades' | 'markets' | 'payments' | 'skills';

export default function App() {
  const { status, positions, trades, markets, feed, wsMeta, sendCommand, runCycle, toggleAutoLoop, setLoopInterval, reconnect } = useHarness();
  const { skills, runs, invoke, recentSkillIds } = useSkills();
  const { context: agentContext } = useAgentContext();

  // Active run count = runs started in the last 5s and still running (status === 'ok' with very recent startedAt).
  // Since the harness runs skills synchronously and writes the entry after completion,
  // "active" here means "recently fired" — useful enough for the header badge.
  const activeRunCount = runs.filter((r) => Date.now() - r.startedAt < 5000).length;
  const [selectedChannel, setSelectedChannel] = useState<string>('command');
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Destructive-skill confirmation state (US-008)
  const [confirmState, setConfirmState] = useState<{
    skill: Skill;
    args: Record<string, string | number>;
    command: string;
  } | null>(null);

  const [view, setView] = useState<View>(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash.replace('#', '') : '';
    return hash === 'trades' || hash === 'markets' || hash === 'payments' || hash === 'skills'
      ? (hash as View)
      : 'cockpit';
  });

  // On first load: if no AI provider configured and setup never dismissed, auto-open wizard.
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
      if (h === 'trades' || h === 'markets' || h === 'payments' || h === 'skills' || h === 'cockpit' || h === '') {
        setView((h as View) || 'cockpit');
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Global keyboard shortcuts (US-013): ⌘K / Ctrl+K opens palette, ⌘/ jumps to Skills,
  // Shift+? opens help (future). Respect input focus so shortcuts don't fire mid-typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      // ⌘K / Ctrl+K — always captured, even in inputs
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (inInput) return;

      // g s → Skills page (Vim-style, plus just "s")
      if (e.key === 's' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setView('skills');
        window.location.hash = 'skills';
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleLeftSidebar = useCallback(() => {
    setLeftSidebarOpen(prev => !prev);
    setRightSidebarOpen(false);
  }, []);

  const toggleRightSidebar = useCallback(() => {
    setRightSidebarOpen(prev => !prev);
    setLeftSidebarOpen(false);
  }, []);

  const handlePositionAction = useCallback(async (action: 'add' | 'reduce' | 'close', position: Position) => {
    const commands: Record<string, string> = {
      add: `add to position ${position.symbol} on ${position.exchange}`,
      reduce: `reduce position ${position.symbol} on ${position.exchange} by 50%`,
      close: `close position ${position.symbol} on ${position.exchange}`,
    };
    await sendCommand(commands[action]);
  }, [sendCommand]);

  const handleMarketSelect = useCallback(async (market: Market) => {
    await sendCommand(`analyze ${market.symbol} on ${market.exchange}`);
  }, [sendCommand]);

  const handleConnectorAction = useCallback(async (c: Connector) => {
    if (c.status === 'connected') {
      await sendCommand(`status for ${c.name} connector`);
    } else {
      await sendCommand(`connect to ${c.name}`);
    }
  }, [sendCommand]);

  const handleFeedAction = useCallback(async (action: 'open' | 'save' | 'analyze', item: FeedItem) => {
    if (action === 'analyze') {
      await sendCommand(`analyze news: "${item.title}" from ${item.source}`);
    } else if (action === 'save') {
      console.log('Saved feed item:', item.title);
    }
  }, [sendCommand]);

  // Skill invocation pipeline. Destructive → confirm modal, otherwise straight invoke.
  const handleInvoke = useCallback(
    (skill: Skill, args: Record<string, string | number>) => invoke(skill, args, false),
    [invoke]
  );

  const handleRequestConfirm = useCallback((skill: Skill, args: Record<string, string | number>) => {
    setConfirmState({ skill, args, command: renderCommand(skill, args) });
  }, []);

  const handleConfirmExecute = useCallback(async () => {
    if (!confirmState) return;
    const { skill, args } = confirmState;
    setConfirmState(null);
    await invoke(skill, args, true);
  }, [confirmState, invoke]);

  const handleConfirmCancel = useCallback(() => setConfirmState(null), []);

  // Replay a past run — re-invoke with saved args (destructive ones still confirm).
  const handleReplay = useCallback(
    async (run: { skillId: string; args: Record<string, unknown> }) => {
      const skill = skills.find((s) => s.id === run.skillId);
      if (!skill) return;
      const args = run.args as Record<string, string | number>;
      if (skill.requiresConfirmation) handleRequestConfirm(skill, args);
      else await invoke(skill, args, false);
    },
    [skills, invoke, handleRequestConfirm]
  );

  return (
    <div className="h-screen w-screen flex flex-col bg-bg overflow-hidden">
      <TopBar
        status={status}
        wsMeta={wsMeta}
        agentContext={agentContext}
        activeRunCount={activeRunCount}
        onRunCycle={runCycle}
        onToggleAutoLoop={toggleAutoLoop}
        onSetLoopInterval={setLoopInterval}
        onToggleLeftSidebar={toggleLeftSidebar}
        onToggleRightSidebar={toggleRightSidebar}
        onShowTrades={() => setView('trades')}
        onShowMarkets={() => setView('markets')}
        onShowPayments={() => setView('payments')}
        onShowSkills={() => setView('skills')}
        onOpenPalette={() => setPaletteOpen(true)}
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

      <SetupWizard
        open={setupOpen}
        initialMode={status.mode}
        onClose={handleCloseSetup}
      />

      {/* Agent Command Center — global overlays */}
      <CommandPalette
        open={paletteOpen}
        skills={skills}
        recentRuns={recentSkillIds}
        onClose={() => setPaletteOpen(false)}
        onInvoke={handleInvoke}
        onRequestConfirm={handleRequestConfirm}
      />
      <ConfirmModal
        open={!!confirmState}
        skill={confirmState?.skill ?? null}
        command={confirmState?.command ?? ''}
        onConfirm={handleConfirmExecute}
        onCancel={handleConfirmCancel}
      />
      <AgentConsole runs={runs} onReplay={handleReplay} />

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

      {view === 'skills' && (
        <SkillsPage
          skills={skills}
          runs={runs}
          onBack={() => setView('cockpit')}
          onInvoke={handleInvoke}
          onRequestConfirm={handleRequestConfirm}
        />
      )}

      {view === 'cockpit' && (
      <div className="flex-1 flex overflow-hidden relative">
        {(leftSidebarOpen || rightSidebarOpen) && (
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-20"
            onClick={() => { setLeftSidebarOpen(false); setRightSidebarOpen(false); }}
          />
        )}

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
              skills={skills}
              runs={runs}
              onInvoke={handleInvoke}
              onRequestConfirm={handleRequestConfirm}
            />
          </div>
        </div>

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
              skills={skills}
              runs={runs}
              onInvoke={handleInvoke}
              onRequestConfirm={handleRequestConfirm}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      )}
    </div>
  );
}
