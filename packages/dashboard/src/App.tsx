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
import './dashboard.css';

type Tab = 'dashboard' | 'connect' | 'products' | 'catalog-confidence';

function App() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'connect', label: 'Connect' },
    { key: 'products', label: 'Products' },
    { key: 'catalog-confidence', label: 'Catalog Confidence' },
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
            <img src="/assets/vyapar_logo.png" alt="Vyapar" className="h-10" />
            <span className="font-data text-[10px] px-2 py-0.5 rounded border border-ledger text-ink-muted">
              TEST MODE
            </span>
            <span className="font-data text-[10px] px-2 py-0.5 rounded border border-ledger text-signal-indigo">
              MCP
            </span>
          </div>
          <p className="font-body text-xs text-ink-muted hidden sm:block tracking-wide">
            <p className="text-amber-900 animate-pulse">(No sign in sign up required, because this is a test product for judges)</p>Agentic Commerce Dashboard
          </p>
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
            {/* Summary Strip */}
            <RevenueCounter />

            {/* Ledger + Orders & Customers */}
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
            {/* Merchant Setup + Protocol Surface */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <MerchantOnboarding />
              <AgentAccessPanel />
            </div>

            {/* Mandates + Policy Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <MandatePanel />
              <PolicyPanel />
            </div>

            {/* Growth Agent + AI Buyer Agent */}
            <AgentTriggers />
          </>
        )}

        {activeTab === 'products' && (
          <ProductsCatalog />
        )}

        {activeTab === 'catalog-confidence' && (
          <CatalogAudit />
        )}
      </main>
    </div>
  );
}

export default App;
