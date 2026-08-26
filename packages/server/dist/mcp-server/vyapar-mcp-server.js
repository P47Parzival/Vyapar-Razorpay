import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { getAllCatalogItems, getCatalogItem } from '../catalog/catalog.js';
import { processProposal } from '../gateway/policy-gateway.js';
import { ProposalSchema } from '../agents/types.js';
import { getLedgerEntries } from '../ledger/ledger.js';
const transports = {};
function createMcpServer() {
    const server = new McpServer({ name: 'vyapar-merchant', version: '1.0.0' }, { capabilities: {} });
    server.registerTool('browse_catalog', {
        title: 'Browse Catalog',
        description: 'Browse the merchant catalog. Returns all active products with prices, categories, stock levels, and related product suggestions.',
        inputSchema: {
            category: z.string().optional().describe('Optional: filter by category (skincare, haircare, bodycare, wellness, accessories)'),
        },
    }, async ({ category }) => {
        const items = getAllCatalogItems();
        const filtered = category ? items.filter(i => i.category === category) : items;
        const catalog = filtered.map(i => ({
            id: i.id,
            name: i.title,
            description: i.description,
            price_rupees: i.price_paise / 100,
            price_paise: i.price_paise,
            category: i.category,
            stock: i.stock,
            pairs_with: i.pairs_with_ids,
        }));
        return {
            content: [{ type: 'text', text: JSON.stringify(catalog, null, 2) }],
        };
    });
    server.registerTool('get_product', {
        title: 'Get Product',
        description: 'Get details of a single product by ID.',
        inputSchema: {
            id: z.string().describe('The product ID (e.g. item_001)'),
        },
    }, async ({ id }) => {
        const item = getCatalogItem(id);
        if (!item) {
            return {
                content: [{ type: 'text', text: JSON.stringify({ error: 'Product not found' }) }],
                isError: true,
            };
        }
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        id: item.id,
                        name: item.title,
                        description: item.description,
                        price_rupees: item.price_paise / 100,
                        price_paise: item.price_paise,
                        category: item.category,
                        stock: item.stock,
                        pairs_with: item.pairs_with_ids,
                    }, null, 2),
                }],
        };
    });
    server.registerTool('submit_purchase_proposal', {
        title: 'Submit Purchase Proposal',
        description: 'Submit a purchase proposal to the Policy Gateway. The gateway checks the proposal against merchant policies (spending caps, velocity limits, category allowlists, mandate validity) and either approves (executing on Razorpay test mode) or denies with a structured reason. This is the ONLY way to transact with this merchant.',
        inputSchema: {
            mandate_token: z.string().describe('Mandate token (mandate ID) authorizing this agent to transact'),
            action: z.enum(['create_payment_link', 'create_order']).describe('The Razorpay action to perform'),
            amount_paise: z.number().describe('Amount in paise (100 paise = ₹1). Must match catalog price.'),
            category: z.string().describe('Product category from catalog'),
            counterparty: z.string().describe('Identifier of the buyer/customer'),
            agent_reasoning: z.string().describe('Reasoning for this purchase proposal'),
            description: z.string().optional().describe('Description of what is being purchased'),
            item_ids: z.array(z.string()).optional().describe('Catalog item IDs being purchased'),
        },
    }, async ({ mandate_token, action, amount_paise, category, counterparty, agent_reasoning, description, item_ids }) => {
        if (!mandate_token || mandate_token.trim() === '') {
            return {
                content: [{ type: 'text', text: JSON.stringify({ error: 'mandate_token is required' }) }],
                isError: true,
            };
        }
        try {
            const proposal = ProposalSchema.parse({
                proposal_id: `prop_ext_${randomUUID().slice(0, 8)}`,
                agent_type: 'buyer',
                agent_reasoning,
                action,
                amount_paise,
                currency: 'INR',
                merchant_id: 'default',
                counterparty: counterparty || 'external_agent',
                category,
                requested_at: new Date().toISOString(),
                description: description || `External agent purchase: ${category}`,
                item_ids: item_ids || [],
            });
            const result = await processProposal(proposal);
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            proposal_id: proposal.proposal_id,
                            verdict: result.decision.verdict,
                            reason_code: result.decision.reason_code,
                            reason_text: result.decision.reason_text,
                            final_status: result.outcome.final_status,
                            explanation: result.ledgerRow.human_readable_explanation,
                            razorpay_response: result.outcome.razorpay_response || null,
                        }, null, 2),
                    }],
            };
        }
        catch (err) {
            const error = err;
            return {
                content: [{ type: 'text', text: JSON.stringify({ error: error.message }) }],
                isError: true,
            };
        }
    });
    server.registerTool('check_proposal_status', {
        title: 'Check Proposal Status',
        description: 'Look up the status of a previously submitted proposal by its proposal_id. Returns the decision and outcome.',
        inputSchema: {
            proposal_id: z.string().describe('The proposal ID returned from submit_purchase_proposal'),
        },
    }, async ({ proposal_id }) => {
        const entries = getLedgerEntries(100);
        const entry = entries.find(e => {
            const proposal = JSON.parse(e.proposal_json);
            return proposal.proposal_id === proposal_id;
        });
        if (!entry) {
            return {
                content: [{ type: 'text', text: JSON.stringify({ error: 'Proposal not found', proposal_id }) }],
                isError: true,
            };
        }
        const decision = JSON.parse(entry.decision_json);
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        proposal_id,
                        timestamp: entry.timestamp,
                        final_status: entry.final_status,
                        verdict: decision.verdict,
                        reason_code: decision.reason_code,
                        reason_text: decision.reason_text,
                        explanation: entry.human_readable_explanation,
                        amount_paise: entry.amount_paise,
                        category: entry.category,
                    }, null, 2),
                }],
        };
    });
    return server;
}
export async function handleMcpPost(req, res) {
    const sessionId = req.headers['mcp-session-id'];
    try {
        let transport;
        if (sessionId && transports[sessionId]) {
            transport = transports[sessionId];
        }
        else if (!sessionId && isInitializeRequest(req.body)) {
            transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
                onsessioninitialized: (sid) => {
                    transports[sid] = transport;
                },
            });
            transport.onclose = () => {
                const sid = transport.sessionId;
                if (sid && transports[sid]) {
                    delete transports[sid];
                }
            };
            const server = createMcpServer();
            await server.connect(transport);
            await transport.handleRequest(req, res, req.body);
            return;
        }
        else {
            res.status(400).json({
                jsonrpc: '2.0',
                error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
                id: null,
            });
            return;
        }
        await transport.handleRequest(req, res, req.body);
    }
    catch (error) {
        console.error('[MCP Server] Error:', error);
        if (!res.headersSent) {
            res.status(500).json({
                jsonrpc: '2.0',
                error: { code: -32603, message: 'Internal server error' },
                id: null,
            });
        }
    }
}
export async function handleMcpGet(req, res) {
    const sessionId = req.headers['mcp-session-id'];
    if (!sessionId || !transports[sessionId]) {
        res.status(400).send('Invalid or missing session ID');
        return;
    }
    await transports[sessionId].handleRequest(req, res);
}
export async function handleMcpDelete(req, res) {
    const sessionId = req.headers['mcp-session-id'];
    if (!sessionId || !transports[sessionId]) {
        res.status(400).send('Invalid or missing session ID');
        return;
    }
    await transports[sessionId].handleRequest(req, res);
}
