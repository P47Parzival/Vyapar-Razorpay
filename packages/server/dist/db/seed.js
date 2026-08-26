import db from './client.js';
const catalogItems = [
    { id: 'item_001', title: 'Gentle Face Wash', description: 'Soothing gel cleanser for all skin types, 150ml', price_paise: 45000, category: 'skincare', stock: 80, pairs_with_ids: '["item_002","item_003"]' },
    { id: 'item_002', title: 'Daily Moisturizer SPF 30', description: 'Lightweight hydrating moisturizer with sun protection, 100ml', price_paise: 65000, category: 'skincare', stock: 60, pairs_with_ids: '["item_001","item_004"]' },
    { id: 'item_003', title: 'Vitamin C Serum', description: 'Brightening serum with 15% Vitamin C, 30ml', price_paise: 89000, category: 'skincare', stock: 45, pairs_with_ids: '["item_001","item_002"]' },
    { id: 'item_004', title: 'Hydrating Toner', description: 'Alcohol-free toner with hyaluronic acid, 200ml', price_paise: 55000, category: 'skincare', stock: 70, pairs_with_ids: '["item_001","item_003"]' },
    { id: 'item_005', title: 'Anti-Dandruff Shampoo', description: 'Zinc pyrithione shampoo for flake-free hair, 250ml', price_paise: 38000, category: 'haircare', stock: 90, pairs_with_ids: '["item_006","item_007"]' },
    { id: 'item_006', title: 'Nourishing Conditioner', description: 'Deep conditioning treatment for dry hair, 200ml', price_paise: 42000, category: 'haircare', stock: 75, pairs_with_ids: '["item_005","item_007"]' },
    { id: 'item_007', title: 'Hair Growth Oil', description: 'Ayurvedic blend with bhringraj and amla, 100ml', price_paise: 35000, category: 'haircare', stock: 100, pairs_with_ids: '["item_005","item_006"]' },
    { id: 'item_008', title: 'Body Lotion Cocoa Butter', description: 'Rich body lotion for deep hydration, 300ml', price_paise: 48000, category: 'bodycare', stock: 65, pairs_with_ids: '["item_009","item_010"]' },
    { id: 'item_009', title: 'Exfoliating Body Scrub', description: 'Coffee-walnut scrub for smooth skin, 200g', price_paise: 52000, category: 'bodycare', stock: 55, pairs_with_ids: '["item_008","item_010"]' },
    { id: 'item_010', title: 'Natural Deodorant Stick', description: 'Aluminum-free deodorant, lavender scent, 50g', price_paise: 32000, category: 'bodycare', stock: 120, pairs_with_ids: '["item_008","item_009"]' },
    { id: 'item_011', title: 'Ashwagandha Capsules', description: 'Stress relief supplement, 60 capsules', price_paise: 59000, category: 'wellness', stock: 40, pairs_with_ids: '["item_012","item_013"]' },
    { id: 'item_012', title: 'Multivitamin Gummies', description: 'Daily essential vitamins, mixed fruit, 30 gummies', price_paise: 45000, category: 'wellness', stock: 85, pairs_with_ids: '["item_011","item_013"]' },
    { id: 'item_013', title: 'Collagen Powder', description: 'Marine collagen for skin & joints, 200g unflavored', price_paise: 125000, category: 'wellness', stock: 30, pairs_with_ids: '["item_011","item_003"]' },
    { id: 'item_014', title: 'Jade Face Roller', description: 'Natural jade stone roller for facial massage', price_paise: 75000, category: 'accessories', stock: 50, pairs_with_ids: '["item_003","item_004"]' },
    { id: 'item_015', title: 'Bamboo Makeup Brush Set', description: 'Eco-friendly 8-piece brush set with pouch', price_paise: 95000, category: 'accessories', stock: 35, pairs_with_ids: '["item_014"]' },
];
const defaultPolicy = {
    merchant_id: 'default',
    max_per_transaction_paise: 300000,
    max_daily_velocity_paise: 1000000,
    max_daily_txn_count: 20,
    discount_ceiling_pct: 15,
    mandate_expiry_minutes: 60,
    merchant_allowlist_json: '[]',
    category_allowlist_json: '["skincare","haircare","bodycare","wellness","accessories"]',
};
export function seedDatabase() {
    const existingItems = db.prepare('SELECT COUNT(*) as count FROM catalog_items').get();
    if (existingItems.count === 0) {
        const insertItem = db.prepare('INSERT INTO catalog_items (id, title, description, price_paise, category, stock, pairs_with_ids) VALUES (?, ?, ?, ?, ?, ?, ?)');
        const insertMany = db.transaction(() => {
            for (const item of catalogItems) {
                insertItem.run(item.id, item.title, item.description, item.price_paise, item.category, item.stock, item.pairs_with_ids);
            }
        });
        insertMany();
        console.log(`[Seed] Inserted ${catalogItems.length} catalog items`);
    }
    const existingPolicy = db.prepare('SELECT COUNT(*) as count FROM policy_config').get();
    if (existingPolicy.count === 0) {
        db.prepare(`INSERT INTO policy_config (merchant_id, max_per_transaction_paise, max_daily_velocity_paise, max_daily_txn_count, discount_ceiling_pct, mandate_expiry_minutes, merchant_allowlist_json, category_allowlist_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(defaultPolicy.merchant_id, defaultPolicy.max_per_transaction_paise, defaultPolicy.max_daily_velocity_paise, defaultPolicy.max_daily_txn_count, defaultPolicy.discount_ceiling_pct, defaultPolicy.mandate_expiry_minutes, defaultPolicy.merchant_allowlist_json, defaultPolicy.category_allowlist_json);
        console.log('[Seed] Inserted default policy config');
    }
    // Dev convenience: seed one mandate per agent so the app works out of the box.
    // In the intended flow, mandates are issued explicitly via the dashboard.
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const existingMandates = db.prepare('SELECT COUNT(*) as count FROM mandates').get();
    if (existingMandates.count === 0) {
        db.prepare(`INSERT INTO mandates (id, agent_id, principal, granted_at, expires_at, revoked, scope_max_amount_paise, scope_category_json, issued_by, consent_method)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run('mandate_growth_001', 'growth', 'merchant_default', now, expiresAt, 0, 300000, '["skincare","haircare","bodycare","wellness","accessories"]', 'system', 'dev_seed');
        db.prepare(`INSERT INTO mandates (id, agent_id, principal, granted_at, expires_at, revoked, scope_max_amount_paise, scope_category_json, issued_by, consent_method)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run('mandate_buyer_001', 'buyer', 'merchant_default', now, expiresAt, 0, 300000, '["skincare","haircare","bodycare","wellness","accessories"]', 'system', 'dev_seed');
        console.log('[Seed] Inserted default mandates (dev convenience, scope: ₹3000 all categories)');
    }
    else {
        // Check if any active mandates exist — if all are expired/revoked, warn but don't auto-refresh
        const active = db.prepare("SELECT COUNT(*) as count FROM mandates WHERE revoked = 0 AND expires_at > ?").get(now);
        if (active.count === 0) {
            console.log('[Seed] WARNING: No active mandates. Issue one via the dashboard before running agents.');
        }
        else {
            console.log(`[Seed] ${active.count} active mandate(s) found.`);
        }
    }
}
