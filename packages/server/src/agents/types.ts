import { z } from 'zod';

// --- Proposal: what an agent wants to do ---

export const ProposalSchema = z.object({
  proposal_id: z.string(),
  agent_type: z.enum(['growth', 'buyer']),
  agent_reasoning: z.string(),
  action: z.enum(['create_payment_link', 'create_order', 'create_refund']),
  amount_paise: z.number().int().positive(),
  currency: z.string().default('INR'),
  merchant_id: z.string().default('default'),
  counterparty: z.string(),
  category: z.string(),
  requested_at: z.string(),
  // Optional fields for specific actions
  description: z.string().optional(),
  discount_pct: z.number().min(0).max(100).optional(),
  original_order_id: z.string().optional(),
  item_ids: z.array(z.string()).optional(),
  triggered_by: z.enum(['simulated_button', 'webhook', 'mcp_external', 'internal']).optional(),
});

export type Proposal = z.infer<typeof ProposalSchema>;

// --- PolicyCheckResult: outcome of a single policy check ---

export const PolicyCheckResultSchema = z.object({
  check_name: z.string(),
  passed: z.boolean(),
  detail: z.string(),
});

export type PolicyCheckResult = z.infer<typeof PolicyCheckResultSchema>;

// --- Decision: the gateway's verdict on a proposal ---

export const DecisionSchema = z.object({
  proposal_id: z.string(),
  verdict: z.enum(['approved', 'denied']),
  reason_code: z.string(),
  reason_text: z.string(),
  checks: z.array(PolicyCheckResultSchema),
  checked_at: z.string(),
});

export type Decision = z.infer<typeof DecisionSchema>;

// --- Outcome: what happened after the decision ---

export const OutcomeSchema = z.object({
  proposal_id: z.string(),
  razorpay_action: z.string().nullable(),
  razorpay_response: z.unknown().nullable(),
  final_status: z.enum(['executed', 'denied', 'error']),
  executed_at: z.string(),
  error_message: z.string().optional(),
});

export type Outcome = z.infer<typeof OutcomeSchema>;

// --- LedgerEntry: complete record of a proposal's lifecycle ---

export const LedgerEntrySchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  agent_type: z.enum(['growth', 'buyer']),
  proposal: ProposalSchema,
  checks: z.array(PolicyCheckResultSchema),
  decision: DecisionSchema,
  outcome: OutcomeSchema.nullable(),
  human_readable_explanation: z.string(),
  amount_paise: z.number(),
  category: z.string().nullable(),
});

export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;
