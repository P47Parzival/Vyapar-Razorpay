// Multi-tenancy: merchant_id is threaded through every check via proposal.merchant_id → getPolicyConfig(merchantId).
// This demo runs a single tenant ('default') for clarity, but every check function is parameterized by merchant_id,
// not hardcoded. In a real deployment, one platform instance serves many merchants, each with their own policy,
// mandates, catalog, orders, and customers — the same way GoKwik serves hundreds of D2C brands from one layer.

import { randomUUID } from 'node:crypto';
import type { Proposal, Decision, PolicyCheckResult, Outcome } from '../agents/types.js';
import { getPolicyConfig } from './policy-config.js';
import { checkMandate } from './checks/mandate.js';
import { checkPerTransactionCap } from './checks/per-transaction-cap.js';
import { checkVelocityCap } from './checks/velocity-cap.js';
import { checkAllowlist } from './checks/allowlist.js';
import { checkDiscountCeiling } from './checks/discount-ceiling.js';
import { checkIdempotency } from './checks/idempotency.js';
import { executeOnRazorpay } from '../razorpay/execution.js';
import { writeLedgerEntry } from '../ledger/ledger.js';
import type { LedgerRow } from '../ledger/ledger.js';
import db from '../db/client.js';

interface GatewayResult {
  decision: Decision;
  outcome: Outcome;
  ledgerRow: LedgerRow;
  orderId?: string;
}

const REASON_CODES: Record<string, string> = {
  mandate: 'MANDATE_EXPIRED',
  per_transaction_cap: 'PER_TRANSACTION_CAP_EXCEEDED',
  velocity_cap: 'VELOCITY_CAP_EXCEEDED',
  allowlist: 'CATEGORY_NOT_ALLOWED',
  discount_ceiling: 'DISCOUNT_CEILING_EXCEEDED',
  idempotency: 'DUPLICATE_DETECTED',
};

function getReasonCode(check: PolicyCheckResult): string {
  if (check.check_name === 'mandate' && check.detail.includes('scope exceeded')) {
    return 'MANDATE_SCOPE_EXCEEDED';
  }
  return REASON_CODES[check.check_name] || 'POLICY_CHECK_FAILED';
}

export async function processProposal(proposal: Proposal): Promise<GatewayResult> {
  const policy = getPolicyConfig(proposal.merchant_id);

  // Pre-check: is agent commerce enabled for this merchant?
  if (!policy.agent_commerce_enabled) {
    const now = new Date().toISOString();
    const decision: Decision = {
      proposal_id: proposal.proposal_id,
      verdict: 'denied',
      reason_code: 'MERCHANT_NOT_OPTED_IN',
      reason_text: 'Agent commerce is disabled for this merchant. Enable it in the merchant settings.',
      checks: [],
      checked_at: now,
    };
    const outcome: Outcome = {
      proposal_id: proposal.proposal_id,
      razorpay_action: null,
      razorpay_response: null,
      final_status: 'denied',
      executed_at: now,
    };
    const ledgerRow = writeLedgerEntry(proposal, [], decision, outcome);
    return { decision, outcome, ledgerRow };
  }

  const checks: PolicyCheckResult[] = [];

  // Run checks in order, stop at first failure
  const checkFns = [
    () => checkMandate(proposal),
    () => checkPerTransactionCap(proposal, policy),
    () => checkVelocityCap(proposal, policy),
    () => checkAllowlist(proposal, policy),
    () => checkDiscountCeiling(proposal, policy),
    () => checkIdempotency(proposal),
  ];

  let failedCheck: PolicyCheckResult | null = null;

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
    const decision: Decision = {
      proposal_id: proposal.proposal_id,
      verdict: 'denied',
      reason_code: getReasonCode(failedCheck),
      reason_text: failedCheck.detail,
      checks,
      checked_at: now,
    };

    const outcome: Outcome = {
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
  const decision: Decision = {
    proposal_id: proposal.proposal_id,
    verdict: 'approved',
    reason_code: 'ALL_CHECKS_PASSED',
    reason_text: 'All policy checks passed',
    checks,
    checked_at: now,
  };

  const razorpayParams = buildRazorpayParams(proposal);
  const executionResult = await executeOnRazorpay(proposal.action, razorpayParams);

  let outcome: Outcome;

  if (executionResult.success) {
    outcome = {
      proposal_id: proposal.proposal_id,
      razorpay_action: proposal.action,
      razorpay_response: executionResult.razorpay_response,
      final_status: 'executed',
      executed_at: new Date().toISOString(),
    };
  } else {
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

  let orderId: string | undefined;
  if (outcome.final_status === 'executed') {
    try {
      orderId = recordOrderAndCustomer(proposal, ledgerRow.id, (proposal as any).related_order_id || null);
    } catch (err) {
      console.error('[Gateway] CRITICAL: Ledger row written but order/customer write failed:', err);
    }
  }

  return { decision, outcome, ledgerRow, orderId };
}

function getSourceFromProposal(proposal: Proposal): string {
  const tb = (proposal as any).triggered_by;
  if (tb === 'webhook') return 'webhook';
  if (tb === 'mcp_external') return 'external_mcp_client';
  if (tb === 'internal') return 'internal_buyer_agent';
  if (proposal.agent_type === 'growth') return 'internal_growth_agent';
  return 'internal_buyer_agent';
}

function recordOrderAndCustomer(proposal: Proposal, ledgerId: string, relatedOrderId: string | null): string {
  const now = new Date().toISOString();
  const identifier = proposal.counterparty || `anon_${randomUUID().slice(0, 8)}`;
  const source = getSourceFromProposal(proposal);

  const existingCustomer = db.prepare(
    'SELECT id FROM customers WHERE identifier = ?'
  ).get(identifier) as { id: string } | undefined;

  let customerId: string;

  if (existingCustomer) {
    customerId = existingCustomer.id;
    db.prepare(
      `UPDATE customers SET
        last_purchase_at = ?,
        total_spent_paise = total_spent_paise + ?,
        order_count = order_count + 1
      WHERE id = ?`
    ).run(now, proposal.amount_paise, customerId);
  } else {
    customerId = `cust_${randomUUID().slice(0, 12)}`;
    db.prepare(
      `INSERT INTO customers (id, identifier, first_seen_at, last_purchase_at, total_spent_paise, order_count)
       VALUES (?, ?, ?, ?, ?, 1)`
    ).run(customerId, identifier, now, now, proposal.amount_paise);
  }

  const orderId = `order_${randomUUID().slice(0, 12)}`;
  const itemIds = (proposal as any).item_ids || [];

  db.prepare(
    `INSERT INTO orders (id, customer_id, ledger_id, item_ids_json, amount_paise, category, source, related_order_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(orderId, customerId, ledgerId, JSON.stringify(itemIds), proposal.amount_paise, proposal.category, source, relatedOrderId, now);

  return orderId;
}

function buildRazorpayParams(proposal: Proposal): Record<string, unknown> {
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
