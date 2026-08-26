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

interface EditState {
  max_per_transaction: string;
  max_daily_velocity: string;
  max_daily_txn_count: string;
  discount_ceiling_pct: string;
  mandate_expiry_minutes: string;
}

export default function PolicyPanel() {
  const [policy, setPolicy] = useState<PolicyConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState<EditState>({
    max_per_transaction: '',
    max_daily_velocity: '',
    max_daily_txn_count: '',
    discount_ceiling_pct: '',
    mandate_expiry_minutes: '',
  });
  const [successField, setSuccessField] = useState<string | null>(null);

  useEffect(() => {
    fetchPolicy();
  }, []);

  const fetchPolicy = async () => {
    try {
      const res = await fetch('/api/policy');
      const data = await res.json();
      setPolicy(data);
      setEdit({
        max_per_transaction: String(data.max_per_transaction_paise / 100),
        max_daily_velocity: String(data.max_daily_velocity_paise / 100),
        max_daily_txn_count: String(data.max_daily_txn_count),
        discount_ceiling_pct: String(data.discount_ceiling_pct),
        mandate_expiry_minutes: String(data.mandate_expiry_minutes),
      });
    } catch { /* ignore */ }
  };

  const updateField = async (field: string, patchBody: Record<string, number>) => {
    setSaving(true);
    try {
      const res = await fetch('/api/policy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchBody),
      });
      const data = await res.json();
      setPolicy(data);
      setEdit({
        max_per_transaction: String(data.max_per_transaction_paise / 100),
        max_daily_velocity: String(data.max_daily_velocity_paise / 100),
        max_daily_txn_count: String(data.max_daily_txn_count),
        discount_ceiling_pct: String(data.discount_ceiling_pct),
        mandate_expiry_minutes: String(data.mandate_expiry_minutes),
      });
      setSuccessField(field);
      setTimeout(() => setSuccessField(null), 2000);
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleUpdate = (field: string) => {
    switch (field) {
      case 'max_per_transaction': {
        const v = parseInt(edit.max_per_transaction);
        if (isNaN(v) || v < 0) return;
        updateField(field, { max_per_transaction_paise: v * 100 });
        break;
      }
      case 'max_daily_velocity': {
        const v = parseInt(edit.max_daily_velocity);
        if (isNaN(v) || v < 0) return;
        updateField(field, { max_daily_velocity_paise: v * 100 });
        break;
      }
      case 'max_daily_txn_count': {
        const v = parseInt(edit.max_daily_txn_count);
        if (isNaN(v) || v < 0) return;
        updateField(field, { max_daily_txn_count: v });
        break;
      }
      case 'discount_ceiling_pct': {
        const v = parseInt(edit.discount_ceiling_pct);
        if (isNaN(v) || v < 0 || v > 100) return;
        updateField(field, { discount_ceiling_pct: v });
        break;
      }
      case 'mandate_expiry_minutes': {
        const v = parseInt(edit.mandate_expiry_minutes);
        if (isNaN(v) || v < 0) return;
        updateField(field, { mandate_expiry_minutes: v });
        break;
      }
    }
  };

  if (!policy) return <div className="bg-white rounded-lg shadow border border-gray-200 p-4 animate-pulse">Loading policy...</div>;

  const fields: { key: keyof EditState; label: string; prefix?: string; suffix?: string; highlight?: boolean }[] = [
    { key: 'max_per_transaction', label: 'Per-Transaction Cap', prefix: '₹', highlight: true },
    { key: 'max_daily_velocity', label: 'Daily Velocity Cap', prefix: '₹' },
    { key: 'max_daily_txn_count', label: 'Daily Txn Limit' },
    { key: 'discount_ceiling_pct', label: 'Discount Ceiling', suffix: '%' },
    { key: 'mandate_expiry_minutes', label: 'Mandate Expiry', suffix: 'min' },
  ];

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Policy Controls</h2>
        <p className="text-xs text-gray-500 mt-0.5">Live-editable merchant policy — changes take effect immediately</p>
      </div>

      <div className="p-4 space-y-3">
        {fields.map(({ key, label, prefix, suffix, highlight }) => (
          <div
            key={key}
            className={`p-3 rounded-lg border ${
              highlight ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
            }`}
          >
            <label className={`block text-xs font-medium mb-1 ${
              highlight ? 'text-blue-900' : 'text-gray-700'
            }`}>
              {label}
            </label>
            <div className="flex items-center gap-2">
              {prefix && <span className={`text-sm ${highlight ? 'text-blue-700' : 'text-gray-500'}`}>{prefix}</span>}
              <input
                type="number"
                value={edit[key]}
                onChange={(e) => setEdit({ ...edit, [key]: e.target.value })}
                className={`w-24 px-2 py-1 border rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  highlight ? 'border-blue-300' : 'border-gray-300'
                }`}
                min="0"
              />
              {suffix && <span className="text-sm text-gray-500">{suffix}</span>}
              <button
                onClick={() => handleUpdate(key)}
                disabled={saving}
                className="px-2.5 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? '...' : 'Save'}
              </button>
              {successField === key && (
                <span className="text-xs text-green-600 font-medium">Updated!</span>
              )}
            </div>
            {highlight && (
              <p className="text-xs text-blue-600 mt-1">
                Lower this below a product price, then run the buyer agent to demo a graceful denial
              </p>
            )}
          </div>
        ))}

        {/* Allowed categories */}
        <div className="pt-2">
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
