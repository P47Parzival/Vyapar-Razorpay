import type { Proposal, PolicyCheckResult } from '../../agents/types.js';
import type { PolicyConfig } from '../policy-config.js';
export declare function checkDiscountCeiling(proposal: Proposal, policy: PolicyConfig): PolicyCheckResult;
