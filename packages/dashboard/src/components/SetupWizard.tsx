/**
 * SetupWizard — step-by-step onboarding modal.
 *
 * Flow: Mode → Provider → API key → Test → Done.
 * All four steps live in one overlay; users can go back and re-pick at any
 * point. The wizard calls /api/mode, /api/ai/providers/test, and
 * /api/ai/providers/save. No external deps — pure React + Tailwind.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TradingMode } from '../lib/types';

type Step = 'mode' | 'provider' | 'apiKey' | 'done';

/** Electron preload surface — present only when running inside the desktop app. */
interface DesktopSecrets {
  list: () => Promise<{ names: string[]; canEncrypt: boolean }>;
  save: (provider: string, apiKey: string) => Promise<{ ok: boolean; provider?: string; encrypted?: boolean; error?: string }>;
  delete: (provider: string) => Promise<{ ok: boolean; error?: string }>;
  canEncrypt: () => Promise<{ canEncrypt: boolean }>;
}

function getDesktopSecrets(): DesktopSecrets | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { opentradex?: { secrets?: DesktopSecrets } };
  return w.opentradex?.secrets ?? null;
}

/** Matches the shape returned by GET /api/ai/cli-detect. */
interface CLIDetectionEntry {
  provider: string;
  binary: string;
  path: string | null;
  available: boolean;
  label: string;
  description: string;
  requiresApiKey: boolean;
  configured?: boolean;
  defaultModel?: string | null;
}

interface SetupWizardProps {
  open: boolean;
  initialMode?: TradingMode;
  onClose: () => void;
  onComplete?: (result: { mode: TradingMode; provider: string }) => void;
}

interface ProviderCard {
  id: string;
  name: string;
  tagline: string;
  docsUrl: string;
  recommended?: boolean;
  keyPrefix?: string; // e.g. "sk-" so we can show a tiny hint
  getKeyHowTo: string;
}

const PROVIDERS: ProviderCard[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    tagline: 'GPT-4o, o1, o3 — broadest model coverage',
    docsUrl: 'https://platform.openai.com/api-keys',
    recommended: true,
    keyPrefix: 'sk-',
    getKeyHowTo: 'Go to platform.openai.com → API keys → Create new secret key.',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    tagline: 'Claude 4 Sonnet / Opus — best reasoning',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    keyPrefix: 'sk-ant-',
    getKeyHowTo: 'Go to console.anthropic.com → Settings → API Keys → Create Key.',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    tagline: 'Gemini 2.0 — fast + free tier',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    getKeyHowTo: 'Go to aistudio.google.com → Get API key → Create API key.',
  },
  {
    id: 'groq',
    name: 'Groq',
    tagline: 'Llama 3.3 70B — fastest inference',
    docsUrl: 'https://console.groq.com/keys',
    keyPrefix: 'gsk_',
    getKeyHowTo: 'Go to console.groq.com → API Keys → Create API Key.',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    tagline: 'DeepSeek-chat — cheapest per token',
    docsUrl: 'https://platform.deepseek.com/api_keys',
    keyPrefix: 'sk-',
    getKeyHowTo: 'Go to platform.deepseek.com → API keys → Create API key.',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    tagline: 'One key for every model',
    docsUrl: 'https://openrouter.ai/keys',
    keyPrefix: 'sk-or-',
    getKeyHowTo: 'Go to openrouter.ai → Keys → Create Key.',
  },
  {
    id: 'kimi',
    name: 'Kimi',
    tagline: 'Moonshot — long-context specialist',
    docsUrl: 'https://platform.moonshot.ai/console/api-keys',
    getKeyHowTo: 'Go to platform.moonshot.ai → API Keys → Create Key.',
  },
  {
    id: 'xai',
    name: 'xAI Grok',
    tagline: 'Grok-2 — realtime X access',
    docsUrl: 'https://console.x.ai',
    keyPrefix: 'xai-',
    getKeyHowTo: 'Go to console.x.ai → API Keys → Create Key.',
  },
];

