import { Router, Request, Response } from 'express';
import { getPolicyConfig, updatePolicyConfig } from '../gateway/policy-config.js';
import { getLedgerEntries, getLedgerEntry, getLedgerEntriesSince } from '../ledger/ledger.js';
import { runGrowthAgent, type GrowthAgentScenario } from '../agents/growth-agent.js';

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
      },
    };

    const result = await runGrowthAgent(scenario);
    res.json({ success: true, ...result });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
