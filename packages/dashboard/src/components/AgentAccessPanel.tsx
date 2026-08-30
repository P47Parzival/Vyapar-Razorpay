import { useState } from 'react';

export default function AgentAccessPanel() {
  const [copied, setCopied] = useState<string | null>(null);

  const host = window.location.hostname + ':3001';
  const baseUrl = `http://${host}`;
  const manifestUrl = `${baseUrl}/.well-known/agent-commerce.json`;
  const mcpEndpoint = `${baseUrl}/mcp`;
  const webhookEndpoint = `${baseUrl}/api/webhooks/razorpay`;
  const externalBuyerCmd = 'npm run external-buyer';

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const endpoints = [
    { key: 'mcp', label: 'MCP Endpoint', value: mcpEndpoint },
    { key: 'manifest', label: 'Discovery Manifest', value: manifestUrl },
    { key: 'webhook', label: 'Webhook Receiver', value: webhookEndpoint },
    { key: 'buyer', label: 'External Buyer Agent', value: externalBuyerCmd },
  ];

  return (
    <div className="register">
      <div className="register-header">
        <h2>Protocol Surface</h2>
        <p className="font-body text-xs text-ink-muted mt-0.5">Discoverable + transactable by any external AI agent</p>
      </div>

      <div className="register-body space-y-2">
        {endpoints.map(({ key, label, value }) => (
          <div key={key} className="flex items-center justify-between py-2.5 px-3 rounded border" style={{ borderColor: 'var(--ledger-line)' }}>
            <div className="min-w-0 flex-1 mr-3">
              <p className="font-body text-[10px] text-ink-muted uppercase tracking-wider font-medium">{label}</p>
              <p className="font-data text-xs text-ink mt-0.5 truncate">{value}</p>
            </div>
            <button
              onClick={() => copyToClipboard(value, key)}
              className="btn-primary text-[10px] px-2 py-1 flex-shrink-0"
            >
              {copied === key ? 'Copied!' : 'Copy'}
            </button>
          </div>
        ))}

        <p className="font-body text-[10px] text-ink-muted leading-relaxed pt-1">
          Any MCP client (Claude Desktop, Claude Code, or a standalone agent) can discover, browse, and transact — bounded by the same 6-check policy gateway. The external buyer demo runs from a separate process with zero shared code.
        </p>
      </div>
    </div>
  );
}
