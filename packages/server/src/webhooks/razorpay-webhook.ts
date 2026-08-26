import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { runGrowthAgent, type GrowthAgentScenario } from '../agents/growth-agent.js';
import { getCatalogItem } from '../catalog/catalog.js';

const router = Router();

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';

function verifySignature(body: string, signature: string, secret: string): boolean {
  if (!secret) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expected, 'hex')
  );
}

interface RazorpayWebhookPayload {
  event: string;
  payload: {
    payment_link?: { entity: { id: string; amount: number; notes?: Record<string, string> } };
    order?: { entity: { id: string; amount: number; notes?: Record<string, string>; receipt?: string } };
    payment?: { entity: { id: string; amount: number; notes?: Record<string, string>; order_id?: string } };
  };
}

router.post('/webhooks/razorpay', (req: Request, res: Response) => {
  const signature = req.headers['x-razorpay-signature'] as string;
  const rawBody = (req as any).rawBody as string | undefined;

  if (!WEBHOOK_SECRET) {
    console.error('[Webhook] RAZORPAY_WEBHOOK_SECRET not configured — rejecting');
    res.status(500).json({ error: 'Webhook secret not configured' });
    return;
  }

  if (!signature || !rawBody) {
    console.warn('[Webhook] Missing signature or raw body');
    res.status(400).json({ error: 'Missing signature header' });
    return;
  }

  if (!verifySignature(rawBody, signature, WEBHOOK_SECRET)) {
    console.warn('[Webhook] Invalid signature — rejecting');
    res.status(401).json({ error: 'Invalid webhook signature' });
    return;
  }

  const payload = req.body as RazorpayWebhookPayload;
  console.log(`[Webhook] Received event: ${payload.event}`);

  // Respond immediately — process async
  res.status(200).json({ status: 'received' });

  handleEvent(payload).catch(err => {
    console.error('[Webhook] Error handling event:', err);
  });
});

async function handleEvent(payload: RazorpayWebhookPayload) {
  const { event } = payload;

  if (event === 'payment_link.paid' || event === 'order.paid') {
    await handlePaymentCompleted(payload);
  }
}

async function handlePaymentCompleted(payload: RazorpayWebhookPayload) {
  const notes = payload.payload.payment_link?.entity.notes
    || payload.payload.order?.entity.notes
    || payload.payload.payment?.entity.notes
    || {};

  const proposalId = notes.proposal_id;
  const agentType = notes.agent_type;
  const category = notes.category;

  if (!proposalId) {
    console.log('[Webhook] Payment not from Vyapar system (no proposal_id in notes) — skipping');
    return;
  }

  console.log(`[Webhook] Payment completed for proposal ${proposalId} (agent: ${agentType}, category: ${category})`);

  const amount = payload.payload.payment_link?.entity.amount
    || payload.payload.order?.entity.amount
    || payload.payload.payment?.entity.amount
    || 0;

  const itemIds = notes.item_ids ? JSON.parse(notes.item_ids) : [];
  const purchasedItems = itemIds
    .map((id: string) => getCatalogItem(id))
    .filter(Boolean)
    .map((item: any) => ({
      id: item.id,
      name: item.title,
      price_paise: item.price_paise,
      category: item.category,
    }));

  if (purchasedItems.length === 0 && category) {
    purchasedItems.push({
      id: 'unknown',
      name: `${category} item`,
      price_paise: amount,
      category,
    });
  }

  const scenario: GrowthAgentScenario = {
    type: 'upsell',
    context: {
      customer_id: notes.counterparty || 'webhook_customer',
      customer_name: 'Customer',
      completed_order: {
        order_id: proposalId,
        items: purchasedItems,
        total_paise: amount,
        completed_at: new Date().toISOString(),
      },
      triggered_by: 'webhook',
      webhook_event: payload.event,
    },
  };

  console.log(`[Webhook] Triggering Growth Agent upsell for ${purchasedItems.length} item(s)...`);
  const result = await runGrowthAgent(scenario);
  console.log(`[Webhook] Growth Agent upsell result: ${result.decision?.verdict || 'no decision'}`);
}

export default router;
