import LedgerFeed from './components/LedgerFeed';

function App() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">Vyapar</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 font-medium">
            TEST MODE
          </span>
        </div>
        <p className="text-gray-600 mt-1">
          Bounded Agentic Commerce — AI agents that grow revenue, gated by deterministic policy
        </p>
      </header>

      <main className="grid grid-cols-1 gap-6">
        <LedgerFeed />
      </main>
    </div>
  );
}

export default App;
