import { Router, Request, Response } from 'express';
import twilio from 'twilio';
import { parseWhatsAppPolicyMessage } from '../whatsapp/whatsapp-policy-parser.js';
import {
  evaluatePolicyChangeRequest,
  applyPolicyFieldChange,
  type StructuredPolicyChange,
} from '../whatsapp/policy-change-evaluator.js';
import { getPolicyConfig } from '../gateway/policy-config.js';

const router = Router();

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM || '';
const MERCHANT_NUMBER = process.env.MERCHANT_WHATSAPP_NUMBER || '';
const MERCHANT_ID = process.env.WHATSAPP_MERCHANT_ID || 'default';

const twilioClient = twilio(ACCOUNT_SID, AUTH_TOKEN);

async function sendWhatsAppReply(to: string, body: string) {
  await twilioClient.messages.create({
    from: WHATSAPP_FROM,
    to,
    body,
  });
}

router.post('/webhooks/whatsapp', async (req: Request, res: Response) => {
  // Respond to Twilio immediately — processing happens async
  res.status(200).type('text/xml').send('<Response></Response>');

  // 1. Twilio signature validation
  const signature = req.headers['x-twilio-signature'] as string | undefined;
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

  if (signature) {
    const valid = twilio.validateRequest(AUTH_TOKEN, signature, url, req.body);
    if (!valid) {
      console.log('[WhatsApp] Invalid Twilio signature — rejecting');
      return;
    }
  }

  const from = req.body.From as string || '';
  const body = req.body.Body as string || '';

  console.log(`[WhatsApp] Message from ${from}: "${body}"`);

  // 2. Merchant number check — before anything reaches the LLM
  if (from !== MERCHANT_NUMBER) {
    console.log(`[WhatsApp] Sender ${from} is not the registered merchant (${MERCHANT_NUMBER}) — ignoring`);
    return;
  }

  // 3. LLM parsing: free text → structured change
  const parseResult = await parseWhatsAppPolicyMessage(body);
  console.log('[WhatsApp] Parse result:', JSON.stringify(parseResult));

  // Handle parse failure
  if (parseResult.type === 'parse_failure') {
    const helpText = [
      `I couldn't parse that as a policy change.`,
      ``,
      `Try something like:`,
      `• "Change the per-transaction cap to 2000"`,
      `• "Set daily velocity cap to 15000"`,
      `• "Set discount ceiling to 20%"`,
      `• "Approve prop_abc123"`,
    ].join('\n');

    await sendWhatsAppReply(from, helpText).catch(err =>
      console.error('[WhatsApp] Reply failed:', err.message)
    );
    return;
  }

  // 4. Deterministic bounds-check — the LLM NEVER decides this
  const currentPolicy = getPolicyConfig(MERCHANT_ID);
  const evalResult = evaluatePolicyChangeRequest(parseResult as StructuredPolicyChange, currentPolicy);
  console.log('[WhatsApp] Eval result:', JSON.stringify(evalResult));

  // 5. Act on the decision
  if (evalResult.decision === 'auto_apply') {
    if (parseResult.type === 'policy_field_change') {
      const { before, after, policyKey } = applyPolicyFieldChange(
        parseResult,
        (await import('../db/client.js')).default,
        MERCHANT_ID
      );

      const unit = policyKey.includes('pct') ? '%' : '₹';
      const beforeDisplay = policyKey.includes('pct') ? before : before / 100;
      const afterDisplay = policyKey.includes('pct') ? after : after / 100;

      const confirmMsg = [
        `✅ Policy updated via WhatsApp`,
        ``,
        `Field: ${parseResult.field}`,
        `Before: ${unit}${beforeDisplay}`,
        `After: ${unit}${afterDisplay}`,
        ``,
        `This change is live now. All future proposals will use the new value.`,
      ].join('\n');

      await sendWhatsAppReply(from, confirmMsg).catch(err =>
        console.error('[WhatsApp] Reply failed:', err.message)
      );
    } else if (parseResult.type === 'single_use_override') {
      // Single-use overrides are handled in Step 5 — for now, acknowledge
      const overrideMsg = [
        `✅ Single-use override noted for proposal ${parseResult.proposal_id}.`,
        ``,
        `This override applies to this one proposal only — your policy caps are unchanged.`,
      ].join('\n');

      await sendWhatsAppReply(from, overrideMsg).catch(err =>
        console.error('[WhatsApp] Reply failed:', err.message)
      );
    }
  } else {
    // defer_to_dashboard
    const deferMsg = [
      `⚠️ This change needs dashboard confirmation`,
      ``,
      evalResult.reason,
      ``,
      `Open your Vyapar dashboard to make this change.`,
    ].join('\n');

    await sendWhatsAppReply(from, deferMsg).catch(err =>
      console.error('[WhatsApp] Reply failed:', err.message)
    );
  }
});

export { sendWhatsAppReply };
export default router;
