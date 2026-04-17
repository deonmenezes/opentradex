import { useCallback, useEffect, useMemo, useState } from 'react';

interface PaymentsPageProps {
  onBack: () => void;
}

interface X402Status {
  enabled: boolean;
  active: boolean;
  chain: 'base-sepolia' | 'base';
  maxPaymentUsd: number;
  address: string | null;
  facilitatorUrl: string | null;
}

interface LedgerEntry {
  timestamp: string;
  direction: 'out' | 'in';
  url: string;
  amountUsd: number;
  txHash?: string;
  chain: string;
  note?: string;
}

const API_BASE = '/api';
const REFRESH_MS = 5000;

export default function PaymentsPage({ onBack }: PaymentsPageProps) {
  const [status, setStatus] = useState<X402Status | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [showSetup, setShowSetup] = useState(false);
  const [chain, setChain] = useState<'base-sepolia' | 'base'>('base-sepolia');
  const [maxPaymentUsd, setMaxPaymentUsd] = useState(1);
  const [keyMode, setKeyMode] = useState<'generate' | 'paste'>('generate');
  const [pastedKey, setPastedKey] = useState('');

  const load = useCallback(async () => {
    try {
      const [s, l] = await Promise.all([
        fetch(`${API_BASE}/x402/status`).then((r) => r.ok ? r.json() : null),
        fetch(`${API_BASE}/x402/ledger?limit=50`).then((r) => r.ok ? r.json() : null),
      ]);
      if (s) setStatus(s as X402Status);
      if (l?.entries) setLedger(l.entries as LedgerEntry[]);
    } catch {
      // gateway may not be running yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const enablePayments = async () => {
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { chain, maxPaymentUsd };
      if (keyMode === 'generate') body.generate = true;
      else body.privateKey = pastedKey.trim();

      const res = await fetch(`${API_BASE}/x402/enable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || `HTTP ${res.status}`);
      setShowSetup(false);
      setPastedKey('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const disablePayments = async () => {
    if (!confirm('Disable x402 payments and clear the stored key?')) return;
    setBusy(true);
    try {
      await fetch(`${API_BASE}/x402/disable`, { method: 'POST' });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const totals = useMemo(() => {
    const out = ledger.filter((e) => e.direction === 'out').reduce((a, e) => a + e.amountUsd, 0);
    return { out, count: ledger.length };
  }, [ledger]);

  const chainLabel = status?.chain === 'base' ? 'Base mainnet' : 'Base Sepolia (testnet)';
  const faucetUrl = 'https://faucet.circle.com';

  return (
    <div className="flex-1 flex flex-col bg-bg overflow-hidden">
      {/* Header */}
      <div className="h-14 md:h-16 bg-surface border-b border-border flex items-center justify-between px-4 md:px-6 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg bg-surface-2 hover:bg-card-hover text-text-dim hover:text-accent transition-colors"
            aria-label="Back"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div>
            <h1 className="text-text font-semibold text-base md:text-lg">x402 Agentic Payments</h1>
            <p className="text-text-dim text-xs">Auto-pay 402-gated APIs with USDC micropayments</p>
          </div>
        </div>
        {status?.enabled && (
          <button
            onClick={disablePayments}
            disabled={busy}
            className="px-3 py-1.5 text-xs rounded-lg bg-surface-2 hover:bg-card-hover text-danger border border-danger/30"
          >
            Disable
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
        {loading && <div className="text-text-dim text-sm">Loading…</div>}

        {/* Status card */}
        {status && (
          <div className="bg-surface border border-border rounded-xl p-4 md:p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full ${status.active ? 'bg-accent' : 'bg-text-dim/50'}`} />
                  <span className="text-text font-semibold">
                    {status.active ? 'Active' : status.enabled ? 'Configured (inactive)' : 'Not configured'}
                  </span>
                </div>
                <div className="text-text-dim text-xs">{chainLabel} · Max ${status.maxPaymentUsd} per call</div>
              </div>
              {!status.enabled && (
                <button
                  onClick={() => setShowSetup(true)}
                  className="px-4 py-2 rounded-lg bg-accent/20 hover:bg-accent/30 text-accent border border-accent/40 text-sm font-medium"
                >
                  Enable payments
                </button>
              )}
            </div>

            {status.enabled && status.address && (
              <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-text-dim text-xs mb-1">Wallet address</div>
                  <div className="font-mono text-text break-all">{status.address}</div>
                </div>
                <div>
                  <div className="text-text-dim text-xs mb-1">Fund this wallet</div>
                  {status.chain === 'base-sepolia' ? (
                    <a href={faucetUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                      Circle USDC faucet →
                    </a>
                  ) : (
                    <span className="text-text-dim">Send USDC on Base mainnet</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Setup form */}
        {showSetup && (
          <div className="bg-surface border border-accent/40 rounded-xl p-4 md:p-6 space-y-4">
            <h2 className="text-text font-semibold">Enable x402</h2>

            <div>
              <label className="text-text-dim text-xs block mb-2">Chain</label>
              <div className="flex gap-2">
                {(['base-sepolia', 'base'] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setChain(c)}
                    className={`px-3 py-2 rounded-lg text-xs border ${chain === c ? 'bg-accent/20 text-accent border-accent/40' : 'bg-surface-2 text-text-dim border-border'}`}
                  >
                    {c === 'base-sepolia' ? 'Base Sepolia (testnet)' : 'Base mainnet'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-text-dim text-xs block mb-2">Max payment per call (USD)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={maxPaymentUsd}
                onChange={(e) => setMaxPaymentUsd(Number(e.target.value))}
                className="w-32 px-3 py-2 bg-surface-2 border border-border rounded-lg text-text text-sm"
              />
            </div>

            <div>
              <label className="text-text-dim text-xs block mb-2">Wallet key</label>
              <div className="flex gap-2 mb-2">
                {(['generate', 'paste'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setKeyMode(m)}
                    className={`px-3 py-2 rounded-lg text-xs border ${keyMode === m ? 'bg-accent/20 text-accent border-accent/40' : 'bg-surface-2 text-text-dim border-border'}`}
                  >
                    {m === 'generate' ? 'Generate new' : 'Paste existing'}
                  </button>
                ))}
              </div>
              {keyMode === 'paste' && (
                <input
                  type="password"
                  value={pastedKey}
                  onChange={(e) => setPastedKey(e.target.value)}
                  placeholder="0x…"
                  className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-text text-sm font-mono"
                />
              )}
              {keyMode === 'generate' && (
                <p className="text-text-dim text-xs">Creates a fresh EVM key and stores it at <code>~/.opentradex/config.json</code> (chmod 600). Fund it from the faucet before making paid calls.</p>
              )}
            </div>

            {error && <div className="text-danger text-xs">{error}</div>}

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setShowSetup(false)}
                className="px-4 py-2 rounded-lg bg-surface-2 hover:bg-card-hover text-text-dim text-sm"
              >
                Cancel
              </button>
              <button
                onClick={enablePayments}
                disabled={busy || (keyMode === 'paste' && (!pastedKey.startsWith('0x') || pastedKey.length !== 66))}
                className="px-4 py-2 rounded-lg bg-accent hover:bg-accent/80 text-bg text-sm font-medium disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Enable'}
              </button>
            </div>
          </div>
        )}

        {/* Ledger */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="px-4 md:px-6 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-text font-semibold">Payment ledger</h2>
            <div className="text-text-dim text-xs">
              {totals.count} payments · ${totals.out.toFixed(4)} out
            </div>
          </div>
          {ledger.length === 0 ? (
            <div className="p-8 text-center text-text-dim text-sm">
              No payments recorded yet. The agent will log every 402 settlement here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-2 text-text-dim text-xs">
                  <tr>
                    <th className="text-left px-4 py-2 font-normal">Time</th>
                    <th className="text-left px-4 py-2 font-normal">URL</th>
                    <th className="text-right px-4 py-2 font-normal">Amount</th>
                    <th className="text-left px-4 py-2 font-normal">Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.slice().reverse().map((e, i) => (
                    <tr key={i} className="border-t border-border hover:bg-surface-2/50">
                      <td className="px-4 py-2 text-text-dim whitespace-nowrap">{new Date(e.timestamp).toLocaleString()}</td>
                      <td className="px-4 py-2 text-text font-mono text-xs truncate max-w-[300px]" title={e.url}>{e.url}</td>
                      <td className="px-4 py-2 text-right text-accent font-mono">${e.amountUsd.toFixed(4)}</td>
                      <td className="px-4 py-2 text-text-dim font-mono text-xs">{e.txHash ? `${e.txHash.slice(0, 10)}…` : (e.note || '—')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
