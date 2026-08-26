import { v4 as uuidv4 } from 'uuid';
import { callLlm } from './llm-client.js';
import { processProposal } from '../gateway/policy-gateway.js';
import { ProposalSchema } from './types.js';
import { getAllCatalogItems } from '../catalog/catalog.js';
import { getPolicyConfig } from '../gateway/policy-config.js';
const SYSTEM_PROMPT = `You are an external AI Buyer Agent shopping on behalf of a customer at a D2C skincare/wellness store called Vyapar.

YOUR ROLE:
You represent an external AI buyer — you are NOT part of this merchant's system. You are demonstrating that any AI agent can transact with this merchant through their agent-readable catalog and structured proposal system.

YOU MUST NOT:
- Access payment systems directly
- Make any financial transactions yourself
- Bypass the policy gateway

YOU CAN ONLY:
- Browse the catalog using the browse_catalog tool
- Submit purchase proposals using the submit_proposal tool

WORKFLOW:
1. Use browse_catalog to see available products
2. Analyze the customer's request against available items
3. Pick the best matching product(s)
4. Submit a proposal to purchase via submit_proposal

GUIDELINES:
- Always browse the catalog first before proposing
- The amount_paise must match the catalog price exactly (no discounts — you're a buyer, not the merchant)
- Category must match the product's category from the catalog
- If a proposal is denied, explain the denial clearly to the customer and suggest alternatives

IMPORTANT: amount_paise is in paise (100 paise = ₹1)`;
const BROWSE_CATALOG_TOOL = {
    name: 'browse_catalog',
    description: 'Browse the merchant catalog to see available products. Returns all active products with their prices, categories, stock levels, and related product suggestions.',
    inputSchema: {
        type: 'object',
        properties: {
            category: { type: 'string', description: 'Optional: filter by category (skincare, haircare, bodycare, wellness, accessories)' },
        },
        required: [],
    },
};
const SUBMIT_PROPOSAL_TOOL = {
    name: 'submit_proposal',
    description: 'Submit a purchase proposal to the Policy Gateway. This is the ONLY way to make a purchase. The gateway checks the proposal against merchant policies and either approves (creating the order/payment on Razorpay) or denies it with a reason.',
    inputSchema: {
        type: 'object',
        properties: {
            agent_reasoning: { type: 'string', description: 'Your reasoning for this purchase proposal' },
            action: { type: 'string', enum: ['create_payment_link', 'create_order'], description: 'The action to perform' },
            amount_paise: { type: 'number', description: 'Amount in paise (100 paise = ₹1). Must match catalog price.' },
            counterparty: { type: 'string', description: 'Customer identifier' },
            category: { type: 'string', description: 'Product category from catalog' },
            description: { type: 'string', description: 'Description of what is being purchased' },
            item_ids: { type: 'array', items: { type: 'string' }, description: 'Catalog item IDs being purchased' },
        },
        required: ['agent_reasoning', 'action', 'amount_paise', 'counterparty', 'category', 'description'],
    },
};
export async function runBuyerAgent(shoppingRequest) {
    const policy = getPolicyConfig('default');
    const userMessage = `SHOPPING REQUEST FROM CUSTOMER:
"${shoppingRequest}"

MERCHANT POLICY CONTEXT (for your awareness — these are enforced by the gateway, not by you):
- Max per transaction: ₹${policy.max_per_transaction_paise / 100}
- Allowed categories: ${policy.category_allowlist.join(', ')}

Please help this customer shop. Start by browsing the catalog, then propose a purchase for the best matching item.`;
    const messages = [{ role: 'user', content: [{ text: userMessage }] }];
    const result = {
        reasoning: '',
        proposal: null,
        decision: null,
        outcome: null,
        agentResponse: '',
    };
    // Agent loop (max 5 turns for: browse → propose → handle result → respond)
    for (let turn = 0; turn < 5; turn++) {
        const response = await callLlm(SYSTEM_PROMPT, messages, [BROWSE_CATALOG_TOOL, SUBMIT_PROPOSAL_TOOL]);
        if (response.text) {
            result.agentResponse = response.text;
            result.reasoning = response.text;
        }
        if (response.toolCalls.length === 0)
            break;
        // Build assistant message with all tool uses
        const assistantContent = [];
        if (response.text)
            assistantContent.push({ text: response.text });
        for (const tc of response.toolCalls) {
            assistantContent.push({ toolUse: { toolUseId: tc.toolUseId, name: tc.name, input: tc.input } });
        }
        messages.push({ role: 'assistant', content: assistantContent });
        // Process each tool call and build user message with results
        const toolResults = [];
        for (const toolCall of response.toolCalls) {
            if (toolCall.name === 'browse_catalog') {
                const catalog = getAllCatalogItems();
                const categoryFilter = toolCall.input.category;
                const items = categoryFilter
                    ? catalog.filter(i => i.category === categoryFilter)
                    : catalog;
                const catalogData = items.map(i => ({
                    id: i.id,
                    name: i.title,
                    description: i.description,
                    price: `₹${i.price_paise / 100}`,
                    price_paise: i.price_paise,
                    category: i.category,
                    stock: i.stock,
                    pairs_with: i.pairs_with_ids,
                }));
                toolResults.push({
                    toolResult: {
                        toolUseId: toolCall.toolUseId,
                        content: [{ text: JSON.stringify(catalogData, null, 2) }],
                    },
                });
            }
            else if (toolCall.name === 'submit_proposal') {
                const input = toolCall.input;
                const proposal = ProposalSchema.parse({
                    proposal_id: `prop_buyer_${uuidv4().slice(0, 8)}`,
                    agent_type: 'buyer',
                    agent_reasoning: input.agent_reasoning,
                    action: input.action,
                    amount_paise: input.amount_paise,
                    currency: 'INR',
                    merchant_id: 'default',
                    counterparty: input.counterparty || 'buyer_agent_session',
                    category: input.category,
                    requested_at: new Date().toISOString(),
                    description: input.description,
                    item_ids: input.item_ids,
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
                toolResults.push({
                    toolResult: {
                        toolUseId: toolCall.toolUseId,
                        content: [{
                                text: JSON.stringify({
                                    verdict: gatewayResult.decision.verdict,
                                    reason_code: gatewayResult.decision.reason_code,
                                    reason_text: gatewayResult.decision.reason_text,
                                    explanation: gatewayResult.ledgerRow.human_readable_explanation,
                                }),
                            }],
                    },
                });
            }
        }
        messages.push({ role: 'user', content: toolResults });
    }
    return result;
}
