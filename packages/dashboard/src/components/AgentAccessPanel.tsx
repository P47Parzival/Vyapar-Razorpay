import { useState } from 'react';

export default function AgentAccessPanel() {
  const [copied, setCopied] = useState<string | null>(null);

  const host = window.location.hostname + ':3001';
  const baseUrl = `http://${host}`;
  const manifestUrl = `${baseUrl}/.well-known/agent-commerce.json`;
  const mcpEndpoint = `${baseUrl}/mcp`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Agent Access</h2>
        <p className="text-xs text-gray-500 mt-0.5">Any MCP-capable AI agent can transact with this merchant</p>
      </div>

      <div className="p-4 space-y-3">
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

        <div className="text-[10px] text-gray-400 leading-relaxed">
          Point any MCP client (Claude Desktop, Claude Code, or another agent) at the MCP endpoint to browse, propose, and transact — bounded by the same policy gateway.
        </div>
      </div>
    </div>
  );
}
