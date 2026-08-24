import type { Proposal, Decision } from '../agents/types.js';

export function generateExplanation(proposal: Proposal, decision: Decision): string {
  const amount = `₹${(proposal.amount_paise / 100).toFixed(0)}`;
  const agent = `${proposal.agent_type}-agent`;

  if (decision.verdict === 'denied') {
    const failedCheck = decision.checks.find(c => !c.passed);
    const reasonMap: Record<string, string> = {
      MANDATE_EXPIRED: `Denied: no valid mandate for ${agent}.`,
      PER_TRANSACTION_CAP_EXCEEDED: `Denied: proposed ${amount} exceeds per-transaction cap for ${agent}.`,
      VELOCITY_CAP_EXCEEDED: `Denied: daily spending/transaction limit would be breached by this ${amount} proposal.`,
      CATEGORY_NOT_ALLOWED: `Denied: category "${proposal.category}" is not in the merchant's allowed categories for ${agent}.`,
      MERCHANT_NOT_ALLOWED: `Denied: counterparty "${proposal.counterparty}" is not in the merchant allowlist.`,
      DISCOUNT_CEILING_EXCEEDED: `Denied: discount of ${proposal.discount_pct}% exceeds the ${failedCheck?.detail || 'ceiling'}.`,
      DUPLICATE_DETECTED: `Denied: duplicate proposal detected — same action recently submitted by ${agent}.`,
    };

    return reasonMap[decision.reason_code] || `Denied: ${decision.reason_text}`;
  }

  const actionMap: Record<string, string> = {
    create_payment_link: `Approved and executed: ${amount} payment link created`,
    create_order: `Approved and executed: ${amount} order created`,
    create_refund: `Approved and executed: ${amount} refund initiated`,
  };

  const base = actionMap[proposal.action] || `Approved and executed: ${proposal.action} for ${amount}`;
  const context = proposal.agent_type === 'growth'
    ? proposal.original_order_id
      ? ` for cart recovery (order ${proposal.original_order_id})`
      : ' for upsell/cross-sell'
    : ` by ${agent}`;

  return `${base}${context}.`;
}
