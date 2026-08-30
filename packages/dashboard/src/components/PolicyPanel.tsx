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

  if (!policy) return <div className="register p-4 animate-pulse font-body text-sm text-ink-muted">Loading policy...</div>;

  const fields: { key: keyof EditState; label: string; prefix?: string; suffix?: string; hint?: string }[] = [
    { key: 'max_per_transaction', label: 'Per-Transaction Cap', prefix: '₹', hint: 'Lower this below a product price, then run the buyer agent to demo a graceful denial' },
    { key: 'max_daily_velocity', label: 'Daily Velocity Cap', prefix: '₹' },
    { key: 'max_daily_txn_count', label: 'Daily Txn Limit' },
    { key: 'discount_ceiling_pct', label: 'Discount Ceiling', suffix: '%' },
    { key: 'mandate_expiry_minutes', label: 'Mandate Expiry', suffix: 'min' },
  ];

  return (
    <div className="register">
      <div className="register-header">
        <h2>Policy Controls</h2>
        <p className="font-body text-xs text-ink-muted mt-0.5">Live-editable — changes take effect immediately</p>
      </div>

      <div className="register-body space-y-3">
        {fields.map(({ key, label, prefix, suffix, hint }) => (
          <div key={key} className="py-2">
            <label className="block font-body text-[11px] font-medium text-ink-muted uppercase tracking-wider mb-1.5">
              {label}
            </label>
            <div className="flex items-center gap-2">
              {prefix && <span className="font-data text-sm text-ink-muted">{prefix}</span>}
              <input
                type="number"
                value={edit[key]}
                onChange={(e) => setEdit({ ...edit, [key]: e.target.value })}
                className="w-24 px-2 py-1.5 border rounded text-sm font-data text-ink"
                style={{ borderColor: 'var(--ledger-line)' }}
                min="0"
              />
              {suffix && <span className="font-body text-xs text-ink-muted">{suffix}</span>}
              <button
                onClick={() => handleUpdate(key)}
                disabled={saving}
                className="btn-primary text-xs px-2.5 py-1"
              >
                {saving ? '...' : 'Save'}
              </button>
              {successField === key && (
                <span className="font-body text-xs text-seal-green font-medium">Updated</span>
              )}
            </div>
            {hint && (
              <p className="font-body text-[11px] text-ink-muted mt-1 leading-relaxed">{hint}</p>
            )}
          </div>
        ))}

        {/* Allowed categories */}
        <div className="pt-2 border-t" style={{ borderColor: 'var(--ledger-line)' }}>
          <p className="font-body text-[10px] text-ink-muted uppercase tracking-wider mb-1.5">Allowed Categories</p>
          <div className="flex flex-wrap gap-1">
            {policy.category_allowlist.length === 0 ? (
              <span className="font-body text-xs px-2 py-0.5 rounded border text-seal-green" style={{ borderColor: 'var(--seal-green)', background: 'rgba(31,111,74,0.04)' }}>
                All categories
              </span>
            ) : (
              policy.category_allowlist.map((cat) => (
                <span key={cat} className="font-body text-xs px-2 py-0.5 rounded border text-ink-muted" style={{ borderColor: 'var(--ledger-line)' }}>
                  {cat}
                </span>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
