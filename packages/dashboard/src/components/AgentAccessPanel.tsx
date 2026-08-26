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

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Protocol Surface</h2>
        <p className="text-xs text-gray-500 mt-0.5">Discoverable + transactable by any external AI agent</p>
      </div>

      <div className="p-4 space-y-2.5">
        <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-indigo-500 uppercase tracking-wider font-medium">MCP Endpoint</p>
              <p className="text-xs font-mono text-indigo-900 mt-0.5">{mcpEndpoint}</p>
            </div>
            <button
              onClick={() => copyToClipboard(mcpEndpoint, 'mcp')}
              className="px-2 py-1 text-[10px] bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
            >
              {copied === 'mcp' ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Discovery Manifest</p>
              <p className="text-xs font-mono text-gray-900 mt-0.5">{manifestUrl}</p>
            </div>
            <button
              onClick={() => copyToClipboard(manifestUrl, 'manifest')}
              className="px-2 py-1 text-[10px] bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              {copied === 'manifest' ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-purple-500 uppercase tracking-wider font-medium">Webhook Receiver</p>
              <p className="text-xs font-mono text-purple-900 mt-0.5">{webhookEndpoint}</p>
            </div>
            <button
              onClick={() => copyToClipboard(webhookEndpoint, 'webhook')}
              className="px-2 py-1 text-[10px] bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
            >
              {copied === 'webhook' ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-emerald-600 uppercase tracking-wider font-medium">External Buyer Agent</p>
              <p className="text-xs font-mono text-emerald-900 mt-0.5">{externalBuyerCmd}</p>
            </div>
            <button
              onClick={() => copyToClipboard(externalBuyerCmd, 'buyer')}
              className="px-2 py-1 text-[10px] bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors"
            >
              {copied === 'buyer' ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="text-[10px] text-gray-400 leading-relaxed">
          Any MCP client (Claude Desktop, Claude Code, or a standalone agent) can discover, browse, and transact — bounded by the same 6-check policy gateway. The external buyer demo runs from a separate process with zero shared code.
        </div>
      </div>
    </div>
  );
}
