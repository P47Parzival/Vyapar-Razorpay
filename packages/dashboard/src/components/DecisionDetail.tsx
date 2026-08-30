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
    <div className="px-5 pb-5 pt-2 border-t" style={{ borderColor: 'var(--ledger-line)', background: 'rgba(0,0,0,0.015)' }}>
      {/* Proposal summary */}
      <div className="mb-4">
        <h4 className="font-body text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-2">Proposal</h4>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded border" style={{ borderColor: 'var(--ledger-line)' }}>
            <span className="font-body text-[10px] text-ink-muted uppercase">Action</span>
            <p className="font-body text-sm font-medium text-ink mt-0.5">{proposal.action?.replace(/_/g, ' ')}</p>
          </div>
          <div className="p-2.5 rounded border" style={{ borderColor: 'var(--ledger-line)' }}>
            <span className="font-body text-[10px] text-ink-muted uppercase">Amount</span>
            <p className="font-data text-sm font-medium text-ink mt-0.5">₹{(proposal.amount_paise / 100).toFixed(0)}</p>
          </div>
          <div className="p-2.5 rounded border" style={{ borderColor: 'var(--ledger-line)' }}>
            <span className="font-body text-[10px] text-ink-muted uppercase">Category</span>
            <p className="font-body text-sm font-medium text-ink mt-0.5">{proposal.category}</p>
          </div>
          <div className="p-2.5 rounded border" style={{ borderColor: 'var(--ledger-line)' }}>
            <span className="font-body text-[10px] text-ink-muted uppercase">Agent</span>
            <p className="font-body text-sm font-medium text-ink mt-0.5">{entry.agent_type}</p>
          </div>
        </div>
        {proposal.agent_reasoning && (
          <div className="mt-2 p-2.5 rounded border" style={{ borderColor: 'var(--ledger-line)' }}>
            <span className="font-body text-[10px] text-ink-muted uppercase">Agent Reasoning</span>
            <p className="font-body text-sm text-ink mt-0.5">{proposal.agent_reasoning}</p>
          </div>
        )}
      </div>

      {/* Policy checks */}
      <div className="mb-4">
        <h4 className="font-body text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-2">Policy Gateway Checks</h4>
        <div className="space-y-1">
          {checks.map((check, i) => (
            <div
              key={i}
              className="flex items-center gap-3 py-2 px-3 rounded"
              style={{ background: check.passed ? 'rgba(31,111,74,0.04)' : 'rgba(162,59,46,0.06)' }}
            >
              <div className={`seal ${check.passed ? 'seal-approved' : 'seal-denied'}`}
                   style={{ width: 20, height: 20, fontSize: 10 }}>
                {check.passed ? '✓' : '✗'}
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-body text-sm font-medium text-ink">
                  {CHECK_LABELS[check.check_name] || check.check_name.replace(/_/g, ' ')}
                </span>
                <p className="font-body text-xs text-ink-muted truncate">{check.detail}</p>
              </div>
              <span className="font-data text-[10px] text-ink-muted flex-shrink-0">
                {check.passed ? 'PASS' : 'FAIL'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Decision */}
      <div className="mb-3">
        <h4 className="font-body text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-2">Decision</h4>
        <div className="p-3 rounded border" style={{
          borderColor: decision.verdict === 'approved' ? 'var(--seal-green)' : 'var(--seal-red)',
          background: decision.verdict === 'approved' ? 'rgba(31,111,74,0.04)' : 'rgba(162,59,46,0.04)',
        }}>
          <div className="flex items-center gap-2 mb-1">
            <span className={`font-body text-sm font-semibold ${
              decision.verdict === 'approved' ? 'text-seal-green' : 'text-seal-red'
            }`}>
              {decision.verdict.toUpperCase()}
            </span>
            {decision.reason_code && (
              <span className="font-data text-[10px] text-ink-muted px-1.5 py-0.5 rounded border" style={{ borderColor: 'var(--ledger-line)' }}>
                {decision.reason_code}
              </span>
            )}
          </div>
          {decision.reason_text && (
            <p className="font-body text-sm text-ink">{decision.reason_text}</p>
          )}
        </div>
      </div>

      {/* Shopify pilot disclosure */}
      {isShopifySource && (
        <div className="mb-3 p-3 rounded border" style={{ borderColor: 'var(--ledger-line)' }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-data text-[10px] text-seal-green">live catalog</span>
            <span className="font-data text-[10px] text-ink-muted">test checkout</span>
          </div>
          <p className="font-body text-xs text-ink-muted leading-relaxed">
            This purchase used Razorpay test-mode credentials — no real funds were transferred to the connected Shopify merchant. Product data was live from their store; payment settlement was not.
          </p>
        </div>
      )}

      {/* Footer metadata */}
      <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--ledger-line)' }}>
        <span className="font-data text-[10px] text-ink-muted">{entry.id}</span>
        <span className="font-data text-[10px] text-ink-muted">test mode</span>
      </div>
    </div>
  );
}