const MODE_CARDS: Array<{
  id: TradingMode;
  title: string;
  subtitle: string;
  tone: 'safe' | 'balanced' | 'danger';
  bullets: string[];
}> = [
  {
    id: 'paper-only',
    title: 'Paper Only',
    subtitle: 'Recommended for your first trade',
    tone: 'safe',
    bullets: [
      'No real money can be traded, ever',
      'Mode is locked — irreversible on this machine',
      'Every signal, order, and P&L is fully simulated',
    ],
  },
  {
    id: 'paper-default',
    title: 'Paper Default',
    subtitle: 'Paper now, unlock live later',
    tone: 'balanced',
    bullets: [
      'Paper by default — safer day-to-day',
      'You can unlock live trading per session',
      'Good for users who want flexibility',
    ],
  },
  {
    id: 'live-allowed',
    title: 'Live Allowed',
    subtitle: 'Real orders, real money — advanced users',
    tone: 'danger',
    bullets: [
      'Orders can route to real exchanges',
      'Requires exchange API keys + risk limits',
      'Every fill hits your real balance',
    ],
  },
];

function toneClass(tone: 'safe' | 'balanced' | 'danger', selected: boolean): string {
  if (selected) {
    switch (tone) {
      case 'safe':     return 'border-accent bg-accent/10 ring-1 ring-accent/40';
      case 'balanced': return 'border-warning bg-warning/10 ring-1 ring-warning/40';
      case 'danger':   return 'border-danger bg-danger/10 ring-1 ring-danger/40';
    }
  }
  return 'border-border bg-surface-2 hover:border-text-dim';
}

