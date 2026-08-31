import { useState, useEffect } from 'react';
import { useMerchant } from '../MerchantContext';

interface Mandate {
  id: string;
  agent_id: string;
  granted_at: string;
  expires_at: string;
  revoked: number;
  scope_max_amount_paise: number;
  scope_categories: string[];
  issued_by: string;
  consent_method: string;
  is_active: boolean;
}

export default function MandatePanel() {
  const { apiUrl, merchantId } = useMerchant();
  const [mandates, setMandates] = useState<Mandate[]>([]);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    agent_id: 'buyer',
    scope_max_rupees: '3000',
    expiry_minutes: '60',
    categories: [] as string[],
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchMandates();
    fetchCategories();
  }, [merchantId]);

  const fetchCategories = async () => {
    try {
      const res = await fetch(apiUrl('/api/categories'));
      const data = await res.json();
      setAllCategories(data.categories);
      setForm(prev => prev.categories.length === 0 ? { ...prev, categories: data.categories } : prev);
    } catch { /* ignore */ }
  };

  const fetchMandates = async () => {
    try {
      const res = await fetch(apiUrl('/api/mandates'));
      const data = await res.json();
      setMandates(data.mandates);
    } catch { /* ignore */ }
  };

  const issueMandate = async () => {
    setSubmitting(true);
    try {
      await fetch(apiUrl('/api/mandates'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: form.agent_id,
          scope_max_amount_paise: parseInt(form.scope_max_rupees) * 100,
          scope_categories: form.categories,
          expiry_minutes: parseInt(form.expiry_minutes),
          issued_by: 'merchant_owner',
        }),
      });
      await fetchMandates();
      setShowForm(false);
    } catch { /* ignore */ }
    setSubmitting(false);
  };

  const revokeMandate = async (id: string) => {
    await fetch(apiUrl(`/api/mandates/${id}/revoke`), { method: 'POST' });
    await fetchMandates();
  };

  const toggleCategory = (cat: string) => {
    setForm(prev => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter(c => c !== cat)
        : [...prev.categories, cat],
    }));
  };

  const activeMandates = mandates.filter(m => m.is_active);
  const inactiveMandates = mandates.filter(m => !m.is_active);

  return (
    <div className="register">
      <div className="register-header flex items-center justify-between">
        <div>
          <h2>Mandates</h2>
          <p className="font-body text-xs text-ink-muted mt-0.5">Human-issued, scoped, revocable agent authorizations</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary"
        >
          {showForm ? 'Cancel' : 'Issue Mandate'}
        </button>
      </div>

      {showForm && (
        <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--ledger-line)', background: 'rgba(47,58,143,0.03)' }}>
          <p className="font-body text-xs font-medium text-ink mb-3">
            Authorize an agent to spend on your behalf (AP2/UAP-style delegation)
          </p>
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block font-body text-[10px] text-ink-muted uppercase mb-1">Agent</label>
                <select
                  value={form.agent_id}
                  onChange={e => setForm({ ...form, agent_id: e.target.value })}
                  className="w-full px-2 py-1.5 border rounded text-sm font-body"
                  style={{ borderColor: 'var(--ledger-line)' }}
                >
                  <option value="buyer">Buyer Agent</option>
                  <option value="growth">Growth Agent</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block font-body text-[10px] text-ink-muted uppercase mb-1">Max Amount (₹)</label>
                <input
                  type="number"
                  value={form.scope_max_rupees}
                  onChange={e => setForm({ ...form, scope_max_rupees: e.target.value })}
                  className="w-full px-2 py-1.5 border rounded text-sm font-data"
                  style={{ borderColor: 'var(--ledger-line)' }}
                  min="1"
                />
              </div>
              <div className="flex-1">
                <label className="block font-body text-[10px] text-ink-muted uppercase mb-1">Expiry (min)</label>
                <input
                  type="number"
                  value={form.expiry_minutes}
                  onChange={e => setForm({ ...form, expiry_minutes: e.target.value })}
                  className="w-full px-2 py-1.5 border rounded text-sm font-data"
                  style={{ borderColor: 'var(--ledger-line)' }}
                  min="1"
                />
              </div>
            </div>

            <div>
              <label className="block font-body text-[10px] text-ink-muted uppercase mb-1">Allowed Categories</label>
              <div className="flex flex-wrap gap-1.5">
                {allCategories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className="font-body text-xs px-2 py-0.5 rounded border transition-colors"
                    style={{
                      borderColor: form.categories.includes(cat) ? 'var(--signal-indigo)' : 'var(--ledger-line)',
                      background: form.categories.includes(cat) ? 'var(--signal-indigo)' : 'transparent',
                      color: form.categories.includes(cat) ? '#fff' : 'var(--ink-muted)',
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={issueMandate}
              disabled={submitting || form.categories.length === 0}
              className="btn-primary w-full"
            >
              {submitting ? 'Issuing...' : `Issue Mandate to ${form.agent_id} agent`}
            </button>
            <p className="font-data text-[10px] text-ink-muted">
              consent_method: dashboard_click
            </p>
          </div>
        </div>
      )}

      <div className="register-body space-y-3">
        {activeMandates.length === 0 && (
          <p className="font-body text-xs text-ink-muted text-center py-2">No active mandates. Issue one to enable agents.</p>
        )}

        {activeMandates.map(m => (
          <div key={m.id} className="p-3 rounded border" style={{ borderColor: 'var(--seal-green)', background: 'rgba(31,111,74,0.04)' }}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className="seal seal-approved" style={{ width: 18, height: 18, fontSize: 9 }}>✓</div>
                <span className="font-body text-xs font-semibold text-ink">{m.agent_id}</span>
                <span className="font-body text-[10px] text-seal-green font-medium">ACTIVE</span>
              </div>
              <button
                onClick={() => revokeMandate(m.id)}
                className="font-body text-[10px] font-medium px-2 py-0.5 rounded border transition-colors"
                style={{ borderColor: 'var(--seal-red)', color: 'var(--seal-red)' }}
              >
                Revoke
              </button>
            </div>
            <div className="font-body text-[11px] text-ink-muted space-y-0.5">
              <p>Scope: <span className="font-data">₹{(m.scope_max_amount_paise / 100).toLocaleString('en-IN')}</span> max · [{m.scope_categories.join(', ')}]</p>
              <p>Expires: <span className="font-data">{new Date(m.expires_at).toLocaleString('en-IN')}</span> · By: {m.issued_by} ({m.consent_method})</p>
              <p className="font-data text-[10px] text-ink-muted">{m.id}</p>
            </div>
          </div>
        ))}

        {inactiveMandates.length > 0 && (
          <details className="font-body text-xs">
            <summary className="text-ink-muted cursor-pointer hover:text-ink transition-colors">
              {inactiveMandates.length} expired/revoked mandate{inactiveMandates.length > 1 ? 's' : ''}
            </summary>
            <div className="mt-2 space-y-1.5">
              {inactiveMandates.slice(0, 5).map(m => (
                <div key={m.id} className="p-2 rounded border text-[11px] text-ink-muted" style={{ borderColor: 'var(--ledger-line)' }}>
                  <span className="font-medium text-ink">{m.agent_id}</span> — {m.revoked ? 'REVOKED' : 'EXPIRED'} — <span className="font-data">₹{(m.scope_max_amount_paise / 100).toFixed(0)}</span> max
                  <span className="font-data text-[10px] ml-1">({m.id})</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
