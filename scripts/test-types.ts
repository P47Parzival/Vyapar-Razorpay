import { ProposalSchema, DecisionSchema, OutcomeSchema } from '../packages/server/src/agents/types.js';

const proposal = ProposalSchema.parse({
  proposal_id: 'prop_test_001',
  agent_type: 'buyer',
  agent_reasoning: 'Customer wants a face wash under 500 rupees',
  action: 'create_payment_link',
  amount_paise: 45000,
  currency: 'INR',
  merchant_id: 'default',
  counterparty: 'buyer_agent_session_1',
  category: 'skincare',
  requested_at: new Date().toISOString(),
  item_ids: ['item_001'],
});
console.log('Proposal validates:', proposal.proposal_id, '| agent:', proposal.agent_type, '| amount:', proposal.amount_paise);

const decision = DecisionSchema.parse({
  proposal_id: 'prop_test_001',
  verdict: 'approved',
  reason_code: 'ALL_CHECKS_PASSED',
  reason_text: 'All policy checks passed',
  checks: [
    { check_name: 'per_transaction_cap', passed: true, detail: '45000 <= 300000' },
    { check_name: 'velocity_cap', passed: true, detail: 'Daily total 45000 <= 1000000' },
  ],
  checked_at: new Date().toISOString(),
});
console.log('Decision validates:', decision.verdict, '| checks:', decision.checks.length);

const outcome = OutcomeSchema.parse({
  proposal_id: 'prop_test_001',
  razorpay_action: 'create_payment_link',
  razorpay_response: { id: 'plink_xxx', short_url: 'https://rzp.io/xxx' },
  final_status: 'executed',
  executed_at: new Date().toISOString(),
});
console.log('Outcome validates:', outcome.final_status);

try {
  ProposalSchema.parse({ proposal_id: 'bad', agent_type: 'invalid' });
} catch (e: any) {
  console.log('Validation correctly rejects invalid agent_type:', e.errors[0].message);
}

console.log('\nAll types compile and validate correctly.');
