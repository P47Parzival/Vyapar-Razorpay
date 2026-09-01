import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import twilio from 'twilio';
import db from '../db/client.js';
import { sendWhatsAppMessage } from '../whatsapp/twilio-client.js';
import { parseWhatsAppPolicyMessage } from '../whatsapp/whatsapp-policy-parser.js';
import { evaluatePolicyChangeRequest, applyPolicyFieldChange, } from '../whatsapp/policy-change-evaluator.js';
import { getPolicyConfig } from '../gateway/policy-config.js';
import { executeOverride } from '../whatsapp/override-flow.js';
const router = Router();
const MERCHANT_NUMBER = process.env.MERCHANT_WHATSAPP_NUMBER || '';
const MERCHANT_ID = process.env.WHATSAPP_MERCHANT_ID || 'default';
const insertAuditLog = db.prepare(`
  INSERT INTO whatsapp_audit_log
    (id, merchant_id, from_number, message_text, parsed_change_json, decision, field_changed, value_before, value_after, reply_sent, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
`);
function writeAuditRow(opts) {
    const id = `wa_${randomUUID().slice(0, 12)}`;
    insertAuditLog.run(id, opts.merchantId, opts.from, opts.message, opts.parsedJson, opts.decision, opts.field, opts.before, opts.after, opts.reply);
    return id;
}
router.post('/webhooks/whatsapp', async (req, res) => {
    res.status(200).type('text/xml').send('<Response></Response>');
    // 1. Twilio signature validation
    // Twilio computes the signature from the exact webhook URL configured in the console.
    // Behind a reverse proxy (Render, ngrok), req.protocol/host may differ, so we use
    // an explicit env var that matches what Twilio has on file.
    const authToken = process.env.TWILIO_AUTH_TOKEN || '';
    const signature = req.headers['x-twilio-signature'];
    const webhookUrl = process.env.TWILIO_WEBHOOK_URL
        || `${req.headers['x-forwarded-proto'] || req.protocol}://${req.get('host')}${req.originalUrl}`;
    console.log(`[WhatsApp] Signature check — url: ${webhookUrl}, body keys: ${Object.keys(req.body || {}).join(',')}, sig present: ${!!signature}, token present: ${!!authToken}`);
    if (signature && authToken) {
        const valid = twilio.validateRequest(authToken, signature, webhookUrl, req.body);
        if (!valid) {
            console.log(`[WhatsApp] Invalid Twilio signature — rejecting`);
            return;
        }
    }
    const from = req.body.From || '';
    const body = req.body.Body || '';
    console.log(`[WhatsApp] Message from ${from}: "${body}"`);
    // 2. Merchant number check — audit row written even for rejected senders
    if (from !== MERCHANT_NUMBER) {
        console.log(`[WhatsApp] Sender ${from} is not the registered merchant (${MERCHANT_NUMBER}) — ignoring`);
        writeAuditRow({
            merchantId: MERCHANT_ID, from, message: body,
            parsedJson: null, decision: 'sender_rejected',
            field: null, before: null, after: null, reply: null,
        });
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
        writeAuditRow({
            merchantId: MERCHANT_ID, from, message: body,
            parsedJson: null, decision: 'parse_failed',
            field: null, before: null, after: null, reply: helpText,
        });
        await sendWhatsAppMessage(from, helpText).catch(err => console.error('[WhatsApp] Reply failed:', err.message));
        return;
    }
    // 4. Deterministic bounds-check — the LLM NEVER decides this
    const currentPolicy = getPolicyConfig(MERCHANT_ID);
    const evalResult = evaluatePolicyChangeRequest(parseResult, currentPolicy);
    console.log('[WhatsApp] Eval result:', JSON.stringify(evalResult));
    // 5. Act on the decision
    if (evalResult.decision === 'auto_apply') {
        if (parseResult.type === 'policy_field_change') {
            const { before, after, policyKey } = applyPolicyFieldChange(parseResult, db, MERCHANT_ID);
            const unit = policyKey.includes('pct') ? '%' : '₹';
            const beforeDisplay = policyKey.includes('pct') ? before : before / 100;
            const afterDisplay = policyKey.includes('pct') ? after : after / 100;
            const confirmMsg = [
                `Policy updated via WhatsApp`,
                ``,
                `Field: ${parseResult.field}`,
                `Before: ${unit}${beforeDisplay}`,
                `After: ${unit}${afterDisplay}`,
                ``,
                `This change is live now. All future proposals will use the new value.`,
            ].join('\n');
            writeAuditRow({
                merchantId: MERCHANT_ID, from, message: body,
                parsedJson: JSON.stringify(parseResult),
                decision: 'auto_applied',
                field: parseResult.field,
                before: String(beforeDisplay),
                after: String(afterDisplay),
                reply: confirmMsg,
            });
            await sendWhatsAppMessage(from, confirmMsg).catch(err => console.error('[WhatsApp] Reply failed:', err.message));
        }
        else if (parseResult.type === 'single_use_override') {
            // Execute the override — audit logging happens inside executeOverride
            const overrideResult = await executeOverride(parseResult.proposal_id, MERCHANT_ID, from, body);
            await sendWhatsAppMessage(from, overrideResult.reply).catch(err => console.error('[WhatsApp] Reply failed:', err.message));
        }
    }
    else {
        // defer_to_dashboard
        const deferMsg = [
            `This change needs dashboard confirmation`,
            ``,
            evalResult.reason,
            ``,
            `Open your Vyapar dashboard to make this change.`,
        ].join('\n');
        writeAuditRow({
            merchantId: MERCHANT_ID, from, message: body,
            parsedJson: JSON.stringify(parseResult),
            decision: 'deferred',
            field: parseResult.type === 'policy_field_change' ? parseResult.field : 'single_use_override',
            before: null, after: null,
            reply: deferMsg,
        });
        await sendWhatsAppMessage(from, deferMsg).catch(err => console.error('[WhatsApp] Reply failed:', err.message));
    }
});
export default router;
