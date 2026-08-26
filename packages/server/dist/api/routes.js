import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import db from '../db/client.js';
import { getPolicyConfig, updatePolicyConfig } from '../gateway/policy-config.js';
import { getLedgerEntries, getLedgerEntry, getLedgerEntriesSince } from '../ledger/ledger.js';
import { runGrowthAgent } from '../agents/growth-agent.js';
import { runBuyerAgent } from '../agents/buyer-agent.js';
const router = Router();
// --- Policy endpoints ---
router.get('/policy', (_req, res) => {
    const config = getPolicyConfig('default');
    res.json(config);
});
router.patch('/policy', (req, res) => {
    const updates = req.body;
    const updated = updatePolicyConfig('default', updates);
    res.json(updated);
});
router.get('/policy/public', (_req, res) => {
    const config = getPolicyConfig('default');
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
router.get('/mandates', (_req, res) => {
    const rows = db.prepare('SELECT * FROM mandates ORDER BY granted_at DESC').all();
    const mandates = rows.map(r => ({
        ...r,
        scope_categories: JSON.parse(r.scope_category_json),
        is_active: r.revoked === 0 && new Date(r.expires_at) > new Date(),
    }));
    res.json({ mandates });
});
router.post('/mandates', (req, res) => {
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
    const categories = scope_categories || ['skincare', 'haircare', 'bodycare', 'wellness', 'accessories'];
    db.prepare(`INSERT INTO mandates (id, agent_id, principal, granted_at, expires_at, revoked, scope_max_amount_paise, scope_category_json, issued_by, consent_method)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, 'dashboard_click')`).run(id, agent_id, 'merchant_default', now, expiresAt, maxAmount, JSON.stringify(categories), issued_by || 'merchant_owner');
    res.json({
        id,
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
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const since = req.query.since;
    if (since) {
        const entries = getLedgerEntriesSince(since);
        res.json({ entries, count: entries.length });
        return;
    }
    const entries = getLedgerEntries(limit, offset);
    res.json({ entries, count: entries.length });
});
router.get('/ledger/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    // Send current entries as initial data
    const current = getLedgerEntries(20);
    res.write(`data: ${JSON.stringify({ type: 'init', entries: current })}\n\n`);
    // Poll for new entries every 2 seconds
    let lastId = current.length > 0 ? current[0].id : '';
    const interval = setInterval(() => {
        try {
            const latest = getLedgerEntries(1);
            if (latest.length > 0 && latest[0].id !== lastId) {
                const newEntries = lastId ? getLedgerEntriesSince(lastId) : latest;
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
// --- Agent trigger endpoints ---
router.post('/agents/growth/cart-recovery', async (req, res) => {
    try {
        const scenario = {
            type: 'cart_recovery',
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
    try {
        const scenario = {
            type: 'upsell',
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
    try {
        const { request } = req.body;
        if (!request || typeof request !== 'string') {
            res.status(400).json({ success: false, error: 'Missing "request" field (shopping request text)' });
            return;
        }
        const result = await runBuyerAgent(request);
        res.json({ success: true, ...result });
    }
    catch (err) {
        const error = err;
        res.status(500).json({ success: false, error: error.message });
    }
});
export default router;
