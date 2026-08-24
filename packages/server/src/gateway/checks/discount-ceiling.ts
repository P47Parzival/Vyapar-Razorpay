import type { Proposal, PolicyCheckResult } from '../../agents/types.js';
import type { PolicyConfig } from '../policy-config.js';

export function checkDiscountCeiling(proposal: Proposal, policy: PolicyConfig): PolicyCheckResult {
  // Only applies to proposals that include a discount
  if (proposal.discount_pct === undefined || proposal.discount_pct === 0) {
    return {
      check_name: 'discount_ceiling',
      passed: true,
      detail: 'No discount applied — check not applicable',
    };
  }

  const passed = proposal.discount_pct <= policy.discount_ceiling_pct;

  return {
    check_name: 'discount_ceiling',
    passed,
    detail: passed
      ? `Discount ${proposal.discount_pct}% <= ceiling ${policy.discount_ceiling_pct}%`
      : `Discount ${proposal.discount_pct}% exceeds ceiling of ${policy.discount_ceiling_pct}%`,
  };
}
