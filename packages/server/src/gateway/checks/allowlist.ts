import type { Proposal, PolicyCheckResult } from '../../agents/types.js';
import type { PolicyConfig } from '../policy-config.js';

export function checkAllowlist(proposal: Proposal, policy: PolicyConfig): PolicyCheckResult {
  // Category allowlist check (applies to all agents)
  if (policy.category_allowlist.length > 0) {
    const categoryAllowed = policy.category_allowlist.includes(proposal.category);
    if (!categoryAllowed) {
      return {
        check_name: 'allowlist',
        passed: false,
        detail: `Category "${proposal.category}" is not in allowed categories: [${policy.category_allowlist.join(', ')}]`,
      };
    }
  }

  // Merchant allowlist check (for buyer agent proposals with a counterparty)
  if (proposal.agent_type === 'buyer' && policy.merchant_allowlist.length > 0) {
    const merchantAllowed = policy.merchant_allowlist.includes(proposal.counterparty);
    if (!merchantAllowed) {
      return {
        check_name: 'allowlist',
        passed: false,
        detail: `Counterparty "${proposal.counterparty}" is not in merchant allowlist`,
      };
    }
  }

  return {
    check_name: 'allowlist',
    passed: true,
    detail: `Category "${proposal.category}" is in allowed list`,
  };
}
