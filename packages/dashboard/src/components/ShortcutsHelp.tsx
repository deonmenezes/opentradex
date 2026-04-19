import { useEffect } from 'react';

interface ShortcutsHelpProps {
  open: boolean;
  onClose: () => void;
}

const shortcuts: Array<{ keys: string[]; action: string; category: string }> = [
  { keys: ['⌘', 'K'],   action: 'Open command palette',           category: 'General' },
  { keys: ['Ctrl', 'K'], action: 'Open command palette (Win/Linux)', category: 'General' },
  { keys: ['?'],         action: 'Toggle this help',                category: 'General' },
  { keys: ['/'],         action: 'Focus chat input',                category: 'General' },
  { keys: ['Esc'],       action: 'Close overlay / cancel',          category: 'General' },

  { keys: ['g', 's'],    action: 'Go to Skills page',               category: 'Navigation' },
  { keys: ['g', 'm'],    action: 'Go to Markets page',              category: 'Navigation' },
  { keys: ['g', 't'],    action: 'Go to Trades page',               category: 'Navigation' },
  { keys: ['s'],         action: 'Go to Skills page (shortcut)',    category: 'Navigation' },

  { keys: ['g', 'r'],    action: 'Run risk snapshot',               category: 'Quick actions' },
  { keys: ['g', 'p'],    action: 'Run positions check',             category: 'Quick actions' },
  { keys: ['c'],         action: 'Open chain builder',              category: 'Quick actions' },
  { keys: ['!'],         action: 'Open panic confirmation',         category: 'Quick actions' },
];

const categories = ['General', 'Navigation', 'Quick actions'];

// Shortcuts help overlay (US-013). Listens for `?` when closed, Escape when open.
// Grouped by category so the user can scan without reading every row.
export default function ShortcutsHelp({ open, onClose }: ShortcutsHelpProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
      data-testid="shortcuts-help"
    >
      <div
        className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-border flex items-center gap-3">
          <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h2 className="text-base font-bold text-text flex-1">Keyboard Shortcuts</h2>
          <button onClick={onClose} data-testid="shortcuts-close"
            className="p-1.5 rounded-lg hover:bg-surface-2 text-text-dim hover:text-text transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 max-h-[70vh] overflow-y-auto">
          {categories.map((cat) => {
            const items = shortcuts.filter((s) => s.category === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat} className="mb-4 last:mb-0">
                <h3 className="text-2xs uppercase tracking-wider text-text-dim font-semibold mb-2">{cat}</h3>
                <div className="space-y-1">
                  {items.map((s, i) => (
                    <div key={`${cat}-${i}`} className="flex items-center gap-2 text-xs py-1">
                      <div className="flex items-center gap-1 shrink-0">
                        {s.keys.map((k, ki) => (
                          <span key={ki}>
                            <kbd className="inline-flex items-center px-1.5 py-0.5 rounded bg-bg border border-border text-text font-mono text-2xs">
                              {k}
                            </kbd>
                            {ki < s.keys.length - 1 && <span className="text-text-dim mx-1 text-2xs">then</span>}
                          </span>
                        ))}
                      </div>
                      <span className="text-text flex-1">{s.action}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="px-5 py-2 border-t border-border bg-bg/40">
          <p className="text-2xs text-text-dim">
            Shortcuts are disabled while typing. Press <kbd className="px-1 py-0 rounded bg-bg border border-border text-2xs">Esc</kbd> to close.
          </p>
        </div>
      </div>
    </div>
  );
}
