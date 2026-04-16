# OpenTradex Overnight Meta Prompts

## Prompt 1: Gateway API Testing & Hardening
Test ALL gateway endpoints exhaustively. Start the gateway server, hit every endpoint with curl/fetch:
- GET /api/health - verify response structure
- GET /api/scan?exchange=crypto&limit=5 - verify market scanning
- GET /api/search?q=bitcoin - verify search works
- GET /api/quote?exchange=crypto&symbol=BTC - verify quotes
- GET /api/risk - verify risk state returns
- GET /api/events - verify SSE connection and heartbeat
- POST /api/command with {command: "scan markets"} - verify command processing
- GET /api/config - verify config returns (no secrets)
Add proper error handling for edge cases. Fix any bugs found.

## Prompt 2: Dashboard TopBar Enhancement
Improve TopBar.tsx for maximum clarity:
- Make capital display LARGER (text-3xl or text-4xl) with bold weight
- Add real-time P&L animation with color pulse when value changes
- Add sparkline mini-chart for daily P&L history
- Improve mode badge visibility with icon indicators
- Add tooltips explaining each stat (trades, win rate, open positions)
- Make interval selector more prominent with active state glow
- Add connection indicator with ping/latency display
- Ensure all buttons have proper hover/active states

## Prompt 3: LeftSidebar Position Cards Overhaul
Redesign position cards in LeftSidebar.tsx for trading clarity:
- Add real-time price ticker animation (green up, red down flash)
- Show larger P&L with clear +/- indicators and color coding
- Add progress bar showing position vs max size
- Add quick action buttons (close, add, reduce) on hover
- Show entry price vs current price comparison
- Add confidence indicator with visual gauge
- Improve market symbol with exchange icon
- Add mini price chart sparkline for each position
- Sort positions by P&L or size with toggle

## Prompt 4: ChatCockpit UI Polish
Enhance ChatCockpit.tsx messaging experience:
- Add typing indicator with animated dots
- Improve message bubbles with better shadows and spacing
- Add timestamp display on hover
- Add copy button for assistant responses
- Improve mission cards with icons and better hover effects
- Add command history (up/down arrow navigation)
- Add syntax highlighting for code/JSON responses
- Add "clear chat" button
- Improve loading state with skeleton UI
- Add sound notification option for new responses

## Prompt 5: RightSidebar Feed Enhancement
Upgrade RightSidebar.tsx live feed:
- Add filter buttons that actually filter by source
- Add real-time feed animation (slide in from right)
- Show sentiment indicator (bullish/bearish) for each item
- Add "mark as read" functionality
- Improve source icons with actual logos or better styling
- Add expandable preview on click
- Add "open in new tab" link for each item
- Show relevance score if available
- Add refresh button with last update timestamp
- Add notification badge for unread items

## Prompt 6: WebSocket Real-time Engine
Add WebSocket support to gateway/index.ts:
- Create WebSocket server alongside HTTP
- Broadcast position updates via WS (faster than SSE)
- Broadcast trade executions in real-time
- Broadcast price ticker updates
- Add reconnection logic in useHarness.ts
- Add connection quality indicator
- Fallback to SSE if WS fails
- Add message queuing for offline periods
- Implement heartbeat/ping-pong

## Prompt 7: Performance Optimization
Optimize dashboard performance:
- Wrap components in React.memo where appropriate
- Add useMemo for expensive computations (currency formatting)
- Add useCallback for event handlers passed as props
- Implement virtualized lists for positions/trades/feed (if >50 items)
- Add code splitting with React.lazy for sidebars
- Optimize re-renders with proper key props
- Add loading skeleton components
- Minimize bundle size - check for unused imports
- Add performance monitoring with console timing

## Prompt 8: Error Handling & Loading States
Add comprehensive error/loading UX:
- Add ErrorBoundary component for crash recovery
- Add loading skeletons for all data sections
- Add retry buttons for failed API calls
- Add toast notifications for errors
- Add connection lost overlay
- Add graceful degradation when API unavailable
- Add form validation for inputs
- Add confirmation dialogs for dangerous actions (panic)
- Add offline mode indicator

## Prompt 9: Keyboard Shortcuts & Accessibility
Add power user features:
- Cmd/Ctrl+K for command palette
- Cmd/Ctrl+R for run cycle
- Cmd/Ctrl+L for toggle auto loop
- Escape to close modals/clear input
- Tab navigation through all interactive elements
- Aria labels for screen readers
- High contrast mode support
- Focus visible indicators
- Keyboard shortcut help overlay (?)

## Prompt 10: Final Integration Test & Polish
Complete integration testing:
- Start gateway, verify all endpoints respond
- Open dashboard, verify all sections render
- Test SSE real-time updates work
- Test command input and response
- Test all buttons and interactions
- Verify mobile responsive (if applicable)
- Check console for errors/warnings
- Run npm run build and verify no errors
- Test in production mode
- Commit all changes with comprehensive message
