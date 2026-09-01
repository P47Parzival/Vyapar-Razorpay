import '../env.js';
import { seedDatabase } from '../db/seed.js';
import { getAllCatalogItems, getOptedInCatalogItems } from '../catalog/catalog.js';
import { processProposal } from '../gateway/policy-gateway.js';
import { ProposalSchema } from '../agents/types.js';
import { getLedgerEntries } from '../ledger/ledger.js';
import db from '../db/client.js';
import { randomUUID } from 'node:crypto';
seedDatabase();
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
async function run() {
    console.log('\n═══ Vyapar Multi-Merchant E2E Test ═══\n');
    // ── 1. Cross-merchant catalog ──
    console.log('1. Cross-merchant catalog (no merchant_id filter)');
    const allItems = getOptedInCatalogItems();
    const merchantIds = [...new Set(allItems.map(i => i.merchant_id))];
    assert(merchantIds.includes('default'), 'Contains items from merchant "default" (Vyapar Wellness)');
    assert(merchantIds.includes('merchant_2'), 'Contains items from merchant "merchant_2" (UrbanGear Co.)');
    assert(allItems.length >= 20, `Total items across merchants: ${allItems.length} (expected ≥20)`);
    const sorted = allItems.every((item, i) => {
        if (i === 0)
            return true;
        const prev = allItems[i - 1];
        if (prev.category < item.category)
            return true;
        if (prev.category === item.category)
            return prev.price_paise <= item.price_paise;
        return false;
    });
    assert(sorted, 'Items sorted by category then price ascending');
    // ── 2. Single-merchant catalog ──
    console.log('\n2. Single-merchant catalog filter');
    const m1Items = getAllCatalogItems('default');
    const m2Items = getAllCatalogItems('merchant_2');
    assert(m1Items.every(i => i.merchant_id === 'default'), 'Merchant 1 filter returns only "default" items');
    assert(m2Items.every(i => i.merchant_id === 'merchant_2'), 'Merchant 2 filter returns only "merchant_2" items');
    assert(m1Items.length >= 15, `Merchant 1 has ${m1Items.length} items (expected ≥15)`);
    assert(m2Items.length >= 6, `Merchant 2 has ${m2Items.length} items (expected ≥6)`);
    // ── 3. Independent policy configs ──
    console.log('\n3. Independent policy configs');
    const p1 = db.prepare('SELECT * FROM policy_config WHERE merchant_id = ?').get('default');
    const p2 = db.prepare('SELECT * FROM policy_config WHERE merchant_id = ?').get('merchant_2');
    assert(p1 !== undefined, 'Merchant 1 has policy config');
    assert(p2 !== undefined, 'Merchant 2 has policy config');
    assert(p1.max_per_transaction_paise !== p2.max_per_transaction_paise, `Distinct per-txn caps: ₹${p1.max_per_transaction_paise / 100} vs ₹${p2.max_per_transaction_paise / 100}`);
    assert(p1.mandate_expiry_minutes !== p2.mandate_expiry_minutes, `Distinct mandate expiry: ${p1.mandate_expiry_minutes}min vs ${p2.mandate_expiry_minutes}min`);
    // ── 4. Merchant-scoped mandates (issue fresh ones for the test) ──
    console.log('\n4. Merchant-scoped mandates');
    const now = new Date().toISOString();
    const testExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const m1MandateId = `mandate_e2e_m1_${randomUUID().slice(0, 8)}`;
    db.prepare(`INSERT INTO mandates (id, merchant_id, agent_id, principal, granted_at, expires_at, revoked, scope_max_amount_paise, scope_category_json, issued_by, consent_method)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`).run(m1MandateId, 'default', 'buyer', 'e2e_test', now, testExpiry, 300000, '["skincare","haircare","bodycare","wellness","accessories"]', 'e2e_test', 'e2e_test');
    const m2MandateId = `mandate_e2e_m2_${randomUUID().slice(0, 8)}`;
    db.prepare(`INSERT INTO mandates (id, merchant_id, agent_id, principal, granted_at, expires_at, revoked, scope_max_amount_paise, scope_category_json, issued_by, consent_method)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`).run(m2MandateId, 'merchant_2', 'buyer', 'e2e_test', now, testExpiry, 500000, '["apparel","electronics"]', 'e2e_test', 'e2e_test');
    const m1Mandate = db.prepare('SELECT * FROM mandates WHERE id = ?').get(m1MandateId);
    const m2Mandate = db.prepare('SELECT * FROM mandates WHERE id = ?').get(m2MandateId);
    assert(m1Mandate !== undefined, 'Fresh buyer mandate issued for merchant 1');
    assert(m2Mandate !== undefined, 'Fresh buyer mandate issued for merchant 2');
    assert(m1Mandate.merchant_id === 'default', `Mandate 1 scoped to: ${m1Mandate.merchant_id}`);
    assert(m2Mandate.merchant_id === 'merchant_2', `Mandate 2 scoped to: ${m2Mandate.merchant_id}`);
    // ── 5. Purchase proposal for merchant_2 ──
    console.log('\n5. Purchase proposal for merchant_2 (UrbanGear Co.)');
    const targetItem = m2Items.find(i => i.category === 'apparel' && i.stock > 0);
    const proposalId = `prop_e2e_${randomUUID().slice(0, 8)}`;
    const proposal = ProposalSchema.parse({
        proposal_id: proposalId,
        agent_type: 'buyer',
        agent_reasoning: 'E2E test: purchasing apparel from merchant_2',
        action: 'create_order',
        amount_paise: targetItem.price_paise,
        currency: 'INR',
        merchant_id: 'merchant_2',
        counterparty: 'e2e_test_buyer',
        category: targetItem.category,
        requested_at: new Date().toISOString(),
        description: `E2E test purchase: ${targetItem.title}`,
        item_ids: [targetItem.id],
        triggered_by: 'internal',
    });
    const result = await processProposal(proposal);
    assert(result.decision.verdict === 'approved', `Proposal verdict: ${result.decision.verdict}`);
    assert(result.outcome.final_status === 'executed', `Final status: ${result.outcome.final_status}`);
    // ── 6. Ledger attribution ──
    console.log('\n6. Ledger entry attribution');
    const ledgerEntry = db.prepare('SELECT * FROM ledger WHERE id = ?').get(result.ledgerRow.id);
    assert(ledgerEntry !== undefined, 'Ledger row exists');
    assert(ledgerEntry.merchant_id === 'merchant_2', `Ledger merchant_id: ${ledgerEntry.merchant_id} (expected merchant_2)`);
    assert(ledgerEntry.amount_paise === targetItem.price_paise, `Ledger amount: ₹${ledgerEntry.amount_paise / 100}`);
    // ── 7. Order attribution ──
    console.log('\n7. Order attribution');
    const order = db.prepare("SELECT * FROM orders WHERE merchant_id = 'merchant_2' ORDER BY created_at DESC LIMIT 1").get();
    assert(order !== undefined, 'Order row exists for merchant_2');
    assert(order.merchant_id === 'merchant_2', `Order merchant_id: ${order.merchant_id}`);
    // ── 8. Mandate isolation — cross-merchant rejection ──
    console.log('\n8. Mandate isolation (merchant_1 mandate cannot authorize merchant_2 purchase)');
    const crossProposalId = `prop_cross_${randomUUID().slice(0, 8)}`;
    const crossProposal = ProposalSchema.parse({
        proposal_id: crossProposalId,
        agent_type: 'buyer',
        agent_reasoning: 'Cross-merchant isolation test: using merchant_1 context against merchant_2 item',
        action: 'create_order',
        amount_paise: targetItem.price_paise,
        currency: 'INR',
        merchant_id: 'default',
        counterparty: 'e2e_test_buyer',
        category: targetItem.category,
        requested_at: new Date().toISOString(),
        description: `Cross-merchant test: ${targetItem.title}`,
        item_ids: [targetItem.id],
        triggered_by: 'internal',
    });
    const crossResult = await processProposal(crossProposal);
    const crossDeniedOrCategoryMismatch = crossResult.decision.verdict === 'denied' ||
        crossResult.decision.reason_code === 'category_blocked';
    assert(crossDeniedOrCategoryMismatch, `Cross-merchant proposal: ${crossResult.decision.verdict} (${crossResult.decision.reason_code}) — isolation enforced`);
    // ── 9. Merchant-scoped ledger filtering ──
    console.log('\n9. Merchant-scoped ledger filtering');
    const m1Ledger = getLedgerEntries(100, 0, 'default');
    const m2Ledger = getLedgerEntries(100, 0, 'merchant_2');
    assert(m1Ledger.every(e => e.merchant_id === 'default'), 'Merchant 1 ledger contains only "default" entries');
    assert(m2Ledger.every(e => e.merchant_id === 'merchant_2'), 'Merchant 2 ledger contains only "merchant_2" entries');
    assert(m2Ledger.length >= 1, `Merchant 2 ledger has ${m2Ledger.length} entries (expected ≥1 from our test)`);
    // ── Summary ──
    console.log(`\n═══ Results: ${passed} passed, ${failed} failed ═══\n`);
    process.exit(failed > 0 ? 1 : 0);
}
run().catch(err => {
    console.error('E2E test crashed:', err);
    process.exit(1);
});
