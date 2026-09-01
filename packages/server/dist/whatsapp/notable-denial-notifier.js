import { randomUUID } from 'node:crypto';
import db from '../db/client.js';
import { sendWhatsAppMessage } from './twilio-client.js';
import { getPolicyConfig } from '../gateway/policy-config.js';
const NOTABLE_DENIAL_MULTIPLIER = 2;
const insertAuditLog = db.prepare(`
  INSERT INTO whatsapp_audit_log
    (id, merchant_id, from_number, message_text, parsed_change_json, decision, field_changed, value_before, value_after, reply_sent, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
`);
export function checkAndNotifyNotableDenial(proposal, decision) {
    if (decision.verdict !== 'denied')
        return;
    const MERCHANT_NUMBER = process.env.MERCHANT_WHATSAPP_NUMBER || '';
    if (!MERCHANT_NUMBER)
        return;
    const isCapOrVelocity = decision.reason_code === 'PER_TRANSACTION_CAP_EXCEEDED' ||
        decision.reason_code === 'VELOCITY_CAP_EXCEEDED';
    if (!isCapOrVelocity)
        return;
    const policy = getPolicyConfig(proposal.merchant_id);
    const cap = policy.max_per_transaction_paise;
    const threshold = cap * NOTABLE_DENIAL_MULTIPLIER;
    if (proposal.amount_paise < threshold)
        return;
    const amountRupees = (proposal.amount_paise / 100).toLocaleString('en-IN');
    const capRupees = (cap / 100).toLocaleString('en-IN');
    const msg = [
        `A ₹${amountRupees} order was just denied — your cap is ₹${capRupees}.`,
        ``,
        `Reply "approve ${proposal.proposal_id}" to let this one order through, or ignore to leave it denied.`,
        ``,
        `This would be a one-time exception — your cap stays at ₹${capRupees} for all future orders.`,
    ].join('\n');
    insertAuditLog.run(`wa_notify_${randomUUID().slice(0, 8)}`, proposal.merchant_id, 'system', `[Outbound] Notable denial: ₹${amountRupees} > 2x cap ₹${capRupees}`, JSON.stringify({ proposal_id: proposal.proposal_id, amount_paise: proposal.amount_paise, reason_code: decision.reason_code }), 'outbound_notification', null, null, null, msg);
    sendWhatsAppMessage(MERCHANT_NUMBER, msg)
        .then(() => console.log(`[WhatsApp] Notable denial notification sent for ${proposal.proposal_id}`))
        .catch(err => console.error('[WhatsApp] Outbound notification failed:', err.message));
}
