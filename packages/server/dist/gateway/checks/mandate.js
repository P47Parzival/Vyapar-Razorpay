import db from '../../db/client.js';
export function checkMandate(proposal) {
    const now = new Date().toISOString();
    const mandate = db.prepare(`SELECT * FROM mandates
     WHERE merchant_id = ? AND agent_id = ? AND revoked = 0 AND expires_at > ?
     ORDER BY granted_at DESC LIMIT 1`).get(proposal.merchant_id, proposal.agent_type, now);
    if (!mandate) {
        return {
            check_name: 'mandate',
            passed: false,
            detail: `No valid (non-revoked, non-expired) mandate found for agent "${proposal.agent_type}" on merchant "${proposal.merchant_id}"`,
        };
    }
    // Scope check: amount
    if (proposal.amount_paise > mandate.scope_max_amount_paise) {
        return {
            check_name: 'mandate',
            passed: false,
            detail: `Mandate ${mandate.id} scope exceeded: ₹${(proposal.amount_paise / 100).toFixed(0)} > max ₹${(mandate.scope_max_amount_paise / 100).toFixed(0)}`,
        };
    }
    // Scope check: category
    const allowedCategories = JSON.parse(mandate.scope_category_json);
    if (allowedCategories.length > 0 && !allowedCategories.includes(proposal.category)) {
        return {
            check_name: 'mandate',
            passed: false,
            detail: `Mandate ${mandate.id} scope exceeded: category "${proposal.category}" not in mandate scope [${allowedCategories.join(', ')}]`,
        };
    }
    return {
        check_name: 'mandate',
        passed: true,
        detail: `Active mandate ${mandate.id} (merchant: ${mandate.merchant_id}, scope: ₹${(mandate.scope_max_amount_paise / 100).toFixed(0)}, [${allowedCategories.join(',')}]) valid until ${mandate.expires_at}`,
    };
}
