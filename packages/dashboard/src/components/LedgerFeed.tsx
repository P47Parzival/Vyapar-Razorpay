import { useState, useEffect } from 'react';
import { useMerchant } from '../MerchantContext';
import DecisionDetail from './DecisionDetail';

interface LedgerEntry {
  id: string;
  timestamp: string;
  agent_type: string;
  final_status: string;
  human_readable_explanation: string;
  amount_paise: number;
  category: string | null;
  proposal_json: string;
  checks_json: string;
  decision_json: string;
}

export default function LedgerFeed() {
  const { apiUrl, merchantId } = useMerchant();
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const eventSource = new EventSource(apiUrl('/api/ledger/stream'));

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'init') {
        setEntries(data.entries);
      } else if (data.type === 'update') {
        setEntries(prev => {
          const newIds = new Set(data.entries.map((e: LedgerEntry) => e.id));
          const filtered = prev.filter(e => !newIds.has(e.id));
          return [...data.entries.reverse(), ...filtered];
        });
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      const poll = setInterval(async () => {
        try {
          const res = await fetch(apiUrl('/api/ledger?limit=50'));
          const data = await res.json();
          setEntries(data.entries);
        } catch { /* ignore */ }
      }, 3000);
      return () => clearInterval(poll);
    };

    return () => eventSource.close();
  }, [merchantId]);

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getSourceLabel = (entry: LedgerEntry): string => {
    try {
      const proposal = JSON.parse(entry.proposal_json);
      const trigger = proposal.triggered_by || 'simulated_button';
      const agent = entry.agent_type === 'growth' ? 'Growth Agent' : 'Buyer Agent';
      switch (trigger) {
        case 'webhook': return `${agent} · webhook`;
        case 'mcp_external': return `${agent} · via MCP`;
        case 'internal': return `${agent} · internal`;
        case 'whatsapp_override': return `${agent} · WhatsApp override`;
        default: return `${agent} · simulated`;
      }
    } catch {
      return entry.agent_type;
    }
  };

  const hasShopifyItems = (entry: LedgerEntry): boolean => {
    try {
      const proposal = JSON.parse(entry.proposal_json);
      const itemIds: string[] = proposal.item_ids || [];
      return itemIds.some((id: string) => id.startsWith('shopify_'));
    } catch { return false; }
  };

  return (
    <div className="register flex flex-col h-full">
      <div className="register-header flex items-center justify-between">
        <div>
          <h2>The Ledger</h2>
          <p className="font-body text-xs text-ink-muted mt-0.5">Every proposal — approved, denied, or errored — recorded here</p>
        </div>
        <span className="font-data text-xs text-ink-muted">{entries.length} entries</span>
      </div>

      {entries.length === 0 ? (
        <div className="px-5 py-10 text-center text-ink-muted font-body text-sm">
          No ledger entries yet. Trigger an agent to see activity here.
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto">
          {entries.map((entry) => (
            <div key={entry.id}>
              <div
                className="ledger-row flex items-start gap-3"
                onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              >
                {/* Seal stamp */}
                <div className={`seal seal-animate ${
                  entry.final_status === 'executed' ? 'seal-approved' :
                  entry.final_status === 'denied' ? 'seal-denied' : 'seal-error'
                }`}>
                  {entry.final_status === 'executed' ? '✓' :
                   entry.final_status === 'denied' ? '✗' : '!'}
                </div>

                {/* Body */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-body text-xs font-medium text-ink-muted">
                      {getSourceLabel(entry)}
                    </span>
                    {hasShopifyItems(entry) && (
                      <span className="font-data text-[10px] text-ink-muted">
                        live catalog
                      </span>
                    )}
                    <span className="font-data text-[10px] text-ink-muted ml-auto flex-shrink-0">
                      {formatTime(entry.timestamp)}
                    </span>
                  </div>
                  <p className="font-body text-sm text-ink leading-snug">
                    {entry.human_readable_explanation}
                  </p>
                </div>

                {/* Amount column */}
                <div className="text-right flex-shrink-0 pl-3">
                  <span className="font-data text-sm font-medium text-ink">
                    ₹{(entry.amount_paise / 100).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {expandedId === entry.id && (
                <DecisionDetail entry={entry} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
