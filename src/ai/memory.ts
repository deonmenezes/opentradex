import { join } from 'node:path';
import { homedir } from 'node:os';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const MAX_TURNS = 40;
const RECENT_FOR_PROMPT = 12;

export interface MemoryExchange {
  userId: string;
  userMessage: string;
  assistantMessage: string;
}

export interface RecalledMemory {
  text: string;
  score?: number;
}

interface StoredTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface StoredMemory {
  turns: StoredTurn[];
  preferences: string[];
}

function dataDir(): string {
  const dir = join(homedir(), '.opentradex', 'memory');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function filePath(userId: string): string {
  const safe = userId.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'default';
  return join(dataDir(), `${safe}.json`);
}

function loadFor(userId: string): StoredMemory {
  const p = filePath(userId);
  if (!existsSync(p)) return { turns: [], preferences: [] };
  try {
    const parsed = JSON.parse(readFileSync(p, 'utf8')) as Partial<StoredMemory>;
    return {
      turns: Array.isArray(parsed.turns) ? parsed.turns.slice(-MAX_TURNS) : [],
      preferences: Array.isArray(parsed.preferences) ? parsed.preferences : [],
    };
  } catch {
    return { turns: [], preferences: [] };
  }
}

function saveFor(userId: string, mem: StoredMemory): void {
  try {
    writeFileSync(filePath(userId), JSON.stringify(mem, null, 2), 'utf8');
  } catch (err) {
    console.error('[memory] save error:', err);
  }
}

function extractPreferences(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  const patterns = [
    /(?:i (?:prefer|like|want|love|use|trade))\s+[^.!?\n]{4,120}/gi,
    /(?:my (?:preference|style|strategy|risk|budget|limit|max))\s+(?:is\s+)?[^.!?\n]{4,120}/gi,
    /(?:always|never|only)\s+[^.!?\n]{4,120}/gi,
    /\$\d+(?:[.,]\d+)?(?:\s*(?:max|limit|risk|per trade))?/gi,
  ];
  for (const pat of patterns) {
    const matches = text.match(pat);
    if (matches) for (const m of matches) found.push(m.trim());
  }
  const explicit = lower.match(/remember[:\-\s]+([^.!?\n]{4,200})/i);
  if (explicit) found.push(explicit[1].trim());
  return found.slice(0, 8);
}

class MemoryService {
  isEnabled(): boolean {
    return true;
  }

  async recall(userId: string, _query: string, _topK?: number): Promise<RecalledMemory[]> {
    const mem = loadFor(userId);
    const items: RecalledMemory[] = [];
    const isNewUser = mem.turns.length === 0 && mem.preferences.length === 0;
    items.push({ text: `[SessionStatus] ${isNewUser ? 'NEW_USER' : 'RETURNING_USER'}` });
    for (const pref of mem.preferences.slice(-10)) {
      items.push({ text: `[Preference] ${pref}` });
    }
    const recentTurns = mem.turns.slice(-RECENT_FOR_PROMPT);
    for (const t of recentTurns) {
      const label = t.role === 'user' ? 'User' : 'Assistant';
      items.push({ text: `[${label}] ${t.content.slice(0, 280)}` });
    }
    return items;
  }

  async remember(exchange: MemoryExchange): Promise<void> {
    const { userId, userMessage, assistantMessage } = exchange;
    if (!userMessage.trim() || !assistantMessage.trim()) return;
    const mem = loadFor(userId);
    const now = Date.now();
    mem.turns.push({ role: 'user', content: userMessage, timestamp: now });
    mem.turns.push({ role: 'assistant', content: assistantMessage, timestamp: now });
    if (mem.turns.length > MAX_TURNS) mem.turns = mem.turns.slice(-MAX_TURNS);
    const newPrefs = extractPreferences(userMessage);
    for (const p of newPrefs) {
      if (!mem.preferences.includes(p)) mem.preferences.push(p);
    }
    if (mem.preferences.length > 30) mem.preferences = mem.preferences.slice(-30);
    saveFor(userId, mem);
  }

  formatForPrompt(memories: RecalledMemory[]): string {
    if (!memories.length) return '';
    const status = memories.find((m) => m.text.startsWith('[SessionStatus]'));
    const prefs = memories.filter((m) => m.text.startsWith('[Preference]'));
    const turns = memories.filter(
      (m) => !m.text.startsWith('[Preference]') && !m.text.startsWith('[SessionStatus]')
    );
    const sections: string[] = [];
    if (status) {
      const isNew = status.text.includes('NEW_USER');
      sections.push(
        isNew
          ? 'Session: NEW_USER — this is the user\'s first message. Follow the greeting rule.'
          : 'Session: RETURNING_USER — skip the greeting, pick up where they left off.'
      );
      sections.push('');
    }
    if (prefs.length) {
      sections.push('User preferences (from prior conversations):');
      sections.push(...prefs.map((m) => `- ${m.text.replace('[Preference] ', '')}`));
      sections.push('');
    }
    if (turns.length) {
      sections.push('Recent conversation history:');
      sections.push(...turns.map((m) => m.text));
      sections.push('');
    }
    return sections.join('\n');
  }
}

let singleton: MemoryService | null = null;

export function getMemory(): MemoryService {
  if (!singleton) singleton = new MemoryService();
  return singleton;
}

export function resetMemorySingleton(): void {
  singleton = null;
}
