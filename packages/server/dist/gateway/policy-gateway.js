import { getPolicyConfig } from './policy-config.js';
import { checkMandate } from './checks/mandate.js';
import { checkPerTransactionCap } from './checks/per-transaction-cap.js';
import { checkVelocityCap } from './checks/velocity-cap.js';
import { checkAllowlist } from './checks/allowlist.js';
import { checkDiscountCeiling } from './checks/discount-ceiling.js';
import { checkIdempotency } from './checks/idempotency.js';
import { executeOnRazorpay } from '../razorpay/execution.js';
import { writeLedgerEntry } from '../ledger/ledger.js';
const REASON_CODES = {
    mandate: 'MANDATE_EXPIRED',
    per_transaction_cap: 'PER_TRANSACTION_CAP_EXCEEDED',
    velocity_cap: 'VELOCITY_CAP_EXCEEDED',
    allowlist: 'CATEGORY_NOT_ALLOWED',
    discount_ceiling: 'DISCOUNT_CEILING_EXCEEDED',
    idempotency: 'DUPLICATE_DETECTED',
};
function getReasonCode(check) {
    if (check.check_name === 'mandate' && check.detail.includes('scope exceeded')) {
        return 'MANDATE_SCOPE_EXCEEDED';
    }
    return REASON_CODES[check.check_name] || 'POLICY_CHECK_FAILED';
}
export async function processProposal(proposal) {
    const policy = getPolicyConfig(proposal.merchant_id);
    const checks = [];
    // Run checks in order, stop at first failure
    const checkFns = [
        () => checkMandate(proposal),
        () => checkPerTransactionCap(proposal, policy),
        () => checkVelocityCap(proposal, policy),
        () => checkAllowlist(proposal, policy),
        () => checkDiscountCeiling(proposal, policy),
        () => checkIdempotency(proposal),
    ];
    let failedCheck = null;
    for (const runCheck of checkFns) {
        const result = runCheck();
        checks.push(result);
        if (!result.passed) {
            failedCheck = result;
            break;
        }
    }
    const now = new Date().toISOString();
    // --- DENIED path ---
    if (failedCheck) {
        const decision = {
            proposal_id: proposal.proposal_id,
            verdict: 'denied',
            reason_code: getReasonCode(failedCheck),
            reason_text: failedCheck.detail,
            checks,
            checked_at: now,
        };
        const outcome = {
            proposal_id: proposal.proposal_id,
            razorpay_action: null,
            razorpay_response: null,
            final_status: 'denied',
            executed_at: now,
        };
        const ledgerRow = writeLedgerEntry(proposal, checks, decision, outcome);
        return { decision, outcome, ledgerRow };
    }
    // --- APPROVED path: execute on Razorpay ---
    const decision = {
        proposal_id: proposal.proposal_id,
        verdict: 'approved',
        reason_code: 'ALL_CHECKS_PASSED',
        reason_text: 'All policy checks passed',
        checks,
        checked_at: now,
    };
    const razorpayParams = buildRazorpayParams(proposal);
    const executionResult = await executeOnRazorpay(proposal.action, razorpayParams);
    let outcome;
    if (executionResult.success) {
        outcome = {
            proposal_id: proposal.proposal_id,
            razorpay_action: proposal.action,
            razorpay_response: executionResult.razorpay_response,
            final_status: 'executed',
            executed_at: new Date().toISOString(),
        };
    }
    else {
        outcome = {
            proposal_id: proposal.proposal_id,
            razorpay_action: proposal.action,
            razorpay_response: null,
            final_status: 'error',
            executed_at: new Date().toISOString(),
            error_message: executionResult.error,
        };
    }
    const ledgerRow = writeLedgerEntry(proposal, checks, decision, outcome);
    return { decision, outcome, ledgerRow };
}
function buildRazorpayParams(proposal) {
    switch (proposal.action) {
        case 'create_payment_link':
            return {
                amount: proposal.amount_paise,
                currency: proposal.currency,
                description: proposal.description || `Payment for ${proposal.category} items`,
                notes: {
                    proposal_id: proposal.proposal_id,
                    agent_type: proposal.agent_type,
                    category: proposal.category,
                },
            };
        case 'create_order':
            return {
                amount: proposal.amount_paise,
                currency: proposal.currency,
                receipt: `vyapar_${proposal.proposal_id}`,
                notes: {
                    proposal_id: proposal.proposal_id,
                    agent_type: proposal.agent_type,
                    category: proposal.category,
                },
            };
        case 'create_refund':
            return {
                payment_id: proposal.original_order_id || '',
                amount: proposal.amount_paise,
                notes: {
                    proposal_id: proposal.proposal_id,
                    agent_type: proposal.agent_type,
                    reason: proposal.agent_reasoning,
                },
            };
        default:
            return { amount: proposal.amount_paise, currency: proposal.currency };
    }
}
