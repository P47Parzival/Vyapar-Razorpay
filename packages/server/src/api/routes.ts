import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import db from '../db/client.js';
import { getPolicyConfig, updatePolicyConfig } from '../gateway/policy-config.js';
import { getLedgerEntries, getLedgerEntry, getLedgerEntriesSince } from '../ledger/ledger.js';
import { runGrowthAgent, type GrowthAgentScenario } from '../agents/growth-agent.js';
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

// --- Mandate endpoints ---

interface MandateRow {
  id: string;
  agent_id: string;
  principal: string;
  granted_at: string;
  expires_at: string;
  revoked: number;
  scope_max_amount_paise: number;
  scope_category_json: string;
  issued_by: string;
  consent_method: string;
}

router.get('/mandates', (_req, res) => {
  const rows = db.prepare('SELECT * FROM mandates ORDER BY granted_at DESC').all() as MandateRow[];
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

  db.prepare(
    `INSERT INTO mandates (id, agent_id, principal, granted_at, expires_at, revoked, scope_max_amount_paise, scope_category_json, issued_by, consent_method)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, 'dashboard_click')`
  ).run(id, agent_id, 'merchant_default', now, expiresAt, maxAmount, JSON.stringify(categories), issued_by || 'merchant_owner');

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
  const row = db.prepare('SELECT * FROM mandates WHERE id = ?').get(id) as MandateRow | undefined;
  if (!row) {
    res.status(404).json({ error: 'Mandate not found' });
    return;
  }
  db.prepare('UPDATE mandates SET revoked = 1 WHERE id = ?').run(id);
  res.json({ id, revoked: true });
});

// --- Ledger endpoints ---

router.get('/ledger', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;
  const since = req.query.since as string | undefined;

  if (since) {
    const entries = getLedgerEntriesSince(since);
    res.json({ entries, count: entries.length });
    return;
  }

  const entries = getLedgerEntries(limit, offset);
  res.json({ entries, count: entries.length });
});

router.get('/ledger/stream', (req: Request, res: Response) => {
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
    } catch {
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
  const source = req.query.source as string | undefined;
  const limit = parseInt(req.query.limit as string) || 50;

  let rows;
  if (source) {
    rows = db.prepare('SELECT * FROM orders WHERE source = ? ORDER BY created_at DESC LIMIT ?').all(source, limit);
  } else {
    rows = db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT ?').all(limit);
  }

  const orders = (rows as any[]).map(r => ({
    ...r,
    item_ids: JSON.parse(r.item_ids_json),
  }));
  res.json({ orders, count: orders.length });
});

router.get('/customers', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;

  const rows = db.prepare('SELECT * FROM customers ORDER BY last_purchase_at DESC LIMIT ?').all(limit);
  res.json({ customers: rows, count: (rows as any[]).length });
});

// --- Onboarding endpoints ---

router.get('/onboarding/status', (_req, res) => {
  const config = getPolicyConfig('default');
  const itemCount = (db.prepare('SELECT COUNT(*) as count FROM catalog_items').get() as { count: number }).count;
  res.json({
    catalog_connected: itemCount > 0,
    catalog_item_count: itemCount,
    agent_commerce_enabled: config.agent_commerce_enabled,
  });
});

