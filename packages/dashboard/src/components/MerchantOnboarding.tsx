import { useState, useEffect } from 'react';

interface OnboardingStatus {
  catalog_connected: boolean;
  catalog_item_count: number;
  agent_commerce_enabled: boolean;
}

export default function MerchantOnboarding() {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [source, setSource] = useState('shopify');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);

  const fetchStatus = async () => {
    const res = await fetch('/api/onboarding/status');
    const data = await res.json();
    setStatus(data);
  };

  useEffect(() => { fetchStatus(); }, []);

  const handleImport = async () => {
    setImporting(true);
    setImportResult(null);
    try {
      const res = await fetch('/api/onboarding/import-catalog', { method: 'POST' });
      const data = await res.json();
      if (data.was_already_connected) {
        setImportResult(`Catalog already connected (${data.items_imported} items)`);
      } else {
        setImportResult(`Imported ${data.items_imported} items from ${source === 'shopify' ? 'Shopify' : source === 'woocommerce' ? 'WooCommerce' : 'CSV'}`);
      }
      fetchStatus();
    } catch {
      setImportResult('Import failed');
    }
    setImporting(false);
  };

  const handleToggle = async () => {
    if (!status) return;
    setToggling(true);
    try {
      const res = await fetch('/api/onboarding/toggle', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_commerce_enabled: !status.agent_commerce_enabled }),
      });
      const data = await res.json();
      setStatus(prev => prev ? { ...prev, agent_commerce_enabled: data.agent_commerce_enabled } : prev);
    } catch { /* ignore */ }
    setToggling(false);
  };

  if (!status) return null;

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Merchant Setup</h2>
        <p className="text-xs text-gray-500 mt-0.5">Zero-code onboarding — connect an existing catalog, flip one toggle</p>
      </div>

      <div className="p-4 space-y-4">
        {/* Step 1: Connect Catalog */}
        <div className={`p-3 rounded-lg border ${status.catalog_connected ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${status.catalog_connected ? 'bg-green-500 text-white' : 'bg-gray-300 text-white'}`}>
              {status.catalog_connected ? '✓' : '1'}
            </span>
            <span className="text-sm font-medium text-gray-900">Connect Catalog Source</span>
            {status.catalog_connected && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">
                {status.catalog_item_count} ITEMS
              </span>
            )}
          </div>

          {!status.catalog_connected ? (
            <div className="space-y-2 ml-7">
              <select
                value={source}
                onChange={e => setSource(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 bg-white"
              >
                <option value="shopify">Shopify</option>
                <option value="woocommerce">WooCommerce</option>
                <option value="csv">Custom CSV Upload</option>
              </select>
              <button
                onClick={handleImport}
                disabled={importing}
                className="w-full px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {importing ? 'Connecting...' : `Connect ${source === 'shopify' ? 'Shopify' : source === 'woocommerce' ? 'WooCommerce' : 'CSV'}`}
              </button>
            </div>
          ) : (
            <p className="text-xs text-green-700 ml-7">
              Catalog synced — {status.catalog_item_count} products across all categories
            </p>
          )}

          {importResult && (
            <p className="text-xs text-indigo-600 mt-1.5 ml-7 font-medium">{importResult}</p>
          )}
        </div>

        {/* Step 2: Enable AI Agent Commerce */}
        <div className={`p-3 rounded-lg border ${status.agent_commerce_enabled ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${status.agent_commerce_enabled ? 'bg-green-500 text-white' : 'bg-amber-400 text-white'}`}>
                {status.agent_commerce_enabled ? '✓' : '2'}
              </span>
              <div>
                <span className="text-sm font-medium text-gray-900">Enable AI Agent Transactability</span>
                <p className="text-[10px] text-gray-500">
                  {status.agent_commerce_enabled
                    ? 'AI agents can discover and transact with this merchant'
                    : 'AI agent proposals will be denied with MERCHANT_NOT_OPTED_IN'}
                </p>
              </div>
            </div>
            <button
              onClick={handleToggle}
              disabled={toggling}
              className={`relative w-11 h-6 rounded-full transition-colors ${status.agent_commerce_enabled ? 'bg-green-500' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${status.agent_commerce_enabled ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>
        </div>

        {/* Simulation notice */}
        <div className="text-[10px] text-gray-400 leading-relaxed border-t border-gray-100 pt-3">
          <span className="font-medium text-gray-500">Simulated for demo</span> — a production version would use the platform's existing Shopify/WooCommerce app OAuth flow, the same pattern GoKwik and other commerce-enablement platforms already use. Zero custom code on the merchant side.
        </div>
      </div>
    </div>
  );
}
