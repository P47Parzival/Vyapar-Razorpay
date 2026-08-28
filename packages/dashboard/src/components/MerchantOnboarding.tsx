import { useState, useEffect } from 'react';

interface ShopifyConnection {
  id: string;
  shop_domain: string;
  connected_at: string;
  last_synced_at: string | null;
  product_count: number;
  status: string;
}

interface OnboardingStatus {
  catalog_connected: boolean;
  catalog_item_count: number;
  shopify_item_count: number;
  agent_commerce_enabled: boolean;
  connections: ShopifyConnection[];
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function MerchantOnboarding() {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [source, setSource] = useState('shopify_real');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [shopDomain, setShopDomain] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [shopError, setShopError] = useState<string | null>(null);

  const fetchStatus = async () => {
    const res = await fetch('/api/onboarding/status');
    const data = await res.json();
    setStatus(data);
  };

  useEffect(() => { fetchStatus(); }, []);

  const handleSimulatedImport = async () => {
    setImporting(true);
    setImportResult(null);
    try {
      const res = await fetch('/api/onboarding/import-catalog', { method: 'POST' });
      const data = await res.json();
      if (data.was_already_connected) {
        setImportResult(`Demo catalog already loaded (${data.items_imported} items)`);
      } else {
        setImportResult(`Imported ${data.items_imported} demo items`);
      }
      fetchStatus();
    } catch {
      setImportResult('Import failed');
    }
    setImporting(false);
  };

  const handleShopifyConnect = async () => {
    setImporting(true);
    setShopError(null);
    setImportResult(null);
    try {
      if (!shopDomain.endsWith('.myshopify.com')) {
        setShopError('Domain must end in .myshopify.com');
        setImporting(false);
        return;
      }
      if (!clientId.trim() || !clientSecret.trim()) {
        setShopError('Both Client ID and Client Secret are required');
        setImporting(false);
        return;
      }

      const res = await fetch('/api/onboarding/connect-shopify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_domain: shopDomain, client_id: clientId, client_secret: clientSecret }),
      });
      const data = await res.json();
      if (data.success) {
        setImportResult(`Connected "${data.shop_name}" — ${data.products_imported} products imported`);
        setShopDomain('');
        setClientId('');
        setClientSecret('');
        fetchStatus();
      } else {
        setShopError(data.error || 'Connection failed');
      }
    } catch {
      setShopError('Connection failed — check domain and credentials');
    }
    setImporting(false);
  };

  const handleSync = async (connectionId: string) => {
    setSyncing(connectionId);
    setImportResult(null);
    try {
      const res = await fetch(`/api/onboarding/sync-shopify/${connectionId}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setImportResult(`Synced: +${data.added} new, ${data.updated} updated, -${data.deactivated} removed | ${data.totalActive} active`);
        fetchStatus();
      } else {
        setShopError(data.error || 'Sync failed');
      }
    } catch {
      setShopError('Sync failed — connection may be expired');
    }
    setSyncing(null);
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

  const hasShopifyConnection = status.connections.length > 0;

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
            {status.shopify_item_count > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">
                {status.shopify_item_count} LIVE SHOPIFY
              </span>
            )}
          </div>

          {/* Active Shopify Connections */}
          {hasShopifyConnection && (
            <div className="ml-7 mb-2 space-y-1.5">
              {status.connections.map(conn => (
                <div key={conn.id} className="p-2 bg-emerald-50 border border-emerald-200 rounded text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-emerald-900">{conn.shop_domain}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleSync(conn.id)}
                        disabled={syncing === conn.id}
                        className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-200 text-emerald-800 hover:bg-emerald-300 disabled:opacity-50 transition-colors"
                      >
                        {syncing === conn.id ? 'Syncing...' : 'Refresh'}
                      </button>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${conn.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {conn.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="text-emerald-600 mt-0.5">
                    {conn.product_count} products | Synced {timeAgo(conn.last_synced_at)} | Auto-refresh every 15 min
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Connect form */}
          <div className="space-y-2 ml-7">
            <select
              value={source}
              onChange={e => setSource(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 bg-white"
            >
              <option value="shopify_real">Connect a real Shopify store (pilot)</option>
              <option value="simulated">Simulated demo catalog</option>
            </select>

            {source === 'shopify_real' && (
              <div className="space-y-2">
                <div className="p-2 bg-blue-50 border border-blue-200 rounded text-[10px] text-blue-800 leading-relaxed">
                  In your Shopify Dev Dashboard: Create app &rarr; grant <code className="bg-blue-100 px-0.5">read_products</code> scope &rarr; Install on store &rarr; copy Client ID and Client Secret. We exchange them for a temporary access token automatically.
                </div>
                <input
                  type="text"
                  value={shopDomain}
                  onChange={e => setShopDomain(e.target.value)}
                  placeholder="yourstore.myshopify.com"
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
                />
                <input
                  type="text"
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  placeholder="Client ID"
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
                />
                <input
                  type="password"
                  value={clientSecret}
                  onChange={e => setClientSecret(e.target.value)}
                  placeholder="Client Secret (shpss_...)"
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
                />
                {shopError && (
                  <p className="text-xs text-red-600 font-medium">{shopError}</p>
                )}
                <button
                  onClick={handleShopifyConnect}
                  disabled={importing}
                  className="w-full px-3 py-1.5 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {importing ? 'Connecting...' : 'Connect Shopify Store'}
                </button>
              </div>
            )}

            {source === 'simulated' && (
              <button
                onClick={handleSimulatedImport}
                disabled={importing}
                className="w-full px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {importing ? 'Importing...' : 'Load Demo Catalog (simulated)'}
              </button>
            )}
          </div>

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

        {/* Footer note */}
        <div className="text-[10px] text-gray-400 leading-relaxed border-t border-gray-100 pt-3">
          {hasShopifyConnection ? (
            <>
              <span className="font-medium text-emerald-600">Live Shopify catalog connected.</span> Product data is real and synced from the merchant's store. Checkout uses Razorpay test mode — no real funds are transferred.
            </>
          ) : (
            <>
              <span className="font-medium text-gray-500">Simulated catalog</span> — to connect a real store, select "Connect a real Shopify store" above. A production version uses the platform's existing Shopify app OAuth flow.
            </>
          )}
        </div>
      </div>
    </div>
  );
}
