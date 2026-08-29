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
import './dashboard.css';

function App() {
  const navigate = useNavigate();

  return (
    <div className="dashboard-root">
      <header className="dashboard-header">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="text-sm text-gray-400 hover:text-gray-800 transition-colors"
            >
              &larr;
            </button>
            <h1 className="text-lg font-bold text-gray-900">Vyapar</h1>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
              TEST MODE
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200 font-medium">
              MCP
            </span>
          </div>
          <p className="text-xs text-gray-400 font-medium hidden sm:block">
            Agentic Commerce Dashboard
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <RevenueCounter />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <LedgerFeed />
          </div>
          <div className="space-y-4 dashboard-sidebar">
            <MerchantOnboarding />
            <MandatePanel />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <OrdersAndCustomers />
          <PolicyPanel />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AgentAccessPanel />
          <AgentTriggers />
        </div>

        <CatalogAudit />
      </main>
    </div>
  );
}

export default App;
