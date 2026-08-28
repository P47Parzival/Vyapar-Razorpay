interface PolicyCheck {
  check_name: string;
  passed: boolean;
  detail: string;
}

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

interface Props {
  entry: LedgerEntry;
}

const CHECK_LABELS: Record<string, string> = {
  mandate: 'Active Mandate',
  per_transaction_cap: 'Per-Txn Cap',
  velocity_cap: 'Velocity Limit',
  allowlist: 'Category Allowlist',
  discount_ceiling: 'Discount Ceiling',
  idempotency: 'Idempotency',
};

export default function DecisionDetail({ entry }: Props) {
  const checks: PolicyCheck[] = JSON.parse(entry.checks_json);
  const proposal = JSON.parse(entry.proposal_json);
  const decision = JSON.parse(entry.decision_json);
  const itemIds: string[] = proposal.item_ids || [];
  const isShopifySource = itemIds.some((id: string) => id.startsWith('shopify_'));

  return (
    <div className="px-4 pb-4 pt-1 bg-gray-50 border-t border-gray-100">
      {/* Proposal summary */}
      <div className="mb-4">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Proposal</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="bg-white p-2 rounded border border-gray-200">
            <span className="text-[10px] text-gray-400 uppercase">Action</span>
            <p className="font-medium text-gray-900">{proposal.action?.replace(/_/g, ' ')}</p>
          </div>
          <div className="bg-white p-2 rounded border border-gray-200">
            <span className="text-[10px] text-gray-400 uppercase">Amount</span>
            <p className="font-mono font-medium text-gray-900">₹{(proposal.amount_paise / 100).toFixed(0)}</p>
          </div>
          <div className="bg-white p-2 rounded border border-gray-200">
            <span className="text-[10px] text-gray-400 uppercase">Category</span>
            <p className="font-medium text-gray-900">{proposal.category}</p>
          </div>
          <div className="bg-white p-2 rounded border border-gray-200">
            <span className="text-[10px] text-gray-400 uppercase">Agent</span>
            <p className="font-medium text-gray-900">{entry.agent_type}</p>
          </div>
        </div>
        {proposal.agent_reasoning && (
          <div className="mt-2 bg-white p-2 rounded border border-gray-200">
            <span className="text-[10px] text-gray-400 uppercase">Agent Reasoning</span>
            <p className="text-sm text-gray-700 mt-0.5">{proposal.agent_reasoning}</p>
          </div>
        )}
      </div>

      {/* Policy checks — ordered pipeline */}
      <div className="mb-4">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Policy Gateway Checks</h4>
        <div className="relative">
          <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-gray-200" />
          <div className="space-y-1.5">
            {checks.map((check, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 pl-1 py-1.5 px-2 rounded ${
                  check.passed
                    ? 'bg-green-50/60'
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                <div className={`relative z-10 flex-shrink-0 w-[22px] h-[22px] rounded-full flex items-center justify-center text-xs font-bold ${
                  check.passed
                    ? 'bg-green-500 text-white'
                    : 'bg-red-500 text-white'
                }`}>
                  {check.passed ? '✓' : '✗'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {CHECK_LABELS[check.check_name] || check.check_name.replace(/_/g, ' ')}
                    </span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      check.passed
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {check.passed ? 'PASS' : 'FAIL'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{check.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Decision */}
      <div className="mb-3">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Decision</h4>
        <div className={`p-3 rounded-lg border ${
          decision.verdict === 'approved'
            ? 'bg-green-50 border-green-200'
            : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-sm font-bold ${
              decision.verdict === 'approved' ? 'text-green-700' : 'text-red-700'
            }`}>
              {decision.verdict.toUpperCase()}
            </span>
            {decision.reason_code && (
              <code className="text-[10px] bg-white/70 border border-gray-200 px-1.5 py-0.5 rounded font-mono">
                {decision.reason_code}
              </code>
            )}
          </div>
          {decision.reason_text && (
            <p className="text-sm text-gray-700">{decision.reason_text}</p>
          )}
        </div>
      </div>

      {/* Shopify pilot disclosure */}
      {isShopifySource && (
        <div className="mb-3 p-2.5 rounded-lg border border-orange-200 bg-orange-50">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">LIVE SHOPIFY</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-medium">TEST CHECKOUT</span>
          </div>
          <p className="text-[11px] text-gray-700 leading-relaxed">
            This purchase used Razorpay test-mode credentials — no real funds were transferred to the connected Shopify merchant. Product data was live from their store; payment settlement was not.
          </p>
        </div>
      )}

      {/* Footer metadata */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-200">
        <span className="text-[10px] text-gray-400 font-mono">ID: {entry.id}</span>
        <div className="flex items-center gap-1.5">
          {proposal.triggered_by && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
              proposal.triggered_by === 'webhook' ? 'bg-purple-50 text-purple-700 border-purple-200' :
              proposal.triggered_by === 'mcp_external' ? 'bg-cyan-50 text-cyan-700 border-cyan-200' :
              proposal.triggered_by === 'internal' ? 'bg-blue-50 text-blue-700 border-blue-200' :
              'bg-amber-50 text-amber-600 border-amber-200'
            }`}>
              {proposal.triggered_by === 'webhook' ? 'WEBHOOK' :
               proposal.triggered_by === 'mcp_external' ? 'MCP EXTERNAL' :
               proposal.triggered_by === 'internal' ? 'INTERNAL' : 'SIMULATED'}
            </span>
          )}
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200">
            TEST MODE
          </span>
        </div>
      </div>
    </div>
  );
}