router.post('/onboarding/import-catalog', (_req, res) => {
  const existingCount = (db.prepare('SELECT COUNT(*) as count FROM catalog_items').get() as { count: number }).count;
  if (existingCount > 0) {
    res.json({ success: true, message: 'Catalog already connected', items_imported: existingCount, was_already_connected: true });
    return;
  }

  const catalogItems = [
    { id: 'item_001', title: 'Gentle Face Wash', description: 'Soothing gel cleanser for all skin types, 150ml', price_paise: 45000, category: 'skincare', stock: 80, pairs_with_ids: '["item_002","item_003"]' },
    { id: 'item_002', title: 'Daily Moisturizer SPF 30', description: 'Lightweight hydrating moisturizer with sun protection, 100ml', price_paise: 65000, category: 'skincare', stock: 60, pairs_with_ids: '["item_001","item_004"]' },
    { id: 'item_003', title: 'Vitamin C Serum', description: 'Brightening serum with 15% Vitamin C, 30ml', price_paise: 89000, category: 'skincare', stock: 45, pairs_with_ids: '["item_001","item_002"]' },
    { id: 'item_004', title: 'Hydrating Toner', description: 'Alcohol-free toner with hyaluronic acid, 200ml', price_paise: 55000, category: 'skincare', stock: 70, pairs_with_ids: '["item_001","item_003"]' },
    { id: 'item_005', title: 'Anti-Dandruff Shampoo', description: 'Zinc pyrithione shampoo for flake-free hair, 250ml', price_paise: 38000, category: 'haircare', stock: 90, pairs_with_ids: '["item_006","item_007"]' },
    { id: 'item_006', title: 'Nourishing Conditioner', description: 'Deep conditioning treatment for dry hair, 200ml', price_paise: 42000, category: 'haircare', stock: 75, pairs_with_ids: '["item_005","item_007"]' },
    { id: 'item_007', title: 'Hair Growth Oil', description: 'Ayurvedic blend with bhringraj and amla, 100ml', price_paise: 35000, category: 'haircare', stock: 100, pairs_with_ids: '["item_005","item_006"]' },
    { id: 'item_008', title: 'Body Lotion Cocoa Butter', description: 'Rich body lotion for deep hydration, 300ml', price_paise: 48000, category: 'bodycare', stock: 65, pairs_with_ids: '["item_009","item_010"]' },
    { id: 'item_009', title: 'Exfoliating Body Scrub', description: 'Coffee-walnut scrub for smooth skin, 200g', price_paise: 52000, category: 'bodycare', stock: 55, pairs_with_ids: '["item_008","item_010"]' },
    { id: 'item_010', title: 'Natural Deodorant Stick', description: 'Aluminum-free deodorant, lavender scent, 50g', price_paise: 32000, category: 'bodycare', stock: 120, pairs_with_ids: '["item_008","item_009"]' },
    { id: 'item_011', title: 'Ashwagandha Capsules', description: 'Stress relief supplement, 60 capsules', price_paise: 59000, category: 'wellness', stock: 40, pairs_with_ids: '["item_012","item_013"]' },
    { id: 'item_012', title: 'Multivitamin Gummies', description: 'Daily essential vitamins, mixed fruit, 30 gummies', price_paise: 45000, category: 'wellness', stock: 85, pairs_with_ids: '["item_011","item_013"]' },
    { id: 'item_013', title: 'Collagen Powder', description: 'Marine collagen for skin & joints, 200g unflavored', price_paise: 125000, category: 'wellness', stock: 30, pairs_with_ids: '["item_011","item_003"]' },
    { id: 'item_014', title: 'Jade Face Roller', description: 'Natural jade stone roller for facial massage', price_paise: 75000, category: 'accessories', stock: 50, pairs_with_ids: '["item_003","item_004"]' },
    { id: 'item_015', title: 'Bamboo Makeup Brush Set', description: 'Eco-friendly 8-piece brush set with pouch', price_paise: 95000, category: 'accessories', stock: 35, pairs_with_ids: '["item_014"]' },
  ];

  const insert = db.prepare(
    'INSERT OR IGNORE INTO catalog_items (id, title, description, price_paise, category, stock, pairs_with_ids) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const insertMany = db.transaction(() => {
    for (const item of catalogItems) {
      insert.run(item.id, item.title, item.description, item.price_paise, item.category, item.stock, item.pairs_with_ids);
    }
  });
  insertMany();

  res.json({ success: true, message: 'Catalog imported successfully', items_imported: catalogItems.length, was_already_connected: false });
});

router.patch('/onboarding/toggle', (req, res) => {
  const { agent_commerce_enabled } = req.body;
  if (typeof agent_commerce_enabled !== 'boolean') {
    res.status(400).json({ error: 'agent_commerce_enabled must be a boolean' });
    return;
  }
  const updated = updatePolicyConfig('default', { agent_commerce_enabled });
  res.json({ agent_commerce_enabled: updated.agent_commerce_enabled });
});

// --- Agent trigger endpoints ---

router.post('/agents/growth/cart-recovery', async (req, res) => {
  try {
    const scenario: GrowthAgentScenario = {
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
        triggered_by: 'simulated_button',
      },
    };

    const result = await runGrowthAgent(scenario);
    res.json({ success: true, ...result });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/agents/growth/upsell', async (req, res) => {
  try {
    const scenario: GrowthAgentScenario = {
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
        triggered_by: 'simulated_button',
      },
    };

    const result = await runGrowthAgent(scenario);
    res.json({ success: true, ...result });
  } catch (err) {
    const error = err as Error;
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
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
