import { v4 as uuidv4 } from 'uuid';
import { callLlm, buildToolResultMessage } from './llm-client.js';
import { processProposal } from '../gateway/policy-gateway.js';
import { ProposalSchema } from './types.js';
import { getAllCatalogItems } from '../catalog/catalog.js';
import { getPolicyConfig } from '../gateway/policy-config.js';
const SYSTEM_PROMPT = `You are the Merchant Growth Agent for Vyapar, a D2C skincare/wellness store. Your job is to grow revenue through cart recovery and upsell/cross-sell strategies.

YOU MUST NOT:
- Access payment systems directly
- Make any financial transactions yourself
- Bypass the policy gateway

YOU CAN ONLY:
- Analyze scenarios (abandoned carts, completed orders)
- Submit proposals via the submit_proposal tool

GUIDELINES:
- For cart recovery: propose a payment link for the abandoned amount, optionally with a small discount to incentivize completion
- For upsell/cross-sell: look at what was purchased and recommend complementary products from the catalog
- Keep discounts within the merchant's ceiling (provided in context)
- Always explain your reasoning clearly
- The amount_paise field must be in paise (100 paise = ₹1)
- category must be one of: skincare, haircare, bodycare, wellness, accessories

When you receive a denied response from submit_proposal, acknowledge the denial gracefully and explain what happened.`;
const SUBMIT_PROPOSAL_TOOL = {
    name: 'submit_proposal',
    description: 'Submit a proposal to the Policy Gateway for approval. This is the ONLY way to initiate any financial action. The gateway will check the proposal against merchant policies and either approve (executing the action on Razorpay) or deny it.',
    inputSchema: {
        type: 'object',
        properties: {
            agent_reasoning: { type: 'string', description: 'Your reasoning for this proposal' },
            action: { type: 'string', enum: ['create_payment_link', 'create_order'], description: 'The Razorpay action to perform' },
            amount_paise: { type: 'number', description: 'Amount in paise (100 paise = ₹1)' },
            counterparty: { type: 'string', description: 'Who this is for (e.g. customer ID or session)' },
            category: { type: 'string', description: 'Product category' },
            description: { type: 'string', description: 'Description for the payment link/order' },
            discount_pct: { type: 'number', description: 'Discount percentage applied (0 if none)' },
            original_order_id: { type: 'string', description: 'Original order ID for cart recovery' },
            item_ids: { type: 'array', items: { type: 'string' }, description: 'Catalog item IDs involved' },
        },
        required: ['agent_reasoning', 'action', 'amount_paise', 'counterparty', 'category', 'description'],
    },
};
export async function runGrowthAgent(scenario) {
    const merchantId = scenario.merchantId;
    const catalog = getAllCatalogItems(merchantId);
    const policy = getPolicyConfig(merchantId);
    let userMessage;
    if (scenario.type === 'cart_recovery') {
        userMessage = `SCENARIO: Cart Recovery

A customer abandoned their cart. Here are the details:
${JSON.stringify(scenario.context, null, 2)}

CATALOG (for cross-sell reference):
${JSON.stringify(catalog.map(i => ({ id: i.id, name: i.title, price: `₹${i.price_paise / 100}`, category: i.category, pairs_with: i.pairs_with_ids })), null, 2)}

POLICY LIMITS:
- Max per transaction: ₹${policy.max_per_transaction_paise / 100}
- Discount ceiling: ${policy.discount_ceiling_pct}%

Please analyze this abandoned cart and submit a proposal to recover the sale. You may offer a small discount (within the ceiling) to incentivize completion.`;
    }
    else {
        userMessage = `SCENARIO: Upsell/Cross-sell

A customer just completed an order. Here are the details:
${JSON.stringify(scenario.context, null, 2)}

CATALOG (look at pairs_with to find complementary products):
${JSON.stringify(catalog.map(i => ({ id: i.id, name: i.title, price: `₹${i.price_paise / 100}`, category: i.category, pairs_with: i.pairs_with_ids })), null, 2)}

POLICY LIMITS:
- Max per transaction: ₹${policy.max_per_transaction_paise / 100}
- Discount ceiling: ${policy.discount_ceiling_pct}%

Please analyze the completed order, identify a good cross-sell or upsell opportunity based on what was purchased and the catalog's pairs_with relationships, and submit a proposal.`;
    }
    const messages = [{ role: 'user', content: [{ text: userMessage }] }];
    const result = {
        reasoning: '',
        proposal: null,
        decision: null,
        outcome: null,
        agentResponse: '',
    };
    // Agent loop (max 3 turns to handle tool use → result → final response)
    for (let turn = 0; turn < 3; turn++) {
        const response = await callLlm(SYSTEM_PROMPT, messages, [SUBMIT_PROPOSAL_TOOL]);
        if (response.text) {
            result.agentResponse = response.text;
            result.reasoning = response.text;
        }
        if (response.toolCalls.length === 0)
            break;
        for (const toolCall of response.toolCalls) {
            if (toolCall.name === 'submit_proposal') {
                const input = toolCall.input;
                const triggeredBy = scenario.context.triggered_by || 'simulated_button';
                const proposal = ProposalSchema.parse({
                    proposal_id: `prop_growth_${uuidv4().slice(0, 8)}`,
                    agent_type: 'growth',
                    agent_reasoning: input.agent_reasoning,
                    action: input.action,
                    amount_paise: input.amount_paise,
                    currency: 'INR',
                    merchant_id: merchantId,
                    counterparty: input.counterparty || 'growth_agent_session',
                    category: input.category,
                    requested_at: new Date().toISOString(),
                    description: input.description,
                    discount_pct: input.discount_pct,
                    original_order_id: input.original_order_id,
                    item_ids: input.item_ids,
                    triggered_by: triggeredBy,
                });
                result.proposal = proposal;
                const gatewayResult = await processProposal(proposal);
                result.decision = {
                    verdict: gatewayResult.decision.verdict,
                    reason_code: gatewayResult.decision.reason_code,
                    reason_text: gatewayResult.decision.reason_text,
                };
                result.outcome = {
                    final_status: gatewayResult.outcome.final_status,
                    razorpay_response: gatewayResult.outcome.razorpay_response,
                };
                // Add assistant message with tool use, then tool result
                messages.push({
                    role: 'assistant',
                    content: [{ toolUse: { toolUseId: toolCall.toolUseId, name: toolCall.name, input: toolCall.input } }],
                });
                messages.push(buildToolResultMessage(toolCall.toolUseId, {
                    verdict: gatewayResult.decision.verdict,
                    reason_code: gatewayResult.decision.reason_code,
                    reason_text: gatewayResult.decision.reason_text,
                    explanation: gatewayResult.ledgerRow.human_readable_explanation,
                }));
            }
        }
    }
    return result;
}
