import { useState, useEffect } from 'react';
import TopBar from './components/TopBar';
import LeftSidebar from './components/LeftSidebar';
import ChatCockpit from './components/ChatCockpit';
import RightSidebar from './components/RightSidebar';
import { useHarness } from './hooks/useHarness';

export default function App() {
  const { status, positions, trades, markets, feed, sendCommand } = useHarness();
  const [selectedChannel, setSelectedChannel] = useState<string>('command');

  return (
    <div className="h-screen w-screen flex flex-col bg-bg overflow-hidden">
      {/* Top Bar */}
      <TopBar status={status} />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Positions, Trades, Markets */}
        <LeftSidebar
          positions={positions}
          trades={trades}
          markets={markets}
        />

        {/* Center - Chat Cockpit */}
        <ChatCockpit
          selectedChannel={selectedChannel}
          onChannelChange={setSelectedChannel}
          onCommand={sendCommand}
          status={status}
        />

        {/* Right Sidebar - Feed */}
        <RightSidebar feed={feed} />
      </div>
    </div>
  );
}
