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
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Growth Agent</h2>
          <p className="text-xs text-gray-500 mt-0.5">Simulate scenarios for cart recovery & upsell</p>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={() => triggerAgent('/api/agents/growth/cart-recovery', 'cart-recovery')}
              disabled={loading !== null}
              className="relative px-4 py-3 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors text-left disabled:opacity-50"
            >
              <div className="flex items-center gap-2">
                <span className="text-orange-600 text-lg">🛒</span>
                <div>
                  <p className="text-sm font-medium text-orange-900">Simulate Abandoned Cart</p>
                  <p className="text-xs text-orange-600">Cart recovery agent</p>
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
                  <p className="text-xs text-purple-600">Upsell/cross-sell agent</p>
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
        </div>
      </div>

      {/* Buyer Agent */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">AI Buyer Agent</h2>
          <p className="text-xs text-gray-500 mt-0.5">External AI agent shopping on behalf of a customer</p>
        </div>

        <form onSubmit={handleBuyerSubmit} className="p-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ask the AI buyer to shop for you
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={shoppingRequest}
              onChange={(e) => setShoppingRequest(e.target.value)}
              placeholder="e.g. Find me a birthday gift under ₹1,500"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading !== null}
            />
            <button
              type="submit"
              disabled={loading !== null || !shoppingRequest.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading === 'buyer' ? 'Shopping...' : 'Shop'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">This simulates an external AI agent transacting with the merchant</p>
        </form>
      </div>

      {/* Result display */}
      {lastResult && (
        <div className={`bg-white rounded-lg shadow border p-4 text-sm ${
          lastResult.success && lastResult.decision?.verdict === 'approved'
            ? 'border-green-200'
            : lastResult.success && lastResult.decision?.verdict === 'denied'
            ? 'border-red-200'
            : 'border-yellow-200'
        }`}>
          <div className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-2 ${
            lastResult.success && lastResult.decision?.verdict === 'approved'
              ? 'bg-green-100 text-green-800'
              : lastResult.success && lastResult.decision?.verdict === 'denied'
              ? 'bg-red-100 text-red-800'
              : 'bg-yellow-100 text-yellow-800'
          }`}>
            {lastResult.success
              ? lastResult.decision?.verdict === 'approved' ? '✓ APPROVED' : '✗ DENIED'
              : 'ERROR'}
          </div>
          {lastResult.decision && (
            <p className="text-xs text-gray-500 mb-2">
              <code className="bg-gray-100 px-1 py-0.5 rounded">{lastResult.decision.reason_code}</code>
              {' — '}{lastResult.decision.reason_text}
            </p>
          )}
          {lastResult.agentResponse && (
            <div className="text-gray-700 text-xs whitespace-pre-wrap max-h-48 overflow-y-auto">
              {lastResult.agentResponse}
            </div>
          )}
          {!lastResult.success && lastResult.error && (
            <p className="text-red-600 text-xs">{lastResult.error}</p>
          )}
        </div>
      )}
    </div>
  );
}
