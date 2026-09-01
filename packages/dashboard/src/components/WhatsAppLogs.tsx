import { useState, useEffect } from 'react';
import { useMerchant } from '../MerchantContext';

interface AuditLogEntry {
  id: string;
  merchant_id: string;
  from_number: string;
  message_text: string;
  parsed_change_json: string | null;
  decision: 'auto_applied' | 'deferred' | 'parse_failed' | 'sender_rejected' | 'outbound_notification';
  field_changed: string | null;
  value_before: string | null;
  value_after: string | null;
  reply_sent: string | null;
  created_at: string;
}

function DecisionBadge({ decision }: { decision: AuditLogEntry['decision'] }) {
  const config: Record<string, { label: string; color: string; bg: string }> = {
    auto_applied: { label: 'Applied', color: 'var(--seal-green)', bg: '#e8f5e9' },
    deferred: { label: 'Deferred', color: '#8B6914', bg: '#fff8e1' },
    parse_failed: { label: 'Parse failed', color: 'var(--ink-muted)', bg: '#f0f0ee' },
    sender_rejected: { label: 'Rejected', color: 'var(--seal-red)', bg: '#fbe9e7' },
    outbound_notification: { label: 'Outbound', color: 'var(--signal-indigo)', bg: '#e8eaf6' },
  };
  const c = config[decision] || config.parse_failed;
  return (
    <span
      className="font-data text-[11px] px-2 py-0.5 rounded"
      style={{ color: c.color, background: c.bg }}
    >
      {c.label}
    </span>
  );
}

export default function WhatsAppLogs() {
  const { apiUrl, merchantId } = useMerchant();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(apiUrl('/api/whatsapp-logs'))
      .then(r => r.json())
      .then(d => { setLogs(d.logs || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [merchantId]);

  const formatTime = (ts: string) => {
    const d = new Date(ts + 'Z');
    return d.toLocaleString('en-IN', {
      day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  };

  if (loading) {
    return (
      <div style={{ background: '#fff', border: '1px solid var(--ledger-line)', borderRadius: 8, padding: 32 }}>
        <p className="font-body text-sm text-ink-muted animate-pulse">Loading WhatsApp logs...</p>
      </div>
    );
  }

  return (
    <div className="register" style={{ maxHeight: 'none' }}>
      <div className="register-header flex items-center justify-between">
        <div>
          <h2>WhatsApp Audit Log</h2>
          <p className="font-body text-xs text-ink-muted mt-0.5">
            Every inbound WhatsApp message — applied, deferred, failed, or rejected — logged here
          </p>
        </div>
        <span className="font-data text-xs text-ink-muted">{logs.length} entries</span>
      </div>

      {logs.length === 0 ? (
        <div className="px-5 py-10 text-center text-ink-muted font-body text-sm">
          No WhatsApp messages received yet. Send a policy change message from the registered merchant number to see activity here.
        </div>
      ) : (
        <div>
          {logs.map(entry => (
            <div key={entry.id}>
              <div
                className="ledger-row flex items-start gap-3"
                style={{ cursor: 'pointer' }}
                onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              >
                <DecisionBadge decision={entry.decision} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-data text-[11px] text-ink-muted">
                      {entry.from_number}
                    </span>
                    <span className="font-data text-[10px] text-ink-muted ml-auto flex-shrink-0">
                      {formatTime(entry.created_at)}
                    </span>
                  </div>
                  <p className="font-body text-sm text-ink leading-snug truncate">
                    {entry.message_text}
                  </p>
                  {entry.field_changed && entry.decision === 'auto_applied' && entry.value_before && entry.value_after && (
                    <p className="font-data text-xs text-ink-muted mt-1">
                      {entry.field_changed}: {entry.value_before} → {entry.value_after}
                    </p>
                  )}
                </div>
              </div>

              {expandedId === entry.id && (
                <div
                  style={{
                    background: '#fff',
                    borderTop: '1px solid var(--ledger-line)',
                    borderBottom: '1px solid var(--ledger-line)',
                    padding: '12px 20px',
                  }}
                >
                  <div className="space-y-3">
                    <div>
                      <span className="font-body text-xs font-medium text-ink-muted">Message</span>
                      <p className="font-body text-sm text-ink mt-0.5">{entry.message_text}</p>
                    </div>

                    {entry.parsed_change_json && (
                      <div>
                        <span className="font-body text-xs font-medium text-ink-muted">Parsed as</span>
                        <pre className="font-data text-xs text-ink mt-0.5 whitespace-pre-wrap">
                          {JSON.stringify(JSON.parse(entry.parsed_change_json), null, 2)}
                        </pre>
                      </div>
                    )}

                    {!entry.parsed_change_json && entry.decision === 'parse_failed' && (
                      <div>
                        <span className="font-body text-xs font-medium text-ink-muted">Parsed as</span>
                        <p className="font-body text-sm text-ink-muted mt-0.5 italic">Could not parse</p>
                      </div>
                    )}

                    {entry.field_changed && (
                      <div>
                        <span className="font-body text-xs font-medium text-ink-muted">Field</span>
                        <p className="font-data text-xs text-ink mt-0.5">{entry.field_changed}</p>
                      </div>
                    )}

                    {entry.decision === 'auto_applied' && entry.value_before && entry.value_after && (
                      <div className="flex gap-6">
                        <div>
                          <span className="font-body text-xs font-medium text-ink-muted">Before</span>
                          <p className="font-data text-sm text-ink mt-0.5">{entry.value_before}</p>
                        </div>
                        <div>
                          <span className="font-body text-xs font-medium text-ink-muted">After</span>
                          <p className="font-data text-sm text-ink mt-0.5">{entry.value_after}</p>
                        </div>
                      </div>
                    )}

                    {entry.reply_sent && (
                      <div>
                        <span className="font-body text-xs font-medium text-ink-muted">Reply sent</span>
                        <p className="font-body text-sm text-ink mt-0.5 whitespace-pre-line">{entry.reply_sent}</p>
                      </div>
                    )}

                    <div>
                      <span className="font-body text-xs font-medium text-ink-muted">Log ID</span>
                      <p className="font-data text-[11px] text-ink-muted mt-0.5">{entry.id}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
