import LedgerFeed from './components/LedgerFeed';
import AgentTriggers from './components/AgentTriggers';
import RevenueCounter from './components/RevenueCounter';
import PolicyPanel from './components/PolicyPanel';
import AgentAccessPanel from './components/AgentAccessPanel';
import MandatePanel from './components/MandatePanel';

function App() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">Vyapar</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 font-medium">
            TEST MODE
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 font-medium">
            MCP
          </span>
        </div>
        <p className="text-gray-600 mt-1">
          Bounded Agentic Commerce on Razorpay — any AI agent can transact with this merchant, gated by deterministic policy
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Protocol-interoperable: MCP server + .well-known discovery + AP2/UAP-style mandates + webhook triggers
        </p>
      </header>

      <main className="space-y-6">
        <RevenueCounter />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <LedgerFeed />
          </div>
          <div className="space-y-4">
            <MandatePanel />
            <AgentAccessPanel />
            <PolicyPanel />
            <AgentTriggers />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
