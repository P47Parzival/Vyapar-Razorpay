import { useState, useEffect } from 'react';

interface LedgerEntry {
  agent_type: string;
  final_status: string;
  amount_paise: number;
}

export default function RevenueCounter() {
  const [stats, setStats] = useState({ recovered: 0, upsell: 0, total: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/ledger?limit=1000');
        const data = await res.json();
        const entries = data.entries as LedgerEntry[];

        let recovered = 0;
        let upsell = 0;

        for (const entry of entries) {
          if (entry.final_status !== 'executed' || entry.agent_type !== 'growth') continue;
          const proposal = JSON.parse((entry as unknown as { proposal_json: string }).proposal_json);
          if (proposal.original_order_id) {
            recovered += entry.amount_paise;
          } else {
            upsell += entry.amount_paise;
          }
        }

        setStats({ recovered, upsell, total: recovered + upsell });
      } catch { /* ignore */ }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Cart Recovery</p>
        <p className="text-2xl font-bold text-orange-600 mt-1">{formatCurrency(stats.recovered)}</p>
        <p className="text-xs text-gray-400 mt-0.5">Revenue recovered</p>
      </div>
      <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Upsell Revenue</p>
        <p className="text-2xl font-bold text-purple-600 mt-1">{formatCurrency(stats.upsell)}</p>
        <p className="text-xs text-gray-400 mt-0.5">Cross-sell / upsell</p>
      </div>
      <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Growth</p>
        <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(stats.total)}</p>
        <p className="text-xs text-gray-400 mt-0.5">Agent-driven revenue</p>
      </div>
    </div>
  );
}
