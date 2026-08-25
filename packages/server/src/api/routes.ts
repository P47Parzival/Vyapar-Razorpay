import { Router, Request, Response } from 'express';
import { getPolicyConfig, updatePolicyConfig } from '../gateway/policy-config.js';
import { getLedgerEntries, getLedgerEntry, getLedgerEntriesSince } from '../ledger/ledger.js';

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

export default router;
