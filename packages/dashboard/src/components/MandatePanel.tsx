import { useState, useEffect } from 'react';

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
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      setAllCategories(data.categories);
      setForm(prev => prev.categories.length === 0 ? { ...prev, categories: data.categories } : prev);
    } catch { /* ignore */ }
  };

  const fetchMandates = async () => {
    try {
      const res = await fetch('/api/mandates');
      const data = await res.json();
      setMandates(data.mandates);
    } catch { /* ignore */ }
  };

  const issueMandate = async () => {
    setSubmitting(true);
    try {
      await fetch('/api/mandates', {
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
    await fetch(`/api/mandates/${id}/revoke`, { method: 'POST' });
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
    <div className="bg-white rounded-lg shadow border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Mandates</h2>
          <p className="text-xs text-gray-500 mt-0.5">Human-issued, scoped, revocable agent authorizations</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded hover:bg-indigo-700 transition-colors"
        >
          {showForm ? 'Cancel' : 'Issue Mandate'}
        </button>
      </div>

      {showForm && (
        <div className="p-4 bg-indigo-50 border-b border-indigo-200">
          <p className="text-xs font-medium text-indigo-900 mb-3">
            Authorize an agent to spend on your behalf (AP2/UAP-style delegation)
          </p>
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-[10px] text-gray-600 uppercase mb-0.5">Agent</label>
                <select
                  value={form.agent_id}
                  onChange={e => setForm({ ...form, agent_id: e.target.value })}
                  className="w-full px-2 py-1.5 border border-indigo-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="buyer">Buyer Agent</option>
                  <option value="growth">Growth Agent</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-[10px] text-gray-600 uppercase mb-0.5">Max Amount (₹)</label>
                <input
                  type="number"
                  value={form.scope_max_rupees}
                  onChange={e => setForm({ ...form, scope_max_rupees: e.target.value })}
                  className="w-full px-2 py-1.5 border border-indigo-300 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  min="1"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] text-gray-600 uppercase mb-0.5">Expiry (min)</label>
                <input
                  type="number"
                  value={form.expiry_minutes}
                  onChange={e => setForm({ ...form, expiry_minutes: e.target.value })}
                  className="w-full px-2 py-1.5 border border-indigo-300 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  min="1"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-gray-600 uppercase mb-1">Allowed Categories</label>
              <div className="flex flex-wrap gap-1.5">
                {allCategories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                      form.categories.includes(cat)
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={issueMandate}
              disabled={submitting || form.categories.length === 0}
              className="w-full px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Issuing...' : `Issue Mandate to ${form.agent_id} agent`}
            </button>
            <p className="text-[10px] text-indigo-500">
              consent_method: dashboard_click (not a cryptographic signature — honest demo simplification)
            </p>
          </div>
        </div>
      )}

      <div className="p-4 space-y-3">
        {activeMandates.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-2">No active mandates. Issue one to enable agents.</p>
        )}

        {activeMandates.map(m => (
          <div key={m.id} className="p-2.5 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-600 text-white font-medium">ACTIVE</span>
                <span className="text-xs font-medium text-gray-900">{m.agent_id}</span>
              </div>
              <button
                onClick={() => revokeMandate(m.id)}
                className="px-2 py-0.5 text-[10px] bg-red-100 text-red-700 border border-red-200 rounded hover:bg-red-200 transition-colors"
              >
                Revoke
              </button>
            </div>
            <div className="text-[10px] text-gray-600 space-y-0.5">
              <p>Scope: ₹{(m.scope_max_amount_paise / 100).toLocaleString('en-IN')} max | [{m.scope_categories.join(', ')}]</p>
              <p>Expires: {new Date(m.expires_at).toLocaleString('en-IN')} | By: {m.issued_by} ({m.consent_method})</p>
              <p className="font-mono text-[9px] text-gray-400">{m.id}</p>
            </div>
          </div>
        ))}

        {inactiveMandates.length > 0 && (
          <details className="text-xs">
            <summary className="text-gray-400 cursor-pointer hover:text-gray-600">
              {inactiveMandates.length} expired/revoked mandate{inactiveMandates.length > 1 ? 's' : ''}
            </summary>
            <div className="mt-2 space-y-1.5">
              {inactiveMandates.slice(0, 5).map(m => (
                <div key={m.id} className="p-2 bg-gray-50 border border-gray-200 rounded text-[10px] text-gray-500">
                  <span className="font-medium">{m.agent_id}</span> — {m.revoked ? 'REVOKED' : 'EXPIRED'} — ₹{(m.scope_max_amount_paise / 100).toFixed(0)} max
                  <span className="font-mono ml-1">({m.id})</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
