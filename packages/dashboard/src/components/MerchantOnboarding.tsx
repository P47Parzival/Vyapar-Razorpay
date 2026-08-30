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
    <div className="register">
      <div className="register-header">
        <h2>Merchant Setup</h2>
        <p className="font-body text-xs text-ink-muted mt-0.5">Zero-code onboarding — connect an existing catalog, flip one toggle</p>
      </div>

      <div className="register-body space-y-4">
        {/* Step 1: Connect Catalog */}
        <div className="p-3 rounded border" style={{
          borderColor: status.catalog_connected ? 'var(--seal-green)' : 'var(--ledger-line)',
          background: status.catalog_connected ? 'rgba(31,111,74,0.04)' : 'transparent',
        }}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`seal ${status.catalog_connected ? 'seal-approved' : ''}`} style={{ width: 20, height: 20, fontSize: 10 }}>
              {status.catalog_connected ? '✓' : '1'}
            </div>
            <span className="font-body text-sm font-medium text-ink">Connect Catalog Source</span>
            {status.catalog_connected && (
              <span className="font-data text-[10px] text-seal-green font-medium">
                {status.catalog_item_count} items
              </span>
            )}
            {status.shopify_item_count > 0 && (
              <span className="font-data text-[10px] text-ink-muted">
                {status.shopify_item_count} live Shopify
              </span>
            )}
          </div>

          {/* Active Shopify Connections */}
          {hasShopifyConnection && (
            <div className="ml-7 mb-2 space-y-1.5">
              {status.connections.map(conn => (
                <div key={conn.id} className="p-2 rounded border" style={{ borderColor: 'var(--seal-green)', background: 'rgba(31,111,74,0.04)' }}>
                  <div className="flex items-center justify-between">
                    <span className="font-body text-xs font-medium text-ink">{conn.shop_domain}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleSync(conn.id)}
                        disabled={syncing === conn.id}
                        className="btn-primary text-[10px] px-1.5 py-0.5"
                      >
                        {syncing === conn.id ? 'Syncing...' : 'Refresh'}
                      </button>
                      <span className={`font-data text-[10px] font-medium ${conn.status === 'active' ? 'text-seal-green' : 'text-seal-red'}`}>
                        {conn.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <p className="font-body text-[10px] text-ink-muted mt-0.5">
                    <span className="font-data">{conn.product_count}</span> products · Synced {timeAgo(conn.last_synced_at)} · Auto-refresh every 15 min
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Connect form */}
          <div className="space-y-2 ml-7">
            <select
              value={source}
              onChange={e => setSource(e.target.value)}
              className="w-full text-sm font-body border rounded px-2 py-1.5"
              style={{ borderColor: 'var(--ledger-line)' }}
            >
              <option value="shopify_real">Connect a real Shopify store (pilot)</option>
              <option value="simulated">Simulated demo catalog</option>
            </select>

            {source === 'shopify_real' && (
              <div className="space-y-2">
                <div className="p-2 rounded border font-body text-[10px] text-ink-muted leading-relaxed" style={{ borderColor: 'var(--signal-indigo)', background: 'rgba(47,58,143,0.03)' }}>
                  In your Shopify Dev Dashboard: Create app &rarr; grant <span className="font-data">read_products</span> scope &rarr; Install on store &rarr; copy Client ID and Client Secret. We exchange them for a temporary access token automatically.
                </div>
                <input
                  type="text"
                  value={shopDomain}
                  onChange={e => setShopDomain(e.target.value)}
                  placeholder="yourstore.myshopify.com"
                  className="w-full text-sm font-data border rounded px-2 py-1.5 text-ink"
                  style={{ borderColor: 'var(--ledger-line)' }}
                />
                <input
                  type="text"
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  placeholder="Client ID"
                  className="w-full text-sm font-data border rounded px-2 py-1.5 text-ink"
                  style={{ borderColor: 'var(--ledger-line)' }}
                />
                <input
                  type="password"
                  value={clientSecret}
                  onChange={e => setClientSecret(e.target.value)}
                  placeholder="Client Secret (shpss_...)"
                  className="w-full text-sm font-body border rounded px-2 py-1.5 text-ink"
                  style={{ borderColor: 'var(--ledger-line)' }}
                />
                {shopError && (
                  <p className="font-body text-xs text-seal-red font-medium">{shopError}</p>
                )}
                <button
                  onClick={handleShopifyConnect}
                  disabled={importing}
                  className="btn-primary w-full"
                >
                  {importing ? 'Connecting...' : 'Connect Shopify Store'}
                </button>
              </div>
            )}

            {source === 'simulated' && (
              <button
                onClick={handleSimulatedImport}
                disabled={importing}
                className="btn-primary w-full"
              >
                {importing ? 'Importing...' : 'Load Demo Catalog (simulated)'}
              </button>
            )}
          </div>

          {importResult && (
            <p className="font-body text-xs text-signal-indigo mt-1.5 ml-7 font-medium">{importResult}</p>
          )}
        </div>

        {/* Step 2: Enable AI Agent Commerce */}
        <div className="p-3 rounded border" style={{
          borderColor: status.agent_commerce_enabled ? 'var(--seal-green)' : 'var(--ledger-line)',
          background: status.agent_commerce_enabled ? 'rgba(31,111,74,0.04)' : 'transparent',
        }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`seal ${status.agent_commerce_enabled ? 'seal-approved' : ''}`} style={{ width: 20, height: 20, fontSize: 10 }}>
                {status.agent_commerce_enabled ? '✓' : '2'}
              </div>
              <div>
                <span className="font-body text-sm font-medium text-ink">Enable AI Agent Transactability</span>
                <p className="font-body text-[10px] text-ink-muted mt-0.5">
                  {status.agent_commerce_enabled
                    ? 'AI agents can discover and transact with this merchant'
                    : 'AI agent proposals will be denied with MERCHANT_NOT_OPTED_IN'}
                </p>
              </div>
            </div>
            <button
              onClick={handleToggle}
              disabled={toggling}
              className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
              style={{ background: status.agent_commerce_enabled ? 'var(--seal-green)' : 'var(--ledger-line)' }}
            >
              <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                    style={{ left: status.agent_commerce_enabled ? '22px' : '2px' }} />
            </button>
          </div>
        </div>

        {/* Footer note */}
        <div className="pt-3 border-t" style={{ borderColor: 'var(--ledger-line)' }}>
          <p className="font-body text-[10px] text-ink-muted leading-relaxed">
            {hasShopifyConnection ? (
              <>
                <span className="font-medium text-seal-green">Live Shopify catalog connected.</span> Product data is real and synced from the merchant's store. Checkout uses Razorpay test mode — no real funds are transferred.
              </>
            ) : (
              <>
                <span className="font-medium text-ink">Simulated catalog</span> — to connect a real store, select "Connect a real Shopify store" above. A production version uses the platform's existing Shopify app OAuth flow.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
