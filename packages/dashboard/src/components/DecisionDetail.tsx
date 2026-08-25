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

export default function DecisionDetail({ entry }: Props) {
  const checks: PolicyCheck[] = JSON.parse(entry.checks_json);
  const proposal = JSON.parse(entry.proposal_json);
  const decision = JSON.parse(entry.decision_json);

  return (
    <div className="px-4 pb-4 pt-1 bg-gray-50 border-t border-gray-100">
      {/* Proposal summary */}
      <div className="mb-3">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Proposal</h4>
        <div className="text-sm text-gray-700 space-y-0.5">
          <p><span className="font-medium">Action:</span> {proposal.action}</p>
          <p><span className="font-medium">Amount:</span> ₹{(proposal.amount_paise / 100).toFixed(0)}</p>
          <p><span className="font-medium">Category:</span> {proposal.category}</p>
          <p><span className="font-medium">Reasoning:</span> {proposal.agent_reasoning}</p>
        </div>
      </div>

      {/* Policy checks */}
      <div className="mb-3">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Policy Checks</h4>
        <div className="space-y-1">
          {checks.map((check, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 text-sm px-2 py-1 rounded ${
                check.passed ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
              }`}
            >
              <span className="font-mono text-xs">{check.passed ? '✓' : '✗'}</span>
              <span className="font-medium">{check.check_name.replace(/_/g, ' ')}</span>
              <span className="text-xs opacity-75 ml-auto">{check.detail}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Decision */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Decision</h4>
        <div className="text-sm text-gray-700">
          <p><span className="font-medium">Verdict:</span>{' '}
            <span className={decision.verdict === 'approved' ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold'}>
              {decision.verdict.toUpperCase()}
            </span>
          </p>
          {decision.reason_code && (
            <p><span className="font-medium">Code:</span>{' '}
              <code className="text-xs bg-gray-200 px-1 py-0.5 rounded">{decision.reason_code}</code>
            </p>
          )}
          {decision.reason_text && (
            <p><span className="font-medium">Detail:</span> {decision.reason_text}</p>
          )}
        </div>
      </div>

      {/* Entry ID for reference */}
      <div className="mt-2 pt-2 border-t border-gray-200">
        <span className="text-xs text-gray-400 font-mono">ID: {entry.id}</span>
      </div>
    </div>
  );
}
