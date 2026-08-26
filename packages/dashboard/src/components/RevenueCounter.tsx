import { useState, useEffect } from 'react';

interface LedgerEntry {
  agent_type: string;
  final_status: string;
  amount_paise: number;
  proposal_json: string;
}

export default function RevenueCounter() {
  const [stats, setStats] = useState({ recovered: 0, upsell: 0, buyer: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/ledger?limit=1000');
        const data = await res.json();
        const entries = data.entries as LedgerEntry[];

        let recovered = 0;
        let upsell = 0;
        let buyer = 0;

        for (const entry of entries) {
          if (entry.final_status !== 'executed') continue;

          if (entry.agent_type === 'buyer') {
            buyer += entry.amount_paise;
          } else if (entry.agent_type === 'growth') {
            const proposal = JSON.parse(entry.proposal_json);
            if (proposal.original_order_id) {
              recovered += entry.amount_paise;
            } else {
              upsell += entry.amount_paise;
            }
          }
        }

        setStats({ recovered, upsell, buyer });
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
        <p className="text-xs text-gray-400 mt-0.5">Recovered via cart-recovery agent</p>
      </div>
      <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Upsell Revenue</p>
        <p className="text-2xl font-bold text-purple-600 mt-1">{formatCurrency(stats.upsell)}</p>
        <p className="text-xs text-gray-400 mt-0.5">Upsell revenue generated</p>
      </div>
      <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">AI Buyer</p>
        <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(stats.buyer)}</p>
        <p className="text-xs text-gray-400 mt-0.5">AI-buyer transactions completed</p>
      </div>
    </div>
  );
}