export default function SetupWizard({ open, initialMode, onClose, onComplete }: SetupWizardProps) {
  const [step, setStep] = useState<Step>('mode');
  const [mode, setMode] = useState<TradingMode>(initialMode || 'paper-only');
  const [providerId, setProviderId] = useState<string>('openai');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<
    | { ok: true; latencyMs: number; model: string; content?: string }
    | { ok: false; error: string }
    | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [savedProviders, setSavedProviders] = useState<string[]>([]);
  const [canEncrypt, setCanEncrypt] = useState(false);
  const [detectedCLIs, setDetectedCLIs] = useState<CLIDetectionEntry[]>([]);
  const [preferredProvider, setPreferredProvider] = useState<string | null>(null);
  const [cliLoading, setCliLoading] = useState(false);
  const [cliError, setCliError] = useState<string | null>(null);

  const provider = useMemo(() => PROVIDERS.find((p) => p.id === providerId) || PROVIDERS[0], [providerId]);

  // Reset to step 1 whenever the modal reopens.
  useEffect(() => {
    if (!open) return;
    setStep('mode');
    setApiKey('');
    setShowKey(false);
    setTestResult(null);
    setSaving(false);
    setTesting(false);

    // Prefer the desktop keychain API when available — it both lists saved
    // providers AND tells us whether encryption-at-rest is working. Fall back
    // to the gateway HTTP endpoint when running in a plain browser.
    const desktop = getDesktopSecrets();
    if (desktop) {
      desktop.list()
        .then(({ names, canEncrypt: can }) => {
          setSavedProviders(names);
          setCanEncrypt(can);
        })
        .catch(() => { setSavedProviders([]); setCanEncrypt(false); });
    } else {
      setCanEncrypt(false);
    }

    // Gateway-backed metadata — providers list (also gives us `saved` when
    // the browser path is active) and CLI detection (always via gateway).
    fetch('/api/ai/providers')
      .then((r) => r.json())
      .then((data: { saved?: string[]; preferred?: string | null }) => {
        if (!desktop) setSavedProviders(data?.saved ?? []);
        setPreferredProvider(data?.preferred ?? null);
      })
      .catch(() => { /* non-fatal */ });

    setCliLoading(true);
    setCliError(null);
    fetch('/api/ai/cli-detect')
      .then((r) => r.json())
      .then((data: { detected?: CLIDetectionEntry[] }) => {
        setDetectedCLIs(Array.isArray(data?.detected) ? data.detected : []);
      })
      .catch((e) => {
        setDetectedCLIs([]);
        setCliError(e instanceof Error ? e.message : 'CLI detection failed');
      })
      .finally(() => setCliLoading(false));
  }, [open]);

  // Esc closes the wizard. Ignored mid-save so the user can't orphan the flow.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving && !testing) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, saving, testing]);

  const handleSaveMode = useCallback(async () => {
    try {
      const res = await fetch('/api/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Gateway returned ${res.status}`);
      setStep('provider');
    } catch (e) {
      // Non-fatal: mode write may be locked. Let the user continue to the API key step
      // so they can at least finish setup; the error is surfaced in the header bar.
      const msg = e instanceof Error ? e.message : 'Could not save mode';
      // eslint-disable-next-line no-alert
      alert(`Mode save failed: ${msg}\n\nContinuing with existing mode.`);
      setStep('provider');
    }
  }, [mode]);

  const handleTest = useCallback(async () => {
    if (!apiKey.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/ai/providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId, apiKey: apiKey.trim() }),
      });
      const data = await res.json() as
        | { ok: true; latencyMs: number; model: string; content?: string }
        | { ok: false; error: string; latencyMs?: number };
      if (data.ok) {
        setTestResult({ ok: true, latencyMs: data.latencyMs, model: data.model, content: data.content });
      } else {
        setTestResult({ ok: false, error: (data as { error: string }).error || 'Unknown error' });
      }
    } catch (e) {
      setTestResult({ ok: false, error: e instanceof Error ? e.message : 'Network error' });
    } finally {
      setTesting(false);
    }
  }, [apiKey, providerId]);

  const handleUseCLI = useCallback(async (cliProvider: string) => {
    // CLI providers self-auth — no API key step. Persist the user's choice as
    // OPENTRADEX_ROLE_ORCHESTRATOR via the gateway so routing prefers this
    // binary going forward, then jump straight to the done screen.
    setSaving(true);
    setCliError(null);
    try {
      const res = await fetch('/api/ai/preferred', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: cliProvider }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Gateway returned ${res.status}`);
      setPreferredProvider(cliProvider);
      setProviderId(cliProvider);
      setStep('done');
      onComplete?.({ mode, provider: cliProvider });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not save CLI preference';
      setCliError(msg);
    } finally {
      setSaving(false);
    }
  }, [mode, onComplete]);

  const handleSaveKey = useCallback(async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    try {
      const desktop = getDesktopSecrets();
      if (desktop) {
        // Running in Electron: persist via IPC so the key is encrypted with
        // the OS keychain (Keychain / DPAPI / libsecret). The main process
        // also forwards to the gateway so it's live this session.
        const result = await desktop.save(providerId, apiKey.trim());
        if (!result.ok) throw new Error(result.error || 'Keychain save failed');
      } else {
        // Browser / bare-gateway path: save through the HTTP endpoint, which
        // writes to 0600 plaintext JSON (still safe, just not OS-encrypted).
        const res = await fetch('/api/ai/providers/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: providerId, apiKey: apiKey.trim() }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || `Gateway returned ${res.status}`);
      }
      setStep('done');
      onComplete?.({ mode, provider: providerId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Save failed';
      setTestResult({ ok: false, error: msg });
    } finally {
      setSaving(false);
    }
  }, [apiKey, providerId, mode, onComplete]);

  if (!open) return null;

  const stepIndex: Record<Step, number> = { mode: 0, provider: 1, apiKey: 2, done: 3 };
  const currentIdx = stepIndex[step];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="setup-wizard-title"
    >
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-surface border border-border shadow-2xl overflow-hidden">
        {/* Header / progress */}
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 id="setup-wizard-title" className="text-lg font-semibold text-text">Set up OpenTradex</h2>
            <button
              onClick={onClose}
              disabled={saving || testing}
              className="p-1 rounded text-text-dim hover:text-text hover:bg-surface-2 transition-colors disabled:opacity-40"
              aria-label="Close setup"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-2">
            {(['Mode', 'Provider', 'API key', 'Done'] as const).map((label, i) => (
              <div key={label} className="flex-1 flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  i < currentIdx ? 'bg-accent text-bg'
                  : i === currentIdx ? 'bg-accent/20 text-accent border border-accent'
                  : 'bg-surface-2 text-text-dim border border-border'
                }`}>
                  {i < currentIdx ? '✓' : i + 1}
                </div>
                <span className={`text-xs ${i <= currentIdx ? 'text-text' : 'text-text-dim'}`}>{label}</span>
                {i < 3 && (
                  <div className={`flex-1 h-px ${i < currentIdx ? 'bg-accent' : 'bg-border'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 'mode' && (
            <div className="space-y-4">
              <p className="text-sm text-text-dim">
                Pick how OpenTradex should handle orders. You can change this later (except <b>Paper Only</b>, which locks the machine).
              </p>
              <div className="space-y-3">
                {MODE_CARDS.map((m) => {
                  const selected = mode === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setMode(m.id)}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${toneClass(m.tone, selected)}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-text">{m.title}</span>
                          {m.tone === 'safe' && <span className="text-2xs font-bold px-1.5 py-0.5 rounded bg-accent/20 text-accent">RECOMMENDED</span>}
                          {m.tone === 'danger' && <span className="text-2xs font-bold px-1.5 py-0.5 rounded bg-danger/20 text-danger">ADVANCED</span>}
                        </div>
                        {selected && (
                          <svg className={`w-5 h-5 ${m.tone === 'danger' ? 'text-danger' : m.tone === 'balanced' ? 'text-warning' : 'text-accent'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <p className="text-xs text-text-dim mb-2">{m.subtitle}</p>
                      <ul className="text-xs text-text space-y-1">
                        {m.bullets.map((b, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-text-dim">•</span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 'provider' && (
            <div className="space-y-4">
              {(() => {
                const available = detectedCLIs.filter((c) => c.available);
                if (cliLoading) {
                  return (
                    <div className="p-3 rounded-lg border border-border bg-surface-2/50 text-xs text-text-dim">
                      Scanning your system for installed AI CLIs…
                    </div>
                  );
                }
                if (available.length === 0) return null;
                return (
                  <div className="p-4 rounded-xl border border-accent/40 bg-accent/5">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 5.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-.34-.014-.675-.04-1.007z" />
                      </svg>
                      <h3 className="text-sm font-semibold text-text">Detected on your system</h3>
                      <span className="text-2xs font-bold px-1.5 py-0.5 rounded bg-accent/20 text-accent">NO API KEY NEEDED</span>
                    </div>
                    <p className="text-xs text-text-dim mb-3">
                      These tools are already installed and signed in. Click <b>Use this</b> and you're done — no API key step.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {available.map((cli) => {
                        const isPreferred = preferredProvider === cli.provider;
                        return (
                          <div
                            key={cli.provider}
                            className={`p-3 rounded-lg border transition-colors ${
                              isPreferred
                                ? 'border-accent bg-accent/10 ring-1 ring-accent/40'
                                : 'border-border bg-bg'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold text-text text-sm">{cli.label}</span>
                              {isPreferred && (
                                <span className="text-2xs font-bold px-1.5 py-0.5 rounded bg-accent/20 text-accent">ACTIVE</span>
                              )}
                            </div>
                            <p className="text-2xs text-text-dim mb-2">{cli.description}</p>
                            <button
                              onClick={() => handleUseCLI(cli.provider)}
                              disabled={saving}
                              className="w-full px-2 py-1.5 text-xs font-semibold rounded-md bg-accent text-bg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {saving ? 'Setting up…' : isPreferred ? 'In use — finish' : 'Use this →'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    {cliError && (
                      <div className="mt-2 text-2xs text-danger break-words">{cliError}</div>
                    )}
                  </div>
                );
              })()}

              <p className="text-sm text-text-dim">
                {detectedCLIs.some((c) => c.available)
                  ? 'Or pick a cloud provider and paste your API key:'
                  : 'Pick an AI provider. You only need one to get started — we suggest OpenAI if you are new.'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PROVIDERS.map((p) => {
                  const selected = providerId === p.id;
                  const already = savedProviders.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => setProviderId(p.id)}
                      className={`text-left p-3 rounded-xl border transition-all ${
                        selected
                          ? 'border-accent bg-accent/10 ring-1 ring-accent/40'
                          : 'border-border bg-surface-2 hover:border-text-dim'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-text">{p.name}</span>
                        <div className="flex items-center gap-1">
                          {p.recommended && <span className="text-2xs font-bold px-1.5 py-0.5 rounded bg-accent/20 text-accent">BEST</span>}
                          {already && <span className="text-2xs font-bold px-1.5 py-0.5 rounded bg-accent/20 text-accent">SAVED</span>}
                        </div>
                      </div>
                      <p className="text-xs text-text-dim">{p.tagline}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 'apiKey' && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-surface-2 border border-border">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs uppercase tracking-wide text-text-dim">Selected provider</span>
                  <button
                    onClick={() => setStep('provider')}
                    className="text-xs text-accent hover:underline"
                  >
                    Change
                  </button>
                </div>
                <div className="font-semibold text-text">{provider.name}</div>
                <div className="text-xs text-text-dim">{provider.tagline}</div>
              </div>

              <div className="p-3 rounded-lg bg-accent/5 border border-accent/30">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-accent mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-xs text-text">
                    <div className="font-semibold mb-1">How to get a key</div>
                    <p className="text-text-dim mb-1">{provider.getKeyHowTo}</p>
                    <a
                      href={provider.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline"
                    >
                      Open {new URL(provider.docsUrl).hostname} →
                    </a>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="api-key" className="block text-xs uppercase tracking-wide text-text-dim mb-1">
                  API key
                </label>
                <div className="relative">
                  <input
                    id="api-key"
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => { setApiKey(e.target.value); setTestResult(null); }}
                    placeholder={provider.keyPrefix ? `${provider.keyPrefix}...` : 'Paste your key here'}
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full px-3 py-2 pr-20 rounded-lg bg-bg border border-border text-text text-sm font-mono focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-2xs font-semibold rounded text-text-dim hover:text-text hover:bg-surface-2"
                  >
                    {showKey ? 'HIDE' : 'SHOW'}
                  </button>
                </div>
                <p className="text-2xs text-text-dim mt-1">
                  {canEncrypt ? (
                    <>
                      Stored in your <span className="text-accent">OS keychain</span> (encrypted at rest by the system).
                      Never sent anywhere except the provider you picked.
                    </>
                  ) : (
                    <>
                      Stored locally at <code className="font-mono">~/.opentradex/ai-keys.json</code> (0600). Never sent anywhere except the provider you picked.
                    </>
                  )}
                </p>
              </div>

              {testResult && (
                <div className={`p-3 rounded-lg border text-xs ${
                  testResult.ok
                    ? 'border-accent/40 bg-accent/10 text-text'
                    : 'border-danger/40 bg-danger/10 text-text'
                }`}>
                  {testResult.ok ? (
                    <>
                      <div className="font-semibold text-accent mb-1">Key works!</div>
                      <div className="text-text-dim">
                        Model: <span className="font-mono text-text">{testResult.model}</span>
                        <span className="mx-2">·</span>
                        Latency: <span className="font-mono text-text">{testResult.latencyMs}ms</span>
                      </div>
                      {testResult.content && (
                        <div className="mt-1 text-text-dim italic">“{testResult.content.slice(0, 80)}”</div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="font-semibold text-danger mb-1">Key test failed</div>
                      <div className="text-text-dim break-words">{testResult.error}</div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 'done' && (
            <div className="text-center py-8">
              <div className="mx-auto w-14 h-14 rounded-full bg-accent/20 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-text mb-1">You're all set</h3>
              <p className="text-sm text-text-dim max-w-sm mx-auto">
                <span className="text-text font-mono">{provider.name}</span> is wired up in{' '}
                <span className="text-text font-mono">{mode}</span> mode. Try sending a command or run a scan.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border flex items-center justify-between gap-3 bg-surface-2/50">
          <button
            onClick={() => {
              if (step === 'provider') setStep('mode');
              else if (step === 'apiKey') setStep('provider');
              else if (step === 'done') onClose();
              else onClose();
            }}
            disabled={saving || testing}
            className="px-3 py-2 text-sm text-text-dim hover:text-text transition-colors disabled:opacity-40"
          >
            {step === 'mode' ? 'Cancel' : step === 'done' ? 'Close' : '← Back'}
          </button>

          <div className="flex items-center gap-2">
            {step === 'apiKey' && (
              <button
                onClick={handleTest}
                disabled={!apiKey.trim() || testing || saving}
                className="px-3 py-2 text-sm font-medium rounded-lg border border-border text-text hover:bg-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {testing ? 'Testing…' : 'Test key'}
              </button>
            )}

            {step === 'mode' && (
              <button
                onClick={handleSaveMode}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-accent text-bg hover:opacity-90 transition-opacity"
              >
                Continue →
              </button>
            )}

            {step === 'provider' && (
              <button
                onClick={() => setStep('apiKey')}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-accent text-bg hover:opacity-90 transition-opacity"
              >
                Continue →
              </button>
            )}

            {step === 'apiKey' && (
              <button
                onClick={handleSaveKey}
                disabled={!apiKey.trim() || saving || testing}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-accent text-bg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving…' : testResult?.ok ? 'Save & finish' : 'Save'}
              </button>
            )}

            {step === 'done' && (
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-accent text-bg hover:opacity-90 transition-opacity"
              >
                Go to dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
