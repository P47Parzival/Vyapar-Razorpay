import { useState, useEffect } from 'react';
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
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const eventSource = new EventSource('/api/ledger/stream');

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
      // Fallback to polling
      const poll = setInterval(async () => {
        try {
          const res = await fetch('/api/ledger?limit=50');
          const data = await res.json();
          setEntries(data.entries);
        } catch { /* ignore */ }
      }, 3000);
      return () => clearInterval(poll);
    };

    return () => eventSource.close();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'executed': return 'bg-green-100 text-green-800 border-green-200';
      case 'denied': return 'bg-red-100 text-red-800 border-red-200';
      case 'error': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'executed': return 'bg-green-500';
      case 'denied': return 'bg-red-500';
      case 'error': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Audit Ledger</h2>
        <span className="text-xs text-gray-500">{entries.length} entries</span>
      </div>

      {entries.length === 0 ? (
        <div className="p-8 text-center text-gray-400">
          No ledger entries yet. Trigger an agent to see activity here.
        </div>
      ) : (
        <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
          {entries.map((entry) => (
            <div key={entry.id}>
              <div
                className="px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${getStatusDot(entry.final_status)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded border ${getStatusColor(entry.final_status)}`}>
                        {entry.final_status.toUpperCase()}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                        {entry.agent_type}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatTime(entry.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 truncate">
                      {entry.human_readable_explanation}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-mono font-medium text-gray-900">
                      ₹{(entry.amount_paise / 100).toFixed(0)}
                    </span>
                  </div>
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
