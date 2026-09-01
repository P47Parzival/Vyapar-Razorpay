import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LedgerFeed from './components/LedgerFeed';
import OrdersAndCustomers from './components/OrdersAndCustomers';
import AgentTriggers from './components/AgentTriggers';
import RevenueCounter from './components/RevenueCounter';
import PolicyPanel from './components/PolicyPanel';
import AgentAccessPanel from './components/AgentAccessPanel';
import MandatePanel from './components/MandatePanel';
import MerchantOnboarding from './components/MerchantOnboarding';
import CatalogAudit from './components/CatalogAudit';
import ProductsCatalog from './components/ProductsCatalog';
import WhatsAppLogs from './components/WhatsAppLogs';
import { MerchantProvider, useMerchant } from './MerchantContext';
import vyaparLogo from '../assets/vyapar_logo.png';
import './dashboard.css';

type Tab = 'dashboard' | 'connect' | 'products' | 'catalog-confidence' | 'whatsapp-logs';

function DashboardInner() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const { merchantId, setMerchantId, merchants, merchantName } = useMerchant();

  const tabs: { key: Tab; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'connect', label: 'Connect' },
    { key: 'products', label: 'Products' },
    { key: 'catalog-confidence', label: 'Catalog Confidence' },
    { key: 'whatsapp-logs', label: 'WhatsApp Logs' },
  ];

  return (
    <div className="dashboard-root">
      {/* Masthead */}
      <header className="dashboard-header">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="text-ink-muted hover:text-ink transition-colors text-sm"
            >
              &larr;
            </button>
            <img src={vyaparLogo} alt="Vyapar" className="h-10" />
            <span className="font-data text-[10px] px-2 py-0.5 rounded border border-ledger text-ink-muted">
              TEST MODE
            </span>
            <span className="font-data text-[10px] px-2 py-0.5 rounded border border-ledger text-signal-indigo">
              MCP
            </span>
          </div>
          <div className="flex items-center gap-3">
            {merchants.length > 1 && (
              <select
                value={merchantId}
                onChange={e => setMerchantId(e.target.value)}
                className="font-body text-xs border rounded px-2 py-1"
                style={{ borderColor: 'var(--ledger-line)', color: 'var(--ink)', background: '#fff' }}
              >
                {merchants.map(m => (
                  <option key={m.id} value={m.id}>{m.display_name}</option>
                ))}
              </select>
            )}
            <div className="hidden sm:block text-right">
              <p className="text-amber-900 animate-pulse font-body text-xs">(No sign in sign up required, because this is a test product for judges)</p>
              <p className="font-body text-xs text-ink-muted tracking-wide">
                Viewing: <span className="font-medium" style={{ color: 'var(--ink)' }}>{merchantName}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <nav className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-0 border-b" style={{ borderColor: 'var(--ledger-line)' }}>
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`font-body text-sm px-4 py-2.5 transition-colors relative ${activeTab === tab.key
                  ? 'text-ink font-medium'
                  : 'text-ink-muted hover:text-ink'
                  }`}
              >
                {tab.label}
                {activeTab === tab.key && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: 'var(--signal-indigo)' }} />
                )}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-8">
        {activeTab === 'dashboard' && (
          <>
            <RevenueCounter />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ height: '680px' }}>
              <div className="lg:col-span-2 flex flex-col min-h-0">
                <LedgerFeed />
              </div>
              <div className="flex flex-col min-h-0">
                <OrdersAndCustomers />
              </div>
            </div>
          </>
        )}

        {activeTab === 'connect' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <MerchantOnboarding />
              <AgentAccessPanel />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <MandatePanel />
              <PolicyPanel />
            </div>
            <AgentTriggers />
          </>
        )}

        {activeTab === 'products' && (
          <ProductsCatalog />
        )}

        {activeTab === 'catalog-confidence' && (
          <CatalogAudit />
        )}

        {activeTab === 'whatsapp-logs' && (
          <WhatsAppLogs />
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <MerchantProvider>
      <DashboardInner />
    </MerchantProvider>
  );
}

export default App;
