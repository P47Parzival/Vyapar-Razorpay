import { useState, useEffect } from 'react';
import { useMerchant } from '../MerchantContext';

interface LedgerEntry {
  agent_type: string;
  final_status: string;
  amount_paise: number;
  proposal_json: string;
}

export default function RevenueCounter() {
  const { apiUrl, merchantId } = useMerchant();
  const [stats, setStats] = useState({ recovered: 0, upsell: 0, buyer: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(apiUrl('/api/ledger?limit=1000'));
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
  }, [merchantId]);

  const formatCurrency = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`;

  const figures = [
    { label: 'Cart Recovery', value: stats.recovered, sub: 'Recovered via cart-recovery agent' },
    { label: 'Upsell Revenue', value: stats.upsell, sub: 'Upsell revenue generated' },
    { label: 'AI Buyer', value: stats.buyer, sub: 'AI-buyer transactions completed' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {figures.map(f => (
        <div key={f.label} className="register px-5 py-4">
          <p className="font-body text-[11px] text-ink-muted uppercase tracking-wider font-medium">{f.label}</p>
          <p className="font-data text-2xl font-medium text-ink mt-1.5 tracking-tight">{formatCurrency(f.value)}</p>
          <p className="font-body text-[11px] text-ink-muted mt-1">{f.sub}</p>
        </div>
      ))}
    </div>
  );
}
