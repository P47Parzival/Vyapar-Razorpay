const WHITELISTED_FIELDS = {
    per_transaction_cap: { policyKey: 'max_per_transaction_paise', unit: 'rupees' },
    daily_velocity_cap: { policyKey: 'max_daily_velocity_paise', unit: 'rupees' },
    discount_ceiling: { policyKey: 'discount_ceiling_pct', unit: 'percent' },
};
const MAX_AUTO_INCREASE_MULTIPLIER = 2;
const MIN_AUTO_DECREASE_MULTIPLIER = 0.25;
const MAX_DISCOUNT_CEILING_PCT = 50;
export function evaluatePolicyChangeRequest(change, currentPolicy) {
    if (change.type === 'single_use_override') {
        if (!change.proposal_id || change.proposal_id.trim() === '') {
            return { decision: 'defer_to_dashboard', reason: 'Override request is missing a proposal ID.' };
        }
        if (change.discount_pct !== undefined && change.discount_pct > currentPolicy.discount_ceiling_pct) {
            return {
                decision: 'defer_to_dashboard',
                reason: `The requested discount of ${change.discount_pct}% exceeds your discount ceiling of ${currentPolicy.discount_ceiling_pct}%. Approve this override from the dashboard if intended.`,
            };
        }
        return { decision: 'auto_apply', reason: 'Single-use override approved for this specific proposal.' };
    }
    const fieldSpec = WHITELISTED_FIELDS[change.field];
    if (!fieldSpec) {
        return {
            decision: 'defer_to_dashboard',
            reason: `"${change.field}" is not editable via WhatsApp. Only per_transaction_cap, daily_velocity_cap, and discount_ceiling can be changed here. Use the dashboard for other settings.`,
        };
    }
    const currentRaw = currentPolicy[fieldSpec.policyKey];
    if (currentRaw === undefined) {
        return { decision: 'defer_to_dashboard', reason: `Could not read current value for "${change.field}" from policy config.` };
    }
    const currentValue = fieldSpec.unit === 'rupees' ? currentRaw / 100 : currentRaw;
    const newValue = change.to;
    if (newValue < 0) {
        return { decision: 'defer_to_dashboard', reason: `Negative values are not allowed for ${change.field}.` };
    }
    if (fieldSpec.unit === 'percent' && newValue > MAX_DISCOUNT_CEILING_PCT) {
        return {
            decision: 'defer_to_dashboard',
            reason: `A discount ceiling of ${newValue}% exceeds the maximum allowed via WhatsApp (${MAX_DISCOUNT_CEILING_PCT}%). Make this change from the dashboard.`,
        };
    }
    if (newValue > currentValue) {
        const multiplier = currentValue > 0 ? newValue / currentValue : Infinity;
        if (multiplier > MAX_AUTO_INCREASE_MULTIPLIER) {
            const maxAllowed = currentValue * MAX_AUTO_INCREASE_MULTIPLIER;
            const unit = fieldSpec.unit === 'rupees' ? '₹' : '%';
            return {
                decision: 'defer_to_dashboard',
                reason: `Changing ${change.field} from ${unit}${currentValue} to ${unit}${newValue} is more than a ${MAX_AUTO_INCREASE_MULTIPLIER}x increase (max auto-appliable: ${unit}${maxAllowed}). For changes this large, please confirm on the dashboard.`,
            };
        }
    }
    if (newValue < currentValue) {
        const ratio = currentValue > 0 ? newValue / currentValue : 0;
        if (ratio < MIN_AUTO_DECREASE_MULTIPLIER) {
            const minAllowed = Math.round(currentValue * MIN_AUTO_DECREASE_MULTIPLIER);
            const unit = fieldSpec.unit === 'rupees' ? '₹' : '%';
            return {
                decision: 'defer_to_dashboard',
                reason: `Changing ${change.field} from ${unit}${currentValue} to ${unit}${newValue} is a very large decrease (below ${MIN_AUTO_DECREASE_MULTIPLIER}x). Minimum auto-appliable: ${unit}${minAllowed}. Confirm on the dashboard.`,
            };
        }
    }
    if (newValue === currentValue) {
        return { decision: 'auto_apply', reason: `${change.field} is already set to this value. No change needed.` };
    }
    const unit = fieldSpec.unit === 'rupees' ? '₹' : '%';
    const direction = newValue > currentValue ? 'increase' : 'decrease';
    return {
        decision: 'auto_apply',
        reason: `Auto-applying ${direction}: ${change.field} from ${unit}${currentValue} to ${unit}${newValue}.`,
    };
}
export function applyPolicyFieldChange(change, db, merchantId) {
    const fieldSpec = WHITELISTED_FIELDS[change.field];
    const policyKey = fieldSpec.policyKey;
    const currentRow = db.prepare(`SELECT ${policyKey} FROM policy_config WHERE merchant_id = ?`).get(merchantId);
    const before = currentRow[policyKey];
    const afterPaise = fieldSpec.unit === 'rupees' ? change.to * 100 : change.to;
    db.prepare(`UPDATE policy_config SET ${policyKey} = ?, updated_at = datetime('now') WHERE merchant_id = ?`)
        .run(afterPaise, merchantId);
    return { before, after: afterPaise, policyKey };
}
export { WHITELISTED_FIELDS };
