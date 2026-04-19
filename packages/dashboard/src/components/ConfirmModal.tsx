import { useState, useEffect, useRef } from 'react';
import type { Skill } from '../lib/skills';

interface ConfirmModalProps {
  open: boolean;
  skill: Skill | null;
  command: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// Type-to-confirm + button. US-008 — destructive skills require typed confirmation word
// AND a button click before they're invoked. Esc cancels.
export default function ConfirmModal({ open, skill, command, onConfirm, onCancel }: ConfirmModalProps) {
  const [typed, setTyped] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setTyped('');
      return;
    }
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open || !skill) return null;

  const confirmWord = skill.confirmWord ?? 'CONFIRM';
  const matches = typed.trim().toUpperCase() === confirmWord.toUpperCase();

  return (
    <div
      data-testid="confirm-modal"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="w-full max-w-md rounded-xl bg-surface border border-danger/60 shadow-2xl shadow-danger/30 overflow-hidden animate-[fadeIn_150ms_ease-out]">
        {/* Header */}
        <div className="px-5 py-4 bg-danger/10 border-b border-danger/30 flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-danger/20 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-text">Confirm: {skill.name}</h2>
            <p className="text-xs text-text-dim mt-1 leading-relaxed">{skill.description}</p>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="px-3 py-2 rounded-md bg-bg border border-border">
            <div className="text-2xs uppercase text-text-dim tracking-wider mb-1">Command</div>
            <code className="text-sm text-text font-mono break-all">{command}</code>
          </div>

          <div>
            <label className="block text-xs text-text-dim mb-2">
              Type <span className="font-mono font-bold text-danger">{confirmWord}</span> to confirm:
            </label>
            <input
              ref={inputRef}
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && matches) onConfirm(); }}
              placeholder={confirmWord}
              data-testid="confirm-input"
              className="w-full px-3 py-2 rounded-md bg-bg border-2 border-border text-text font-mono text-center text-lg focus:outline-none focus:border-danger transition-colors"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 rounded-md bg-surface-2 text-text border border-border hover:bg-card-hover text-sm font-medium transition-colors"
            data-testid="confirm-cancel"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!matches}
            data-testid="confirm-submit"
            className={`flex-1 px-4 py-2 rounded-md text-sm font-bold transition-all ${
              matches
                ? 'bg-danger text-bg shadow-lg shadow-danger/30 hover:bg-danger/90'
                : 'bg-surface-2 text-text-dim cursor-not-allowed'
            }`}
          >
            {matches ? 'Execute' : `Type ${confirmWord}`}
          </button>
        </div>
      </div>
    </div>
  );
}
