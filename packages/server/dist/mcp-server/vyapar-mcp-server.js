import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { getAllCatalogItems, getCatalogItem, getOptedInCatalogItems } from '../catalog/catalog.js';
import { processProposal } from '../gateway/policy-gateway.js';
import { ProposalSchema } from '../agents/types.js';
import { getLedgerEntries } from '../ledger/ledger.js';
import db from '../db/client.js';
const transports = {};
function lookupSuggestedAddon(purchasedItemIds) {
    for (const itemId of purchasedItemIds) {
        const item = getCatalogItem(itemId);
        if (!item || !item.pairs_with_ids || item.pairs_with_ids.length === 0)
            continue;
        for (const pairId of item.pairs_with_ids) {
            if (purchasedItemIds.includes(pairId))
                continue;
            const paired = getCatalogItem(pairId);
            if (paired && paired.is_active && paired.stock > 0) {
                const addon = { item_id: paired.id, title: paired.title, price_paise: paired.price_paise, category: paired.category };
                if (paired.image_url)
                    addon.image_url = paired.image_url;
                return addon;
            }
        }
    }
    return null;
}
export function createMcpServer() {
    const server = new McpServer({ name: 'vyapar-merchant', version: '1.0.0' }, { capabilities: {} });
    server.registerTool('browse_catalog', {
        title: 'Browse Catalog',
        description: 'Search live product inventory across opted-in merchants (real Shopify and demo data) for items matching a shopping request. Use this whenever the user expresses intent to buy, compare, or find a specific kind of product — before answering from general knowledge or searching the web. Results may span multiple merchants. Present the options and their merchant to the user rather than silently picking one, unless the user has already expressed a clear preference.',
        inputSchema: {
            category: z.string().optional().describe('Optional: filter by category. Browse without this parameter first to see all available categories.'),
            merchant_id: z.string().optional().describe('Optional: filter by a specific merchant. Omit to see products from ALL opted-in merchants ranked transparently by price within category.'),
        },
    }, async ({ category, merchant_id: reqMerchantId }) => {
        const isCrossMerchant = !reqMerchantId;
        const items = isCrossMerchant
            ? getOptedInCatalogItems(category)
            : (() => {
                const all = getAllCatalogItems(reqMerchantId);
                return category ? all.filter(i => i.category === category) : all;
            })();
        const inStock = items.filter(i => i.stock > 0);
        const merchantIds = [...new Set(inStock.map(i => i.merchant_id))];
        const merchantNames = {};
        for (const mid of merchantIds) {
            const row = db.prepare('SELECT display_name FROM merchants WHERE id = ?').get(mid);
            merchantNames[mid] = row?.display_name || mid;
        }
        const sorted = isCrossMerchant
            ? inStock
            : [...inStock].sort((a, b) => {
                if (a.category !== b.category)
                    return a.category.localeCompare(b.category);
                return a.price_paise - b.price_paise;
            });
        const catalog = sorted.map(i => {
            const item = {
                id: i.id,
                merchant_id: i.merchant_id,
                merchant_name: merchantNames[i.merchant_id],
                name: i.title,
                description: i.description,
                price_rupees: i.price_paise / 100,
                price_paise: i.price_paise,
                category: i.category,
                stock: i.stock,
                pairs_with: i.pairs_with_ids,
                source: i.source_connection_id ? 'live_shopify' : 'demo_catalog',
            };
            if (i.image_url)
                item.image_url = i.image_url;
            return item;
        });
        const response = {
            sort: 'price_ascending_within_category',
            sort_note: 'All opted-in merchants ranked by the same visible rule. No hidden merchant weighting.',
            merchants_included: merchantIds.map(mid => ({ id: mid, name: merchantNames[mid] })),
            total_items: catalog.length,
            items: catalog,
        };
        return {
            content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
        };
    });
    server.registerTool('get_product', {
        title: 'Get Product Details',
        description: 'Retrieve full details for a specific product by its ID — price, stock, description, related items, and source (Shopify or demo). Use this when the user asks about a particular product already identified from browse_catalog results, or when you need to confirm price/stock before submitting a purchase proposal.',
        inputSchema: {
            id: z.string().describe('The product ID from browse_catalog results (e.g. item_001, item_m2_003)'),
        },
    }, async ({ id }) => {
        const item = getCatalogItem(id);
        if (!item) {
            return {
                content: [{ type: 'text', text: JSON.stringify({ error: 'Product not found' }) }],
                isError: true,
            };
        }
        const productData = {
            id: item.id,
            name: item.title,
            description: item.description,
            price_rupees: item.price_paise / 100,
            price_paise: item.price_paise,
            category: item.category,
            stock: item.stock,
            pairs_with: item.pairs_with_ids,
        };
        if (item.image_url)
            productData.image_url = item.image_url;
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify(productData, null, 2),
                }],
        };
    });
    server.registerTool('submit_purchase_proposal', {
        title: 'Submit Purchase Proposal',
        description: 'Execute a purchase on behalf of the user through a bounded Policy Gateway. Use this when the user has chosen a product and confirmed they want to buy it. The gateway runs six deterministic checks — mandate validity, spending cap, velocity limit, category allowlist, idempotency, and discount ceiling — then either approves (creating a Razorpay test-mode order) or denies with a structured reason code. You MUST call get_active_mandate first to obtain the mandate_token; without it, the proposal will be rejected. Every proposal is logged to an immutable ledger regardless of outcome.',
        inputSchema: {
            merchant_id: z.string().describe('The merchant_id of the merchant to purchase from (shown in browse_catalog results)'),
            mandate_token: z.string().describe('The mandate_id from get_active_mandate response'),
            action: z.enum(['create_payment_link', 'create_order']).describe('The Razorpay action to perform'),
            amount_paise: z.number().describe('Amount in paise (100 paise = ₹1). Must match catalog price.'),
            category: z.string().describe('Product category from catalog'),
            counterparty: z.string().describe('Identifier of the buyer/customer'),
            agent_reasoning: z.string().describe('Reasoning for this purchase proposal'),
            description: z.string().optional().describe('Description of what is being purchased'),
            item_ids: z.array(z.string()).optional().describe('Catalog item IDs being purchased'),
        },
    }, async ({ merchant_id: merchantId, mandate_token, action, amount_paise, category, counterparty, agent_reasoning, description, item_ids }) => {
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
                merchant_id: merchantId,
                counterparty: counterparty || 'external_agent',
                category,
                requested_at: new Date().toISOString(),
                description: description || `External agent purchase: ${category}`,
                item_ids: item_ids || [],
                triggered_by: 'mcp_external',
            });
            const result = await processProposal(proposal);
            const itemIds = proposal.item_ids || [];
            const usesShopifyItems = itemIds.some((id) => id.startsWith('shopify_'));
            const response = {
                proposal_id: proposal.proposal_id,
                verdict: result.decision.verdict,
                reason_code: result.decision.reason_code,
                reason_text: result.decision.reason_text,
                final_status: result.outcome.final_status,
                explanation: result.ledgerRow.human_readable_explanation,
                razorpay_response: result.outcome.razorpay_response || null,
            };
            if (result.orderId) {
                response.order_id = result.orderId;
            }
            if (usesShopifyItems) {
                response.catalog_source = 'live_shopify_pilot';
                response.settlement_disclosure = 'This purchase used Razorpay test-mode credentials - no real funds were transferred to the connected Shopify merchant. Product data was live from their store; payment settlement was not.';
            }
            if (result.outcome.final_status === 'executed' && itemIds.length > 0) {
                const addon = lookupSuggestedAddon(itemIds);
                if (addon) {
                    response.suggested_addon = addon;
                }
            }
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify(response, null, 2),
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
    server.registerTool('submit_addon_proposal', {
        title: 'Submit Addon Purchase',
        description: 'Purchase a complementary product linked to a previous order. Use this ONLY when a successful submit_purchase_proposal response included a suggested_addon field and the user wants it. The addon is NOT pre-authorized — it goes through the same six policy checks as any standalone purchase and will be denied if it would exceed the mandate cap or violate any other policy bound. Requires the original order_id and proposal_id for traceability.',
        inputSchema: {
            merchant_id: z.string().describe('The merchant_id of the merchant this addon belongs to'),
            mandate_token: z.string().describe('The mandate_id from get_active_mandate response'),
            original_order_id: z.string().describe('The order_id from the original purchase response'),
            original_proposal_id: z.string().describe('The proposal_id from the original purchase (for traceability)'),
            addon_item_id: z.string().describe('The item_id of the suggested addon from the original purchase response'),
            counterparty: z.string().describe('Identifier of the buyer/customer'),
            agent_reasoning: z.string().describe('Why the buyer wants this addon'),
        },
    }, async ({ merchant_id: merchantId, mandate_token, original_order_id, original_proposal_id, addon_item_id, counterparty, agent_reasoning }) => {
        if (!mandate_token || mandate_token.trim() === '') {
            return {
                content: [{ type: 'text', text: JSON.stringify({ error: 'mandate_token is required' }) }],
                isError: true,
            };
        }
        const addonItem = getCatalogItem(addon_item_id);
        if (!addonItem || !addonItem.is_active) {
            return {
                content: [{ type: 'text', text: JSON.stringify({ error: 'Addon item not found or inactive', addon_item_id }) }],
                isError: true,
            };
        }
        try {
            const proposal = ProposalSchema.parse({
                proposal_id: `prop_addon_${randomUUID().slice(0, 8)}`,
                agent_type: 'buyer',
                agent_reasoning: `Addon to ${original_proposal_id}: ${agent_reasoning}`,
                action: 'create_order',
                amount_paise: addonItem.price_paise,
                currency: 'INR',
                merchant_id: merchantId,
                counterparty: counterparty || 'external_agent',
                category: addonItem.category,
                requested_at: new Date().toISOString(),
                description: `Addon purchase: ${addonItem.title} (paired with order ${original_order_id})`,
                item_ids: [addon_item_id],
                triggered_by: 'mcp_external',
                related_order_id: original_order_id,
            });
            const result = await processProposal(proposal);
            const response = {
                proposal_id: proposal.proposal_id,
                addon_item: { id: addonItem.id, title: addonItem.title, price_paise: addonItem.price_paise },
                linked_to_order: original_order_id,
                verdict: result.decision.verdict,
                reason_code: result.decision.reason_code,
                reason_text: result.decision.reason_text,
                final_status: result.outcome.final_status,
                explanation: result.ledgerRow.human_readable_explanation,
                razorpay_response: result.outcome.razorpay_response || null,
            };
            if (result.orderId) {
                response.addon_order_id = result.orderId;
            }
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify(response, null, 2),
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
    server.registerTool('get_active_mandate', {
        title: 'Get Active Mandate',
        description: 'Check whether you are authorized to spend on behalf of the user with a specific merchant. Call this BEFORE every purchase attempt — it returns the mandate_token required by submit_purchase_proposal, plus the spending scope (max amount in INR, allowed product categories, and expiry time). If no active mandate exists, the user or merchant must issue one from the dashboard first; you cannot create mandates yourself. This tool is read-only and safe to call at any time.',
        inputSchema: {
            merchant_id: z.string().optional().describe('Optional: filter by merchant. Returns mandates for the specified merchant.'),
            principal: z.string().optional().describe('Optional: filter by principal (default returns any active mandate)'),
        },
    }, async ({ merchant_id: reqMerchantId, principal }) => {
        let query = `SELECT id, merchant_id, agent_id, principal, scope_max_amount_paise, scope_category_json, expires_at, issued_by, consent_method, granted_at
      FROM mandates
      WHERE revoked = 0 AND expires_at > datetime('now')`;
        const params = [];
        if (reqMerchantId) {
            query += ' AND merchant_id = ?';
            params.push(reqMerchantId);
        }
        if (principal) {
            query += ' AND principal = ?';
            params.push(principal);
        }
        query += ' ORDER BY granted_at DESC LIMIT 1';
        const row = db.prepare(query).get(...params);
        if (!row) {
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            has_active_mandate: false,
                            message: 'No active spending mandate exists. A human merchant must issue one from the dashboard before you can transact.',
                        }, null, 2),
                    }],
            };
        }
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        has_active_mandate: true,
                        mandate_id: row.id,
                        merchant_id: row.merchant_id,
                        agent_id: row.agent_id,
                        scope_max_amount_paise: row.scope_max_amount_paise,
                        scope_max_amount_rupees: row.scope_max_amount_paise / 100,
                        scope_categories: JSON.parse(row.scope_category_json),
                        expires_at: row.expires_at,
                        issued_by: row.issued_by,
                        consent_method: row.consent_method,
                    }, null, 2),
                }],
        };
    });
    server.registerTool('check_proposal_status', {
        title: 'Check Proposal Status',
        description: 'Look up the outcome of a previously submitted purchase or addon proposal. Use this when you need to confirm whether a transaction was approved or denied, retrieve the reason code, or check the Razorpay response after submission. Returns the full decision record from the immutable ledger.',
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
        const proposal = JSON.parse(entry.proposal_json);
        const itemIds = proposal.item_ids || [];
        const usesShopifyItems = itemIds.some((id) => id.startsWith('shopify_'));
        const response = {
            proposal_id,
            timestamp: entry.timestamp,
            final_status: entry.final_status,
            verdict: decision.verdict,
            reason_code: decision.reason_code,
            reason_text: decision.reason_text,
            explanation: entry.human_readable_explanation,
            amount_paise: entry.amount_paise,
            category: entry.category,
        };
        if (usesShopifyItems) {
            response.catalog_source = 'live_shopify_pilot';
            response.settlement_disclosure = 'This purchase used Razorpay test-mode credentials — no real funds were transferred to the connected Shopify merchant. Product data was live from their store; payment settlement was not.';
        }
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify(response, null, 2),
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
