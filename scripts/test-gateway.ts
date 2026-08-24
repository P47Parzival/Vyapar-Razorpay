import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { processProposal } from '../packages/server/src/gateway/policy-gateway.js';
import { getLedgerEntries } from '../packages/server/src/ledger/ledger.js';
import type { Proposal } from '../packages/server/src/agents/types.js';

async function main() {
  console.log('=== Policy Gateway Test ===\n');

  // --- Proposal 1: Should be APPROVED (valid, within caps) ---
  console.log('--- Test 1: Valid proposal (should be APPROVED) ---');
  const proposal1: Proposal = {
    proposal_id: 'prop_test_approved_001',
    agent_type: 'buyer',
    agent_reasoning: 'Customer wants to buy Gentle Face Wash for skincare routine',
    action: 'create_payment_link',
    amount_paise: 45000, // ₹450 — well under ₹3,000 cap
    currency: 'INR',
    merchant_id: 'default',
    counterparty: 'buyer_session_001',
    category: 'skincare', // in allowlist
    requested_at: new Date().toISOString(),
    description: 'Purchase: Gentle Face Wash',
    item_ids: ['item_001'],
  };

  const result1 = await processProposal(proposal1);
  console.log(`Verdict: ${result1.decision.verdict}`);
  console.log(`Reason: ${result1.decision.reason_code}`);
  console.log(`Status: ${result1.outcome.final_status}`);
  console.log(`Explanation: ${result1.ledgerRow.human_readable_explanation}`);
  if (result1.outcome.razorpay_response) {
    const content = result1.outcome.razorpay_response as { content?: Array<{ text?: string }> };
    if (content?.content?.[0]?.text) {
      const parsed = JSON.parse(content.content[0].text);
      console.log(`Razorpay Payment Link: ${parsed.short_url || parsed.id}`);
    }
  }
  console.log('Checks:', result1.decision.checks.map(c => `${c.check_name}: ${c.passed ? '✓' : '✗'}`).join(', '));
  console.log('');

  // --- Proposal 2: Should be DENIED (exceeds per-transaction cap) ---
  console.log('--- Test 2: Over cap (should be DENIED — PER_TRANSACTION_CAP_EXCEEDED) ---');
  const proposal2: Proposal = {
    proposal_id: 'prop_test_denied_cap_001',
    agent_type: 'buyer',
    agent_reasoning: 'Customer wants premium bundle of Collagen Powder + Jade Roller + Brush Set',
    action: 'create_payment_link',
    amount_paise: 420000, // ₹4,200 — exceeds ₹3,000 cap
    currency: 'INR',
    merchant_id: 'default',
    counterparty: 'buyer_session_002',
    category: 'wellness',
    requested_at: new Date().toISOString(),
    description: 'Premium wellness bundle',
    item_ids: ['item_013', 'item_014', 'item_015'],
  };

  const result2 = await processProposal(proposal2);
  console.log(`Verdict: ${result2.decision.verdict}`);
  console.log(`Reason: ${result2.decision.reason_code}`);
  console.log(`Status: ${result2.outcome.final_status}`);
  console.log(`Explanation: ${result2.ledgerRow.human_readable_explanation}`);
  console.log('Checks:', result2.decision.checks.map(c => `${c.check_name}: ${c.passed ? '✓' : '✗'}`).join(', '));
  console.log('');

  // --- Proposal 3: Should be DENIED (category not in allowlist) ---
  console.log('--- Test 3: Bad category (should be DENIED — CATEGORY_NOT_ALLOWED) ---');
  const proposal3: Proposal = {
    proposal_id: 'prop_test_denied_category_001',
    agent_type: 'buyer',
    agent_reasoning: 'Customer wants electronics — a Bluetooth speaker',
    action: 'create_payment_link',
    amount_paise: 150000, // ₹1,500 — within cap
    currency: 'INR',
    merchant_id: 'default',
    counterparty: 'buyer_session_003',
    category: 'electronics', // NOT in allowlist
    requested_at: new Date().toISOString(),
    description: 'Bluetooth Speaker',
  };

  const result3 = await processProposal(proposal3);
  console.log(`Verdict: ${result3.decision.verdict}`);
  console.log(`Reason: ${result3.decision.reason_code}`);
  console.log(`Status: ${result3.outcome.final_status}`);
  console.log(`Explanation: ${result3.ledgerRow.human_readable_explanation}`);
  console.log('Checks:', result3.decision.checks.map(c => `${c.check_name}: ${c.passed ? '✓' : '✗'}`).join(', '));
  console.log('');

  // --- Verify ledger ---
  console.log('--- Ledger verification ---');
  const entries = getLedgerEntries(10);
  console.log(`Total ledger entries: ${entries.length}`);
  for (const entry of entries) {
    console.log(`  [${entry.final_status.toUpperCase()}] ${entry.human_readable_explanation}`);
  }

  console.log('\n=== All tests complete ===');
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
