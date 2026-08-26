import type { Proposal, PolicyCheckResult } from '../../agents/types.js';
import type { PolicyConfig } from '../policy-config.js';
export declare function checkVelocityCap(proposal: Proposal, policy: PolicyConfig): PolicyCheckResult;
