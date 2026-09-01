import { evaluatePolicyChangeRequest } from '../whatsapp/policy-change-evaluator.js';
const basePolicy = {
    max_per_transaction_paise: 100000, // ₹1,000
    max_daily_velocity_paise: 1000000, // ₹10,000
    discount_ceiling_pct: 15,
};
let passed = 0;
let failed = 0;
function assert(condition, label) {
    if (condition) {
        console.log(`  ✓ ${label}`);
        passed++;
    }
    else {
        console.log(`  ✗ FAIL: ${label}`);
        failed++;
    }
}
// ── 1. Small increase (auto-applies) ──
console.log('\n1. Small increase — within 2x multiplier');
{
    const change = { type: 'policy_field_change', field: 'per_transaction_cap', to: 1500 };
    const result = evaluatePolicyChangeRequest(change, basePolicy);
    assert(result.decision === 'auto_apply', `Decision: ${result.decision}`);
    assert(result.reason.includes('1500'), `Reason mentions new value: "${result.reason}"`);
}
// ── 2. Exact 2x increase (auto-applies at boundary) ──
console.log('\n2. Exact 2x increase — boundary');
{
    const change = { type: 'policy_field_change', field: 'per_transaction_cap', to: 2000 };
    const result = evaluatePolicyChangeRequest(change, basePolicy);
    assert(result.decision === 'auto_apply', `Decision: ${result.decision}`);
}
// ── 3. Large increase beyond 2x (defers) ──
console.log('\n3. Large increase — beyond 2x multiplier');
{
    const change = { type: 'policy_field_change', field: 'per_transaction_cap', to: 5000 };
    const result = evaluatePolicyChangeRequest(change, basePolicy);
    assert(result.decision === 'defer_to_dashboard', `Decision: ${result.decision}`);
    assert(result.reason.includes('dashboard'), `Reason mentions dashboard: "${result.reason}"`);
    assert(result.reason.includes('2x'), `Reason mentions multiplier`);
}
// ── 4. Non-whitelisted field (defers with clear reason) ──
console.log('\n4. Non-whitelisted field');
{
    const change = { type: 'policy_field_change', field: 'category_allowlist', to: 0 };
    const result = evaluatePolicyChangeRequest(change, basePolicy);
    assert(result.decision === 'defer_to_dashboard', `Decision: ${result.decision}`);
    assert(result.reason.includes('not editable via WhatsApp'), `Reason distinguishes "not allowed": "${result.reason}"`);
}
// ── 5. Moderate decrease (auto-applies) ──
console.log('\n5. Moderate decrease — above 0.25x floor');
{
    const change = { type: 'policy_field_change', field: 'per_transaction_cap', to: 500 };
    const result = evaluatePolicyChangeRequest(change, basePolicy);
    assert(result.decision === 'auto_apply', `Decision: ${result.decision}`);
    assert(result.reason.includes('decrease'), `Reason mentions decrease`);
}
// ── 6. Very large decrease below 0.25x (defers) ──
console.log('\n6. Very large decrease — below 0.25x');
{
    const change = { type: 'policy_field_change', field: 'per_transaction_cap', to: 100 };
    const result = evaluatePolicyChangeRequest(change, basePolicy);
    assert(result.decision === 'defer_to_dashboard', `Decision: ${result.decision}`);
    assert(result.reason.includes('very large decrease'), `Reason explains: "${result.reason}"`);
}
// ── 7. Discount ceiling — moderate change (auto-applies) ──
console.log('\n7. Discount ceiling — moderate increase');
{
    const change = { type: 'policy_field_change', field: 'discount_ceiling', to: 20 };
    const result = evaluatePolicyChangeRequest(change, basePolicy);
    assert(result.decision === 'auto_apply', `Decision: ${result.decision}`);
}
// ── 8. Discount ceiling — exceed max allowed via WhatsApp ──
console.log('\n8. Discount ceiling — exceeds 50% max');
{
    const change = { type: 'policy_field_change', field: 'discount_ceiling', to: 60 };
    const result = evaluatePolicyChangeRequest(change, basePolicy);
    assert(result.decision === 'defer_to_dashboard', `Decision: ${result.decision}`);
    assert(result.reason.includes('50%'), `Reason mentions max: "${result.reason}"`);
}
// ── 9. Daily velocity cap — small increase ──
console.log('\n9. Daily velocity cap — small increase');
{
    const change = { type: 'policy_field_change', field: 'daily_velocity_cap', to: 15000 };
    const result = evaluatePolicyChangeRequest(change, basePolicy);
    assert(result.decision === 'auto_apply', `Decision: ${result.decision}`);
}
// ── 10. Negative value (defers) ──
console.log('\n10. Negative value');
{
    const change = { type: 'policy_field_change', field: 'per_transaction_cap', to: -500 };
    const result = evaluatePolicyChangeRequest(change, basePolicy);
    assert(result.decision === 'defer_to_dashboard', `Decision: ${result.decision}`);
    assert(result.reason.includes('Negative'), `Reason: "${result.reason}"`);
}
// ── 11. No-op — same value ──
console.log('\n11. No-op — same value');
{
    const change = { type: 'policy_field_change', field: 'per_transaction_cap', to: 1000 };
    const result = evaluatePolicyChangeRequest(change, basePolicy);
    assert(result.decision === 'auto_apply', `Decision: ${result.decision}`);
    assert(result.reason.includes('already'), `Reason: "${result.reason}"`);
}
// ── 12. Single-use override — valid ──
console.log('\n12. Single-use override — valid proposal_id');
{
    const change = { type: 'single_use_override', proposal_id: 'prop_abc123', action: 'approve' };
    const result = evaluatePolicyChangeRequest(change, basePolicy);
    assert(result.decision === 'auto_apply', `Decision: ${result.decision}`);
}
// ── 13. Single-use override — with discount exceeding ceiling ──
console.log('\n13. Single-use override — discount exceeds ceiling');
{
    const change = { type: 'single_use_override', proposal_id: 'prop_abc123', action: 'approve', discount_pct: 25 };
    const result = evaluatePolicyChangeRequest(change, basePolicy);
    assert(result.decision === 'defer_to_dashboard', `Decision: ${result.decision}`);
    assert(result.reason.includes('discount'), `Reason: "${result.reason}"`);
}
// ── 14. Single-use override — missing proposal_id ──
console.log('\n14. Single-use override — empty proposal_id');
{
    const change = { type: 'single_use_override', proposal_id: '', action: 'approve' };
    const result = evaluatePolicyChangeRequest(change, basePolicy);
    assert(result.decision === 'defer_to_dashboard', `Decision: ${result.decision}`);
}
console.log(`\n═══ Results: ${passed} passed, ${failed} failed ═══\n`);
process.exit(failed > 0 ? 1 : 0);
