import { v4 as uuidv4 } from 'uuid';
import db from '../db/client.js';
import { generateExplanation } from './explain.js';
export function writeLedgerEntry(proposal, checks, decision, outcome) {
    const id = uuidv4();
    const timestamp = new Date().toISOString();
    const explanation = generateExplanation(proposal, decision);
    const row = {
        id,
        merchant_id: proposal.merchant_id,
        timestamp,
        agent_type: proposal.agent_type,
        proposal_json: JSON.stringify(proposal),
        checks_json: JSON.stringify(checks),
        decision_json: JSON.stringify(decision),
        razorpay_call_json: outcome.razorpay_action ? JSON.stringify({ action: outcome.razorpay_action }) : null,
        razorpay_response_json: outcome.razorpay_response ? JSON.stringify(outcome.razorpay_response) : null,
        final_status: outcome.final_status,
        human_readable_explanation: explanation,
        amount_paise: proposal.amount_paise,
        category: proposal.category,
    };
    db.prepare(`INSERT INTO ledger (id, merchant_id, timestamp, agent_type, proposal_json, checks_json, decision_json,
     razorpay_call_json, razorpay_response_json, final_status, human_readable_explanation, amount_paise, category)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(row.id, row.merchant_id, row.timestamp, row.agent_type, row.proposal_json, row.checks_json, row.decision_json, row.razorpay_call_json, row.razorpay_response_json, row.final_status, row.human_readable_explanation, row.amount_paise, row.category);
    return row;
}
export function getLedgerEntries(limit = 50, offset = 0, merchantId) {
    if (merchantId) {
        return db.prepare('SELECT * FROM ledger WHERE merchant_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?').all(merchantId, limit, offset);
    }
    return db.prepare('SELECT * FROM ledger ORDER BY timestamp DESC LIMIT ? OFFSET ?').all(limit, offset);
}
export function getLedgerEntry(id) {
    return db.prepare('SELECT * FROM ledger WHERE id = ?').get(id) || null;
}
export function getLedgerEntriesSince(sinceId, merchantId) {
    const refRow = db.prepare('SELECT timestamp FROM ledger WHERE id = ?').get(sinceId);
    if (!refRow)
        return getLedgerEntries(50, 0, merchantId);
    if (merchantId) {
        return db.prepare('SELECT * FROM ledger WHERE timestamp > ? AND merchant_id = ? ORDER BY timestamp ASC').all(refRow.timestamp, merchantId);
    }
    return db.prepare('SELECT * FROM ledger WHERE timestamp > ? ORDER BY timestamp ASC').all(refRow.timestamp);
}
