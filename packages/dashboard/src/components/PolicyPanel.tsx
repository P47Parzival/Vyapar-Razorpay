import { useState, useEffect } from 'react';

interface PolicyConfig {
  merchant_id: string;
  max_per_transaction_paise: number;
  max_daily_velocity_paise: number;
  max_daily_txn_count: number;
  discount_ceiling_pct: number;
  mandate_expiry_minutes: number;
  category_allowlist: string[];
}

export default function PolicyPanel() {
  const [policy, setPolicy] = useState<PolicyConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingCap, setEditingCap] = useState<string>('');
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    fetchPolicy();
  }, []);

  const fetchPolicy = async () => {
    try {
      const res = await fetch('/api/policy');
      const data = await res.json();
      setPolicy(data);
      setEditingCap(String(data.max_per_transaction_paise / 100));
    } catch { /* ignore */ }
  };

  const updateCap = async () => {
    const newCapRupees = parseInt(editingCap);
    if (isNaN(newCapRupees) || newCapRupees < 0) return;

    setSaving(true);
    try {
      const res = await fetch('/api/policy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ max_per_transaction_paise: newCapRupees * 100 }),
      });
      const data = await res.json();
      setPolicy(data);
      setEditingCap(String(data.max_per_transaction_paise / 100));
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch { /* ignore */ }
    setSaving(false);
  };

  if (!policy) return <div className="bg-white rounded-lg shadow border border-gray-200 p-4 animate-pulse">Loading policy...</div>;

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Policy Controls</h2>
        <p className="text-xs text-gray-500 mt-0.5">Live-editable merchant policy — changes take effect immediately</p>
      </div>

      <div className="p-4 space-y-4">
        {/* Per-transaction cap — the key demo control */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <label className="block text-sm font-medium text-blue-900 mb-1">
            Per-Transaction Cap
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-blue-700">₹</span>
            <input
              type="number"
              value={editingCap}
              onChange={(e) => setEditingCap(e.target.value)}
              className="w-28 px-2 py-1.5 border border-blue-300 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="0"
              step="100"
            />
            <button
              onClick={updateCap}
              disabled={saving}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Update'}
            </button>
            {showSuccess && (
              <span className="text-xs text-green-600 font-medium">Updated!</span>
            )}
          </div>
          <p className="text-xs text-blue-600 mt-1">
            Lower this below a product price, then run the buyer agent to demo a graceful denial
          </p>
        </div>

        {/* Other policy values (read-only display for now) */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-2 bg-gray-50 rounded border border-gray-200">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Daily Velocity Cap</p>
            <p className="text-sm font-mono font-medium text-gray-900">₹{(policy.max_daily_velocity_paise / 100).toLocaleString('en-IN')}</p>
          </div>
          <div className="p-2 bg-gray-50 rounded border border-gray-200">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Daily Txn Limit</p>
            <p className="text-sm font-mono font-medium text-gray-900">{policy.max_daily_txn_count}</p>
          </div>
          <div className="p-2 bg-gray-50 rounded border border-gray-200">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Discount Ceiling</p>
            <p className="text-sm font-mono font-medium text-gray-900">{policy.discount_ceiling_pct}%</p>
          </div>
          <div className="p-2 bg-gray-50 rounded border border-gray-200">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Mandate Expiry</p>
            <p className="text-sm font-mono font-medium text-gray-900">{policy.mandate_expiry_minutes} min</p>
          </div>
        </div>

        {/* Allowed categories */}
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Allowed Categories</p>
          <div className="flex flex-wrap gap-1">
            {policy.category_allowlist.map((cat) => (
              <span key={cat} className="text-xs px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded">
                {cat}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
