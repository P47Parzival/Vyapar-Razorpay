import { randomUUID } from 'node:crypto';
import db from '../db/client.js';
import { processProposal } from '../gateway/policy-gateway.js';
const insertOverride = db.prepare(`
  INSERT INTO single_use_overrides (id, proposal_id, merchant_id, approved_via, created_at, used)
  VALUES (?, ?, ?, 'whatsapp', datetime('now'), 0)
`);
const markOverrideUsed = db.prepare(`
  UPDATE single_use_overrides SET used = 1, used_at = datetime('now') WHERE id = ?
`);
const insertAuditLog = db.prepare(`
  INSERT INTO whatsapp_audit_log
    (id, merchant_id, from_number, message_text, parsed_change_json, decision, field_changed, value_before, value_after, reply_sent, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
`);
export async function executeOverride(proposalId, merchantId, from, originalMessage) {
    const ledgerRow = db.prepare(`SELECT * FROM ledger WHERE merchant_id = ? AND json_extract(proposal_json, '$.proposal_id') = ? ORDER BY timestamp DESC LIMIT 1`).get(merchantId, proposalId);
    if (!ledgerRow) {
        const reply = `Could not find proposal ${proposalId}. Check the ID and try again.`;
        insertAuditLog.run(`wa_override_${randomUUID().slice(0, 8)}`, merchantId, from, originalMessage, JSON.stringify({ type: 'single_use_override', proposal_id: proposalId, action: 'approve' }), 'deferred', 'single_use_override', null, null, reply);
        return { success: false, reply };
    }
    if (ledgerRow.final_status !== 'denied') {
        const reply = `Proposal ${proposalId} was not denied — it was ${ledgerRow.final_status}. Overrides only apply to denied proposals.`;
        insertAuditLog.run(`wa_override_${randomUUID().slice(0, 8)}`, merchantId, from, originalMessage, JSON.stringify({ type: 'single_use_override', proposal_id: proposalId, action: 'approve' }), 'deferred', 'single_use_override', null, null, reply);
        return { success: false, reply };
    }
    const existingOverride = db.prepare(`SELECT id FROM single_use_overrides WHERE proposal_id = ? AND merchant_id = ?`).get(proposalId, merchantId);
    if (existingOverride) {
        const reply = `An override for ${proposalId} was already issued. Each proposal can only be overridden once.`;
        insertAuditLog.run(`wa_override_${randomUUID().slice(0, 8)}`, merchantId, from, originalMessage, JSON.stringify({ type: 'single_use_override', proposal_id: proposalId, action: 'approve' }), 'deferred', 'single_use_override', null, null, reply);
        return { success: false, reply };
    }
    const originalProposal = JSON.parse(ledgerRow.proposal_json);
    const decision = JSON.parse(ledgerRow.decision_json);
    const skipChecks = [];
    if (decision.reason_code === 'PER_TRANSACTION_CAP_EXCEEDED') {
        skipChecks.push('per_transaction_cap');
    }
    if (decision.reason_code === 'VELOCITY_CAP_EXCEEDED') {
        skipChecks.push('velocity_cap');
    }
    skipChecks.push('idempotency');
    const overrideId = `override_${randomUUID().slice(0, 8)}`;
    insertOverride.run(overrideId, proposalId, merchantId);
    const newProposal = {
        ...originalProposal,
        proposal_id: `${proposalId}_override_${randomUUID().slice(0, 6)}`,
        triggered_by: 'whatsapp_override',
        requested_at: new Date().toISOString(),
    };
    const overrideOptions = {
        singleUseOverride: {
            originalProposalId: proposalId,
            skipChecks,
        },
    };
    try {
        const result = await processProposal(newProposal, overrideOptions);
        markOverrideUsed.run(overrideId);
        const amountRupees = (originalProposal.amount_paise / 100).toLocaleString('en-IN');
        if (result.outcome.final_status === 'executed' || result.outcome.final_status === 'error') {
            const isExecuted = result.outcome.final_status === 'executed';
            const statusLabel = isExecuted ? 'order created' : 'order submitted (Razorpay test-mode)';
            const reply = [
                `Override approved — ₹${amountRupees} ${statusLabel}.`,
                ``,
                `Order: ${result.orderId || result.outcome.final_status}`,
                `Original proposal: ${proposalId}`,
                ``,
                `This was a one-time exception. Your policy caps are unchanged.`,
            ].join('\n');
            insertAuditLog.run(`wa_override_${randomUUID().slice(0, 8)}`, merchantId, from, originalMessage, JSON.stringify({ type: 'single_use_override', proposal_id: proposalId, action: 'approve' }), 'auto_applied', 'single_use_override', `denied (${decision.reason_code})`, `${result.outcome.final_status} (override)`, reply);
            return { success: true, reply };
        }
        else {
            const reply = [
                `Override attempted for ${proposalId}, but it was still denied.`,
                ``,
                `Reason: ${result.decision.reason_text}`,
                ``,
                `The cap/velocity check was bypassed, but another check failed. Use the dashboard to investigate.`,
            ].join('\n');
            insertAuditLog.run(`wa_override_${randomUUID().slice(0, 8)}`, merchantId, from, originalMessage, JSON.stringify({ type: 'single_use_override', proposal_id: proposalId, action: 'approve' }), 'deferred', 'single_use_override', `denied (${decision.reason_code})`, `denied (${result.decision.reason_code})`, reply);
            return { success: false, reply };
        }
    }
    catch (err) {
        const reply = `Override processing failed: ${err.message}. Please try from the dashboard.`;
        insertAuditLog.run(`wa_override_${randomUUID().slice(0, 8)}`, merchantId, from, originalMessage, JSON.stringify({ type: 'single_use_override', proposal_id: proposalId, action: 'approve' }), 'deferred', 'single_use_override', null, null, reply);
        return { success: false, reply };
    }
}
