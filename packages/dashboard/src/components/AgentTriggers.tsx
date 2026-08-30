import { useState } from 'react';

interface AgentResult {
  success: boolean;
  reasoning: string;
  agentResponse: string;
  decision: { verdict: string; reason_code: string; reason_text: string } | null;
  error?: string;
}

export default function AgentTriggers() {
  const [loading, setLoading] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<AgentResult | null>(null);
  const [shoppingRequest, setShoppingRequest] = useState('');

  const triggerAgent = async (endpoint: string, label: string, body?: object) => {
    setLoading(label);
    setLastResult(null);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      setLastResult(data);
    } catch (err) {
      setLastResult({ success: false, reasoning: '', agentResponse: '', decision: null, error: (err as Error).message });
    } finally {
      setLoading(null);
    }
  };

  const handleBuyerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shoppingRequest.trim()) return;
    triggerAgent('/api/agents/buyer/shop', 'buyer', { request: shoppingRequest });
  };

  return (
    <div className="space-y-4">
      {/* Growth Agent Triggers */}
      <div className="register">
        <div className="register-header">
          <h2>Growth Agent</h2>
          <p className="font-body text-xs text-ink-muted mt-0.5">Simulate scenarios for cart recovery & upsell</p>
        </div>

        <div className="register-body space-y-2">
          <button
            onClick={() => triggerAgent('/api/agents/growth/cart-recovery', 'cart-recovery')}
            disabled={loading !== null}
            className="relative w-full text-left p-3 rounded border transition-colors disabled:opacity-50"
            style={{ borderColor: 'var(--ledger-line)' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-body text-sm font-medium text-ink">Simulate Abandoned Cart</p>
                <p className="font-body text-xs text-ink-muted mt-0.5">Cart recovery agent</p>
              </div>
              <span className="font-data text-[10px] text-ink-muted px-1.5 py-0.5 rounded border" style={{ borderColor: 'var(--ledger-line)' }}>
                SIMULATED
              </span>
            </div>
            {loading === 'cart-recovery' && (
              <div className="absolute inset-0 flex items-center justify-center rounded" style={{ background: 'rgba(255,255,255,0.85)' }}>
                <span className="font-body text-sm text-signal-indigo animate-pulse">Running agent...</span>
              </div>
            )}
          </button>

          <button
            onClick={() => triggerAgent('/api/agents/growth/upsell', 'upsell')}
            disabled={loading !== null}
            className="relative w-full text-left p-3 rounded border transition-colors disabled:opacity-50"
            style={{ borderColor: 'var(--ledger-line)' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-body text-sm font-medium text-ink">Simulate Completed Order</p>
                <p className="font-body text-xs text-ink-muted mt-0.5">Upsell/cross-sell agent</p>
              </div>
              <span className="font-data text-[10px] text-ink-muted px-1.5 py-0.5 rounded border" style={{ borderColor: 'var(--ledger-line)' }}>
                SIMULATED
              </span>
            </div>
            {loading === 'upsell' && (
              <div className="absolute inset-0 flex items-center justify-center rounded" style={{ background: 'rgba(255,255,255,0.85)' }}>
                <span className="font-body text-sm text-signal-indigo animate-pulse">Running agent...</span>
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Buyer Agent */}
      <div className="register">
        <div className="register-header">
          <h2>AI Buyer Agent</h2>
          <p className="font-body text-xs text-ink-muted mt-0.5">External AI agent shopping on behalf of a customer</p>
        </div>

        <form onSubmit={handleBuyerSubmit} className="register-body">
          <label className="block font-body text-[11px] font-medium text-ink-muted uppercase tracking-wider mb-1.5">
            Ask the AI buyer to shop for you
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={shoppingRequest}
              onChange={(e) => setShoppingRequest(e.target.value)}
              placeholder="e.g. Find me a birthday gift under ₹1,500"
              className="flex-1 px-3 py-2 border rounded text-sm font-body text-ink"
              style={{ borderColor: 'var(--ledger-line)' }}
              disabled={loading !== null}
            />
            <button
              type="submit"
              disabled={loading !== null || !shoppingRequest.trim()}
              className="btn-primary px-4 py-2"
            >
              {loading === 'buyer' ? 'Shopping...' : 'Shop'}
            </button>
          </div>
          <p className="font-body text-[10px] text-ink-muted mt-1.5">This simulates an external AI agent transacting with the merchant</p>
        </form>
      </div>

      {/* Result display */}
      {lastResult && (
        <div className="register p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className={`seal ${
              lastResult.success && lastResult.decision?.verdict === 'approved'
                ? 'seal-approved'
                : lastResult.success && lastResult.decision?.verdict === 'denied'
                ? 'seal-denied'
                : 'seal-error'
            }`} style={{ width: 22, height: 22, fontSize: 11 }}>
              {lastResult.success
                ? lastResult.decision?.verdict === 'approved' ? '✓' : '✗'
                : '!'}
            </div>
            <span className={`font-body text-sm font-semibold ${
              lastResult.success && lastResult.decision?.verdict === 'approved'
                ? 'text-seal-green'
                : lastResult.success && lastResult.decision?.verdict === 'denied'
                ? 'text-seal-red'
                : 'text-ink-muted'
            }`}>
              {lastResult.success
                ? lastResult.decision?.verdict === 'approved' ? 'APPROVED' : 'DENIED'
                : 'ERROR'}
            </span>
          </div>
          {lastResult.decision && (
            <p className="font-body text-xs text-ink-muted mb-2">
              <span className="font-data text-[10px] px-1.5 py-0.5 rounded border mr-1" style={{ borderColor: 'var(--ledger-line)' }}>
                {lastResult.decision.reason_code}
              </span>
              {lastResult.decision.reason_text}
            </p>
          )}
          {lastResult.agentResponse && (
            <div className="font-body text-xs text-ink whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
              {lastResult.agentResponse}
            </div>
          )}
          {!lastResult.success && lastResult.error && (
            <p className="font-body text-xs text-seal-red">{lastResult.error}</p>
          )}
        </div>
      )}
    </div>
  );
}
