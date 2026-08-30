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
    <div style={{
      background: 'linear-gradient(135deg, #FFFFFF 0%, #F0F1FA 100%)',
      border: '1px solid var(--ledger-line)',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '24px 24px 18px' }}>
        <div className="flex items-center gap-3">
          <h2 className="font-display" style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
            Merchant Setup
          </h2>
          <span className="font-body" style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
            Enter details and get AI transactable in seconds
          </span>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px' }} className="space-y-4">
        {/* Catalog source + Shopify connection + form + toggle — all in one card */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: 8,
          border: '1.5px solid var(--ledger-line)',
          padding: '18px',
        }}>
          {/* Catalog header */}
          <div className="flex items-center gap-3 mb-3">
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700,
              background: status.catalog_connected ? 'var(--seal-green)' : 'var(--signal-indigo)',
              color: '#fff',
            }}>
              {status.catalog_connected ? '✓' : '1'}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-body" style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                Connect Catalog Source
              </h3>
              {status.catalog_connected && (
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="font-data" style={{ fontSize: 11, color: 'var(--seal-green)', fontWeight: 500 }}>
                    {status.catalog_item_count} items loaded
                  </span>
                  {status.shopify_item_count > 0 && (
                    <span className="font-data" style={{ fontSize: 11, color: 'var(--ink-muted)' }}>
                      {status.shopify_item_count} from Shopify
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Shopify connections */}
          {hasShopifyConnection && (
            <div className="mb-3 space-y-2">
              {status.connections.map(conn => (
                <div key={conn.id} style={{
                  background: 'rgba(31,111,74,0.03)',
                  border: '1px solid rgba(31,111,74,0.15)',
                  borderRadius: 6,
                  padding: '10px 12px',
                }}>
                  <div className="flex items-center justify-between">
                    <span className="font-body" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                      {conn.shop_domain}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSync(conn.id)}
                        disabled={syncing === conn.id}
                        style={{
                          fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 4,
                          background: 'var(--seal-green)', color: '#fff', border: 'none', cursor: 'pointer',
                          opacity: syncing === conn.id ? 0.6 : 1,
                        }}
                      >
                        {syncing === conn.id ? 'Syncing...' : 'Refresh'}
                      </button>
                      <span className="font-data" style={{
                        fontSize: 10, fontWeight: 600,
                        color: conn.status === 'active' ? 'var(--seal-green)' : 'var(--seal-red)',
                      }}>
                        {conn.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <p className="font-body" style={{ fontSize: 11, color: 'var(--ink-muted)', marginTop: 3 }}>
                    <span className="font-data">{conn.product_count}</span> products · Synced {timeAgo(conn.last_synced_at)} · Auto-refresh every 15 min
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Form */}
          <div className="space-y-2.5">
            <select
              value={source}
              onChange={e => setSource(e.target.value)}
              className="font-body"
              style={{
                width: '100%', fontSize: 13, border: '1.5px solid var(--ledger-line)',
                borderRadius: 6, padding: '9px 12px', color: 'var(--ink)', background: '#fff',
              }}
            >
              <option value="shopify_real">Connect a real Shopify store (pilot)</option>
              <option value="simulated">Simulated demo catalog</option>
            </select>

            {source === 'shopify_real' && (
              <div className="space-y-2.5">
                <input type="text" value={shopDomain} onChange={e => setShopDomain(e.target.value)}
                  placeholder="yourstore.myshopify.com" className="font-data"
                  style={{ width: '100%', fontSize: 13, border: '1.5px solid var(--ledger-line)', borderRadius: 6, padding: '9px 12px', color: 'var(--ink)', background: '#fff' }}
                />
                <input type="text" value={clientId} onChange={e => setClientId(e.target.value)}
                  placeholder="Client ID" className="font-data"
                  style={{ width: '100%', fontSize: 13, border: '1.5px solid var(--ledger-line)', borderRadius: 6, padding: '9px 12px', color: 'var(--ink)', background: '#fff' }}
                />
                <input type="password" value={clientSecret} onChange={e => setClientSecret(e.target.value)}
                  placeholder="Client Secret (shpss_...)" className="font-body"
                  style={{ width: '100%', fontSize: 13, border: '1.5px solid var(--ledger-line)', borderRadius: 6, padding: '9px 12px', color: 'var(--ink)', background: '#fff' }}
                />
                {shopError && (
                  <p className="font-body" style={{ fontSize: 12, color: 'var(--seal-red)', fontWeight: 500 }}>{shopError}</p>
                )}
                <button onClick={handleShopifyConnect} disabled={importing}
                  style={{
                    width: '100%', padding: '11px 0', borderRadius: 6, border: 'none',
                    background: 'var(--signal-indigo)', color: '#fff',
                    fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600,
                    cursor: importing ? 'not-allowed' : 'pointer', opacity: importing ? 0.6 : 1,
                  }}
                >
                  {importing ? 'Connecting...' : 'Connect Shopify Store'}
                </button>
              </div>
            )}

            {source === 'simulated' && (
              <button onClick={handleSimulatedImport} disabled={importing}
                style={{
                  width: '100%', padding: '11px 0', borderRadius: 6, border: 'none',
                  background: 'var(--signal-indigo)', color: '#fff',
                  fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600,
                  cursor: importing ? 'not-allowed' : 'pointer', opacity: importing ? 0.6 : 1,
                }}
              >
                {importing ? 'Importing...' : 'Load Demo Catalog'}
              </button>
            )}
          </div>

          {importResult && (
            <p className="font-body" style={{ fontSize: 12, color: 'var(--signal-indigo)', fontWeight: 600, marginTop: 10 }}>
              {importResult}
            </p>
          )}

          {/* AI Transactability toggle — inline at the bottom */}
          <div className="flex items-center justify-between" style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--ledger-line)' }}>
            <div className="flex items-center gap-2.5">
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700,
                background: status.agent_commerce_enabled ? 'var(--seal-green)' : 'var(--signal-indigo)',
                color: '#fff',
              }}>
                {status.agent_commerce_enabled ? '✓' : '2'}
              </div>
              <div>
                <span className="font-body" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                  AI Agent Transactability
                </span>
                <p className="font-body" style={{ fontSize: 11, color: 'var(--ink-muted)', marginTop: 1 }}>
                  {status.agent_commerce_enabled ? 'Agents can transact' : 'Agents will be denied'}
                </p>
              </div>
            </div>
            <button
              onClick={handleToggle}
              disabled={toggling}
              style={{
                position: 'relative', width: 44, height: 24, borderRadius: 12,
                border: 'none', cursor: toggling ? 'not-allowed' : 'pointer',
                background: status.agent_commerce_enabled ? 'var(--seal-green)' : 'var(--ledger-line)',
                transition: 'background 0.3s', flexShrink: 0,
              }}
            >
              <span style={{
                position: 'absolute', top: 2, width: 20, height: 20,
                borderRadius: '50%', background: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                transition: 'left 0.25s cubic-bezier(0.4,0,0.2,1)',
                left: status.agent_commerce_enabled ? 22 : 2,
              }} />
            </button>
          </div>

          {/* Shopify instructions — at the very bottom */}
          {source === 'shopify_real' && (
            <p className="font-body" style={{ fontSize: 11, color: 'var(--ink-muted)', marginTop: 12, lineHeight: 1.5 }}>
              In your Shopify Dev Dashboard: Create app &rarr; grant <span className="font-data" style={{ fontSize: 10 }}>read_products</span> scope &rarr; Install on store &rarr; copy Client ID and Client Secret. We exchange them for a temporary access token automatically.
            </p>
          )}
        </div>

        {/* Footer */}
        <p className="font-body" style={{ fontSize: 11, color: 'var(--ink-muted)', lineHeight: 1.5 }}>
          {hasShopifyConnection ? (
            <>
              <span style={{ fontWeight: 600, color: 'var(--seal-green)' }}>Live Shopify catalog connected.</span>{' '}
            </>
          ) : (
            <>
              <span style={{ fontWeight: 500 }}>Simulated catalog</span> — select "Connect a real Shopify store" above to use live product data.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
