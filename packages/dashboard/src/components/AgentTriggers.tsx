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

  const triggerAgent = async (endpoint: string, label: string) => {
    setLoading(label);
    setLastResult(null);
    try {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const data = await res.json();
      setLastResult(data);
    } catch (err) {
      setLastResult({ success: false, reasoning: '', agentResponse: '', decision: null, error: (err as Error).message });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Agent Triggers</h2>
        <p className="text-xs text-gray-500 mt-0.5">Simulate scenarios to trigger the Growth Agent</p>
      </div>

      <div className="p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => triggerAgent('/api/agents/growth/cart-recovery', 'cart-recovery')}
            disabled={loading !== null}
            className="relative px-4 py-3 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors text-left disabled:opacity-50"
          >
            <div className="flex items-center gap-2">
              <span className="text-orange-600 text-lg">🛒</span>
              <div>
                <p className="text-sm font-medium text-orange-900">Simulate Abandoned Cart</p>
                <p className="text-xs text-orange-600">Triggers cart recovery agent</p>
              </div>
            </div>
            {loading === 'cart-recovery' && (
              <div className="absolute inset-0 flex items-center justify-center bg-orange-50/80 rounded-lg">
                <span className="text-sm text-orange-700 animate-pulse">Running agent...</span>
              </div>
            )}
            <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
              SIMULATED
            </span>
          </button>

          <button
            onClick={() => triggerAgent('/api/agents/growth/upsell', 'upsell')}
            disabled={loading !== null}
            className="relative px-4 py-3 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors text-left disabled:opacity-50"
          >
            <div className="flex items-center gap-2">
              <span className="text-purple-600 text-lg">📈</span>
              <div>
                <p className="text-sm font-medium text-purple-900">Simulate Completed Order</p>
                <p className="text-xs text-purple-600">Triggers upsell/cross-sell agent</p>
              </div>
            </div>
            {loading === 'upsell' && (
              <div className="absolute inset-0 flex items-center justify-center bg-purple-50/80 rounded-lg">
                <span className="text-sm text-purple-700 animate-pulse">Running agent...</span>
              </div>
            )}
            <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
              SIMULATED
            </span>
          </button>
        </div>

        {lastResult && (
          <div className={`mt-3 p-3 rounded-lg border text-sm ${
            lastResult.success && lastResult.decision?.verdict === 'approved'
              ? 'bg-green-50 border-green-200'
              : lastResult.success && lastResult.decision?.verdict === 'denied'
              ? 'bg-red-50 border-red-200'
              : 'bg-yellow-50 border-yellow-200'
          }`}>
            <p className="font-medium mb-1">
              {lastResult.success
                ? `Agent ${lastResult.decision?.verdict === 'approved' ? '✓ Proposal Approved' : '✗ Proposal Denied'}`
                : `Error: ${lastResult.error}`}
            </p>
            {lastResult.agentResponse && (
              <p className="text-gray-700 text-xs whitespace-pre-wrap">{lastResult.agentResponse}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
