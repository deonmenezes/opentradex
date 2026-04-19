// Skills registry — single source of truth for the Agent Command Center.
// Every action the agent can take is enumerated here so the dashboard can
// render a discoverable, interactive surface for all nine plugin skills,
// the harness intents, and the strategy/analysis modules.

export type SkillCategory = 'trade' | 'inspect' | 'setup' | 'safety' | 'analyze';

export interface SkillArgField {
  name: string;
  type: 'string' | 'number' | 'enum';
  required: boolean;
  description: string;
  enumValues?: string[];
  defaultValue?: string | number;
}

export interface Skill {
  id: string;
  name: string;
  category: SkillCategory;
  description: string;
  args: SkillArgField[];
  destructive: boolean;
  requiresConfirmation: boolean;
  confirmWord?: string;
  exampleInvocations: string[];
  commandTemplate: string;
}

export const SKILLS: Skill[] = [
  // --- TRADE category ---
  {
    id: 'buy-kalshi',
    name: 'Buy Kalshi',
    category: 'trade',
    description: 'Open a paper long position on a Kalshi prediction market at the live scraped price.',
    args: [
      { name: 'side', type: 'enum', required: true, description: 'YES or NO contract', enumValues: ['yes', 'no'], defaultValue: 'yes' },
      { name: 'ticker', type: 'string', required: true, description: 'Kalshi ticker (e.g. KXEARTHQUAKECALIFORNIA-35)' },
      { name: 'qty', type: 'number', required: true, description: 'Contract quantity', defaultValue: 1 },
    ],
    destructive: false,
    requiresConfirmation: false,
    exampleInvocations: [
      'kalshi buy yes KXEARTHQUAKECALIFORNIA-35 5',
      'kalshi buy no KXPRESIDENT-2028-DEM 10',
    ],
    commandTemplate: 'kalshi buy {side} {ticker} {qty}',
  },
  {
    id: 'buy-crypto',
    name: 'Buy Crypto',
    category: 'trade',
    description: 'Open a paper long position on a crypto pair at the live scraped price.',
    args: [
      { name: 'symbol', type: 'string', required: true, description: 'Crypto symbol (e.g. BTC, ETH, SOL)' },
      { name: 'qty', type: 'number', required: true, description: 'Base quantity', defaultValue: 0.001 },
    ],
    destructive: false,
    requiresConfirmation: false,
    exampleInvocations: [
      'crypto buy BTC 0.001',
      'crypto buy ETH 0.05',
    ],
    commandTemplate: 'crypto buy {symbol} {qty}',
  },
  {
    id: 'add-position',
    name: 'Add to Position',
    category: 'trade',
    description: 'Increase an existing open position by 50% of its current size at current mark.',
    args: [
      { name: 'symbol', type: 'string', required: true, description: 'Position symbol' },
      { name: 'exchange', type: 'string', required: true, description: 'Exchange (kalshi|polymarket|crypto|alpaca)' },
    ],
    destructive: false,
    requiresConfirmation: false,
    exampleInvocations: ['add to position KXEARTHQUAKECALIFORNIA-35 on kalshi'],
    commandTemplate: 'add to position {symbol} on {exchange}',
  },
  {
    id: 'reduce-position',
    name: 'Reduce Position',
    category: 'trade',
    description: 'Partially close an open position by a given percentage.',
    args: [
      { name: 'symbol', type: 'string', required: true, description: 'Position symbol' },
      { name: 'exchange', type: 'string', required: true, description: 'Exchange' },
      { name: 'percent', type: 'number', required: true, description: 'Reduction percent', defaultValue: 50 },
    ],
    destructive: true,
    requiresConfirmation: true,
    confirmWord: 'REDUCE',
    exampleInvocations: ['reduce position KXEARTHQUAKECALIFORNIA-35 on kalshi by 50%'],
    commandTemplate: 'reduce position {symbol} on {exchange} by {percent}%',
  },
  {
    id: 'close-position',
    name: 'Close Position',
    category: 'trade',
    description: 'Close an open position entirely and realize P&L to the ledger.',
    args: [
      { name: 'symbol', type: 'string', required: true, description: 'Position symbol' },
      { name: 'exchange', type: 'string', required: true, description: 'Exchange' },
    ],
    destructive: true,
    requiresConfirmation: true,
    confirmWord: 'CLOSE',
    exampleInvocations: ['close position KXEARTHQUAKECALIFORNIA-35 on kalshi'],
    commandTemplate: 'close position {symbol} on {exchange}',
  },

  // --- INSPECT category ---
  {
    id: 'scan',
    name: 'Scan Markets',
    category: 'inspect',
    description: 'Scan live markets across enabled rails. Returns a ranked list of opportunities.',
    args: [
      { name: 'rail', type: 'enum', required: false, description: 'Filter by rail', enumValues: ['all', 'kalshi', 'polymarket', 'crypto', 'tradingview'], defaultValue: 'all' },
      { name: 'limit', type: 'number', required: false, description: 'Max results', defaultValue: 10 },
    ],
    destructive: false,
    requiresConfirmation: false,
    exampleInvocations: ['scan markets', 'scan kalshi 20', 'scan crypto'],
    commandTemplate: 'scan {rail} markets limit {limit}',
  },
  {
    id: 'positions',
    name: 'List Positions',
    category: 'inspect',
    description: 'Show all open paper positions with entry, mark, and unrealized P&L.',
    args: [],
    destructive: false,
    requiresConfirmation: false,
    exampleInvocations: ['positions'],
    commandTemplate: 'positions',
  },
  {
    id: 'risk',
    name: 'Risk Snapshot',
    category: 'inspect',
    description: 'Summarize today risk — open positions, exposure, daily P&L, panic cooldown.',
    args: [],
    destructive: false,
    requiresConfirmation: false,
    exampleInvocations: ['risk'],
    commandTemplate: 'risk',
  },
  {
    id: 'candidates',
    name: 'Ranked Candidates',
    category: 'analyze',
    description: 'Run all strategy modules (prediction-edge, crypto-momentum) and return the top-ranked cross-venue trade candidates.',
    args: [
      { name: 'topN', type: 'number', required: false, description: 'Top N results', defaultValue: 10 },
    ],
    destructive: false,
    requiresConfirmation: false,
    exampleInvocations: ['candidates topN 10', 'candidates topN 5'],
    commandTemplate: 'candidates topN {topN}',
  },

  // --- ANALYZE category ---
  {
    id: 'analyze',
    name: 'Analyze Symbol',
    category: 'analyze',
    description: 'Get an AI-authored thesis for a specific symbol on a specific exchange.',
    args: [
      { name: 'symbol', type: 'string', required: true, description: 'Symbol to analyze' },
      { name: 'exchange', type: 'string', required: true, description: 'Exchange context' },
    ],
    destructive: false,
    requiresConfirmation: false,
    exampleInvocations: ['analyze SOL on crypto', 'analyze KXEARTHQUAKECALIFORNIA-35 on kalshi'],
    commandTemplate: 'analyze {symbol} on {exchange}',
  },

  // --- SETUP category ---
  {
    id: 'onboard',
    name: 'Onboard Rails',
    category: 'setup',
    description: 'One-time interactive setup to add API keys for Kalshi, Polymarket, Alpaca, Coinbase.',
    args: [],
    destructive: false,
    requiresConfirmation: false,
    exampleInvocations: ['onboard'],
    commandTemplate: 'onboard',
  },
  {
    id: 'autoloop',
    name: 'Toggle Auto-Loop',
    category: 'setup',
    description: 'Enable or disable the autonomous scanning loop.',
    args: [
      { name: 'enabled', type: 'enum', required: true, description: 'On or off', enumValues: ['on', 'off'] },
      { name: 'minutes', type: 'number', required: false, description: 'Cycle interval (only when enabled=on)', defaultValue: 5 },
    ],
    destructive: false,
    requiresConfirmation: false,
    exampleInvocations: ['autoloop on 5', 'autoloop off'],
    commandTemplate: 'autoloop {enabled} {minutes}',
  },

  // --- SAFETY category ---
  {
    id: 'panic',
    name: 'PANIC — Flatten All',
    category: 'safety',
    description: 'EMERGENCY: close all open paper positions and set a 30-minute trading cooldown. Irreversible.',
    args: [],
    destructive: true,
    requiresConfirmation: true,
    confirmWord: 'PANIC',
    exampleInvocations: ['panic'],
    commandTemplate: 'panic',
  },
];

export function getSkill(id: string): Skill | undefined {
  return SKILLS.find((s) => s.id === id);
}

export function getSkillsByCategory(category: SkillCategory): Skill[] {
  return SKILLS.filter((s) => s.category === category);
}

export function getAllCategories(): SkillCategory[] {
  return ['trade', 'inspect', 'analyze', 'setup', 'safety'];
}

export function renderCommand(skill: Skill, args: Record<string, string | number>): string {
  let cmd = skill.commandTemplate;
  for (const field of skill.args) {
    const value = args[field.name] ?? field.defaultValue ?? '';
    cmd = cmd.replace(new RegExp(`\\{${field.name}\\}`, 'g'), String(value));
  }
  return cmd.trim();
}
