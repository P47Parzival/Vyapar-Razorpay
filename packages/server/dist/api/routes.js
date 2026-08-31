import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import db from '../db/client.js';
import { getPolicyConfig, updatePolicyConfig } from '../gateway/policy-config.js';
import { getLedgerEntries, getLedgerEntry, getLedgerEntriesSince } from '../ledger/ledger.js';
import { runGrowthAgent } from '../agents/growth-agent.js';
import { runBuyerAgent } from '../agents/buyer-agent.js';
import { connectShopifyStore, getConnections, syncShopifyConnection } from '../shopify/connector.js';
import { computeFindings } from '../catalog-audit/compute-findings.js';
const router = Router();
function getMerchantId(req) {
    return req.query.merchant_id || req.headers['x-merchant-id'] || 'default';
}
// --- Merchant endpoints ---
router.get('/merchants', (_req, res) => {
    const rows = db.prepare('SELECT id, display_name, created_at FROM merchants ORDER BY created_at').all();
    res.json({ merchants: rows });
});
// --- Policy endpoints ---
router.get('/policy', (req, res) => {
    const merchantId = getMerchantId(req);
    const config = getPolicyConfig(merchantId);
    res.json(config);
});
router.patch('/policy', (req, res) => {
    const merchantId = getMerchantId(req);
    const updates = req.body;
    const updated = updatePolicyConfig(merchantId, updates);
    res.json(updated);
});
router.get('/policy/public', (req, res) => {
    const merchantId = getMerchantId(req);
    const config = getPolicyConfig(merchantId);
    res.json({
        max_per_transaction_rupees: config.max_per_transaction_paise / 100,
        max_daily_velocity_rupees: config.max_daily_velocity_paise / 100,
        max_daily_txn_count: config.max_daily_txn_count,
        discount_ceiling_pct: config.discount_ceiling_pct,
        category_allowlist: config.category_allowlist,
        currency: 'INR',
        mode: 'test',
    });
});
router.get('/mandates', (req, res) => {
    const merchantId = getMerchantId(req);
    const rows = db.prepare('SELECT * FROM mandates WHERE merchant_id = ? ORDER BY granted_at DESC').all(merchantId);
    const mandates = rows.map(r => ({
        ...r,
        scope_categories: JSON.parse(r.scope_category_json),
        is_active: r.revoked === 0 && new Date(r.expires_at) > new Date(),
    }));
    res.json({ mandates });
});
router.post('/mandates', (req, res) => {
    const merchantId = getMerchantId(req);
    const { agent_id, scope_max_amount_paise, scope_categories, expiry_minutes, issued_by } = req.body;
    if (!agent_id || !['growth', 'buyer'].includes(agent_id)) {
        res.status(400).json({ error: 'agent_id must be "growth" or "buyer"' });
        return;
    }
    const id = `mandate_${agent_id}_${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const minutes = expiry_minutes || 60;
    const expiresAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    const maxAmount = scope_max_amount_paise || 300000;
    let categories = scope_categories;
    if (!categories || categories.length === 0) {
        const rows = db.prepare('SELECT DISTINCT category FROM catalog_items WHERE is_active = 1 AND merchant_id = ?').all(merchantId);
        categories = rows.map(r => r.category);
    }
    db.prepare(`INSERT INTO mandates (id, merchant_id, agent_id, principal, granted_at, expires_at, revoked, scope_max_amount_paise, scope_category_json, issued_by, consent_method)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'dashboard_click')`).run(id, merchantId, agent_id, `merchant_${merchantId}`, now, expiresAt, maxAmount, JSON.stringify(categories), issued_by || 'merchant_owner');
    res.json({
        id,
        merchant_id: merchantId,
        agent_id,
        granted_at: now,
        expires_at: expiresAt,
        scope_max_amount_paise: maxAmount,
        scope_categories: categories,
        issued_by: issued_by || 'merchant_owner',
        consent_method: 'dashboard_click',
        is_active: true,
    });
});
router.post('/mandates/:id/revoke', (req, res) => {
    const { id } = req.params;
    const row = db.prepare('SELECT * FROM mandates WHERE id = ?').get(id);
    if (!row) {
        res.status(404).json({ error: 'Mandate not found' });
        return;
    }
    db.prepare('UPDATE mandates SET revoked = 1 WHERE id = ?').run(id);
    res.json({ id, revoked: true });
});
// --- Ledger endpoints ---
router.get('/ledger', (req, res) => {
    const merchantId = getMerchantId(req);
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const since = req.query.since;
    if (since) {
        const entries = getLedgerEntriesSince(since, merchantId);
        res.json({ entries, count: entries.length });
        return;
    }
    const entries = getLedgerEntries(limit, offset, merchantId);
    res.json({ entries, count: entries.length });
});
router.get('/ledger/stream', (req, res) => {
    const merchantId = getMerchantId(req);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    const current = getLedgerEntries(20, 0, merchantId);
    res.write(`data: ${JSON.stringify({ type: 'init', entries: current })}\n\n`);
    let lastId = current.length > 0 ? current[0].id : '';
    const interval = setInterval(() => {
        try {
            const latest = getLedgerEntries(1, 0, merchantId);
            if (latest.length > 0 && latest[0].id !== lastId) {
                const newEntries = lastId ? getLedgerEntriesSince(lastId, merchantId) : latest;
                lastId = latest[0].id;
                res.write(`data: ${JSON.stringify({ type: 'update', entries: newEntries })}\n\n`);
            }
        }
        catch {
            // Client disconnected
        }
    }, 2000);
    req.on('close', () => {
        clearInterval(interval);
    });
});
router.get('/ledger/:id', (req, res) => {
    const entry = getLedgerEntry(req.params.id);
    if (!entry) {
        res.status(404).json({ error: 'Ledger entry not found' });
        return;
    }
    res.json({
        ...entry,
        proposal: JSON.parse(entry.proposal_json),
        checks: JSON.parse(entry.checks_json),
        decision: JSON.parse(entry.decision_json),
        razorpay_call: entry.razorpay_call_json ? JSON.parse(entry.razorpay_call_json) : null,
        razorpay_response: entry.razorpay_response_json ? JSON.parse(entry.razorpay_response_json) : null,
    });
});
// --- Orders & Customers endpoints ---
router.get('/orders', (req, res) => {
    const merchantId = getMerchantId(req);
    const source = req.query.source;
    const limit = parseInt(req.query.limit) || 50;
    let rows;
    if (source) {
        rows = db.prepare('SELECT * FROM orders WHERE merchant_id = ? AND source = ? ORDER BY created_at DESC LIMIT ?').all(merchantId, source, limit);
    }
    else {
        rows = db.prepare('SELECT * FROM orders WHERE merchant_id = ? ORDER BY created_at DESC LIMIT ?').all(merchantId, limit);
    }
    const orders = rows.map(r => ({
        ...r,
        item_ids: JSON.parse(r.item_ids_json),
    }));
    res.json({ orders, count: orders.length });
});
router.get('/customers', (req, res) => {
    const merchantId = getMerchantId(req);
    const limit = parseInt(req.query.limit) || 50;
    const rows = db.prepare('SELECT * FROM customers WHERE merchant_id = ? ORDER BY last_purchase_at DESC LIMIT ?').all(merchantId, limit);
    res.json({ customers: rows, count: rows.length });
});
router.get('/categories', (req, res) => {
    const merchantId = getMerchantId(req);
    const rows = db.prepare('SELECT DISTINCT category FROM catalog_items WHERE is_active = 1 AND merchant_id = ? ORDER BY category').all(merchantId);
    res.json({ categories: rows.map(r => r.category) });
});
router.get('/catalog-dashboard', (req, res) => {
    const merchantId = getMerchantId(req);
    const category = req.query.category;
    const search = req.query.search;
    const activeOnly = req.query.active !== '0';
    let sql = 'SELECT * FROM catalog_items';
    const conditions = ['merchant_id = ?'];
    const params = [merchantId];
    if (activeOnly) {
        conditions.push('is_active = 1');
    }
    if (category) {
        conditions.push('category = ?');
        params.push(category);
    }
    if (search) {
        conditions.push('(title LIKE ? OR description LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
    }
    sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY category, title';
    const items = db.prepare(sql).all(...params);
    res.json({ items, count: items.length });
});
// --- Onboarding endpoints ---
router.get('/onboarding/status', (req, res) => {
    const merchantId = getMerchantId(req);
    const config = getPolicyConfig(merchantId);
    const itemCount = db.prepare('SELECT COUNT(*) as count FROM catalog_items WHERE merchant_id = ?').get(merchantId).count;
    const shopifyCount = db.prepare('SELECT COUNT(*) as count FROM catalog_items WHERE merchant_id = ? AND source_connection_id IS NOT NULL').get(merchantId).count;
    const connections = getConnections(merchantId);
    res.json({
        catalog_connected: itemCount > 0,
        catalog_item_count: itemCount,
        shopify_item_count: shopifyCount,
        agent_commerce_enabled: config.agent_commerce_enabled,
        connections,
    });
});
router.post('/onboarding/import-catalog', (req, res) => {
    const merchantId = getMerchantId(req);
    const existingCount = db.prepare('SELECT COUNT(*) as count FROM catalog_items WHERE merchant_id = ?').get(merchantId).count;
    if (existingCount > 0) {
        res.json({ success: true, message: 'Catalog already connected', items_imported: existingCount, was_already_connected: true });
        return;
    }
    const catalogItems = [
        { id: `${merchantId}_item_001`, title: 'Gentle Face Wash', description: 'Soothing gel cleanser for all skin types, 150ml', price_paise: 45000, category: 'skincare', stock: 80, pairs_with_ids: '[]' },
        { id: `${merchantId}_item_002`, title: 'Daily Moisturizer SPF 30', description: 'Lightweight hydrating moisturizer with sun protection, 100ml', price_paise: 65000, category: 'skincare', stock: 60, pairs_with_ids: '[]' },
        { id: `${merchantId}_item_003`, title: 'Vitamin C Serum', description: 'Brightening serum with 15% Vitamin C, 30ml', price_paise: 89000, category: 'skincare', stock: 45, pairs_with_ids: '[]' },
    ];
    const insert = db.prepare('INSERT OR IGNORE INTO catalog_items (id, merchant_id, title, description, price_paise, category, stock, pairs_with_ids) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const insertMany = db.transaction(() => {
        for (const item of catalogItems) {
            insert.run(item.id, merchantId, item.title, item.description, item.price_paise, item.category, item.stock, item.pairs_with_ids);
        }
    });
    insertMany();
    res.json({ success: true, message: 'Catalog imported successfully', items_imported: catalogItems.length, was_already_connected: false });
});
router.patch('/onboarding/toggle', (req, res) => {
    const merchantId = getMerchantId(req);
    const { agent_commerce_enabled } = req.body;
    if (typeof agent_commerce_enabled !== 'boolean') {
        res.status(400).json({ error: 'agent_commerce_enabled must be a boolean' });
        return;
    }
    const updated = updatePolicyConfig(merchantId, { agent_commerce_enabled });
    res.json({ agent_commerce_enabled: updated.agent_commerce_enabled });
});
router.post('/onboarding/connect-shopify', async (req, res) => {
    const merchantId = getMerchantId(req);
    try {
        const { shop_domain, admin_api_access_token, client_id, client_secret } = req.body;
        if (!shop_domain || typeof shop_domain !== 'string') {
            res.status(400).json({ error: 'shop_domain is required' });
            return;
        }
        if (!shop_domain.endsWith('.myshopify.com')) {
            res.status(400).json({ error: 'Shop domain must end in .myshopify.com (e.g. yourstore.myshopify.com)' });
            return;
        }
        const hasClientCreds = client_id && client_secret;
        const hasDirectToken = admin_api_access_token && typeof admin_api_access_token === 'string';
        if (!hasClientCreds && !hasDirectToken) {
            res.status(400).json({ error: 'Either client_id + client_secret, or admin_api_access_token is required' });
            return;
        }
        const result = await connectShopifyStore({
            shopDomain: shop_domain,
            clientId: hasClientCreds ? client_id : undefined,
            clientSecret: hasClientCreds ? client_secret : undefined,
            accessToken: hasDirectToken ? admin_api_access_token : undefined,
            merchantId,
        });
        res.json({
            success: true,
            connection_id: result.connectionId,
            shop_name: result.shopName,
            products_imported: result.productsImported,
        });
    }
    catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});
router.get('/onboarding/connections', (req, res) => {
    const merchantId = getMerchantId(req);
    const connections = getConnections(merchantId);
    res.json({ connections });
});
router.post('/onboarding/sync-shopify/:connectionId', async (req, res) => {
    try {
        const { connectionId } = req.params;
        const result = await syncShopifyConnection(connectionId);
        res.json({ success: true, ...result });
    }
    catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});
// --- Agent trigger endpoints ---
router.post('/agents/growth/cart-recovery', async (req, res) => {
    const merchantId = getMerchantId(req);
    try {
        const scenario = {
            type: 'cart_recovery',
            merchantId,
            context: req.body.context || {
                customer_id: 'cust_demo_001',
                customer_name: 'Priya Sharma',
                abandoned_items: [
                    { id: 'item_003', name: 'Vitamin C Serum', price_paise: 89000, category: 'skincare' },
                    { id: 'item_004', name: 'Hydrating Toner', price_paise: 55000, category: 'skincare' },
                ],
                cart_total_paise: 144000,
                abandoned_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                reason: 'Payment failed — card declined',
                triggered_by: 'simulated_button',
            },
        };
        const result = await runGrowthAgent(scenario);
        res.json({ success: true, ...result });
    }
    catch (err) {
        const error = err;
        res.status(500).json({ success: false, error: error.message });
    }
});
router.post('/agents/growth/upsell', async (req, res) => {
    const merchantId = getMerchantId(req);
    try {
        const scenario = {
            type: 'upsell',
            merchantId,
            context: req.body.context || {
                customer_id: 'cust_demo_002',
                customer_name: 'Rahul Verma',
                completed_order: {
                    order_id: 'order_demo_001',
                    items: [
                        { id: 'item_001', name: 'Gentle Face Wash', price_paise: 45000, category: 'skincare' },
                    ],
                    total_paise: 45000,
                    completed_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
                },
                triggered_by: 'simulated_button',
            },
        };
        const result = await runGrowthAgent(scenario);
        res.json({ success: true, ...result });
    }
    catch (err) {
        const error = err;
        res.status(500).json({ success: false, error: error.message });
    }
});
router.post('/agents/buyer/shop', async (req, res) => {
    const merchantId = getMerchantId(req);
    try {
        const { request } = req.body;
        if (!request || typeof request !== 'string') {
            res.status(400).json({ success: false, error: 'Missing "request" field (shopping request text)' });
            return;
        }
        const result = await runBuyerAgent(request, merchantId);
        res.json({ success: true, ...result });
    }
    catch (err) {
        const error = err;
        res.status(500).json({ success: false, error: error.message });
    }
});
// --- Catalog Audit endpoints ---
router.get('/catalog-audit/findings', (req, res) => {
    const batchId = req.query.batch_id;
    const targetBatch = batchId ||
        db.prepare('SELECT run_batch_id FROM catalog_trials ORDER BY created_at DESC LIMIT 1').get()?.run_batch_id;
    if (!targetBatch) {
        res.json({ has_data: false, message: 'No audit runs yet. Run the trial runner first.' });
        return;
    }
    try {
        const findings = computeFindings(targetBatch);
        res.json({ has_data: true, findings });
    }
    catch (err) {
        res.status(500).json({ has_data: false, error: err.message });
    }
});
router.get('/catalog-audit/batches', (_req, res) => {
    const rows = db.prepare(`SELECT run_batch_id, COUNT(*) as trial_count, MIN(created_at) as started_at
     FROM catalog_trials GROUP BY run_batch_id ORDER BY started_at DESC`).all();
    res.json({ batches: rows });
});
export default router;
