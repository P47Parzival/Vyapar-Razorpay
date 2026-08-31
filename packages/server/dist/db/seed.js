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
// Second merchant — distinct catalog: apparel + tech
const merchant2CatalogItems = [
    { id: 'item_m2_001', title: 'Classic Cotton T-Shirt', description: 'Breathable 100% cotton crew neck, unisex', price_paise: 79900, category: 'apparel', stock: 150, pairs_with_ids: '["item_m2_002"]' },
    { id: 'item_m2_002', title: 'Slim Fit Jeans', description: 'Stretch denim, mid-rise, dark indigo wash', price_paise: 149900, category: 'apparel', stock: 80, pairs_with_ids: '["item_m2_001","item_m2_003"]' },
    { id: 'item_m2_003', title: 'Zip-Up Hoodie', description: 'Fleece-lined zip hoodie, kangaroo pocket', price_paise: 129900, category: 'apparel', stock: 60, pairs_with_ids: '["item_m2_001","item_m2_002"]' },
    { id: 'item_m2_004', title: 'Wireless Bluetooth Earbuds', description: 'ANC, 24h battery, IPX5 splash-proof', price_paise: 249900, category: 'electronics', stock: 40, pairs_with_ids: '["item_m2_005"]' },
    { id: 'item_m2_005', title: 'Portable Phone Charger', description: '10000mAh power bank, USB-C PD 20W', price_paise: 119900, category: 'electronics', stock: 90, pairs_with_ids: '["item_m2_004"]' },
    { id: 'item_m2_006', title: 'LED Desk Lamp', description: 'Adjustable brightness, USB charging port, warm/cool modes', price_paise: 189900, category: 'electronics', stock: 35, pairs_with_ids: '["item_m2_005"]' },
];
const defaultPolicy = {
    merchant_id: 'default',
    max_per_transaction_paise: 300000,
    max_daily_velocity_paise: 1000000,
    max_daily_txn_count: 20,
    discount_ceiling_pct: 15,
    mandate_expiry_minutes: 60,
    merchant_allowlist_json: '[]',
    category_allowlist_json: '[]',
};
const merchant2Policy = {
    merchant_id: 'merchant_2',
    max_per_transaction_paise: 500000,
    max_daily_velocity_paise: 2000000,
    max_daily_txn_count: 30,
    discount_ceiling_pct: 10,
    mandate_expiry_minutes: 120,
    merchant_allowlist_json: '[]',
    category_allowlist_json: '[]',
};
export function seedDatabase() {
    // Seed merchants table
    const existingMerchants = db.prepare('SELECT COUNT(*) as count FROM merchants').get();
    if (existingMerchants.count === 0) {
        db.prepare('INSERT INTO merchants (id, display_name) VALUES (?, ?)').run('default', 'Vyapar Wellness');
        db.prepare('INSERT INTO merchants (id, display_name) VALUES (?, ?)').run('merchant_2', 'UrbanGear Co.');
        console.log('[Seed] Inserted 2 merchants');
    }
    // Seed catalog — merchant 1 (default)
    const existingItems = db.prepare("SELECT COUNT(*) as count FROM catalog_items WHERE merchant_id = 'default'").get();
    if (existingItems.count === 0) {
        const insertItem = db.prepare('INSERT OR IGNORE INTO catalog_items (id, merchant_id, title, description, price_paise, category, stock, pairs_with_ids) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        const insertMany = db.transaction(() => {
            for (const item of catalogItems) {
                insertItem.run(item.id, 'default', item.title, item.description, item.price_paise, item.category, item.stock, item.pairs_with_ids);
            }
        });
        insertMany();
        console.log(`[Seed] Inserted ${catalogItems.length} catalog items for merchant 'default'`);
    }
    // Seed catalog — merchant 2
    const existingM2Items = db.prepare("SELECT COUNT(*) as count FROM catalog_items WHERE merchant_id = 'merchant_2'").get();
    if (existingM2Items.count === 0) {
        const insertItem = db.prepare('INSERT OR IGNORE INTO catalog_items (id, merchant_id, title, description, price_paise, category, stock, pairs_with_ids) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        const insertMany = db.transaction(() => {
            for (const item of merchant2CatalogItems) {
                insertItem.run(item.id, 'merchant_2', item.title, item.description, item.price_paise, item.category, item.stock, item.pairs_with_ids);
            }
        });
        insertMany();
        console.log(`[Seed] Inserted ${merchant2CatalogItems.length} catalog items for merchant 'merchant_2'`);
    }
    // Seed policy — merchant 1
    const existingPolicy = db.prepare("SELECT COUNT(*) as count FROM policy_config WHERE merchant_id = 'default'").get();
    if (existingPolicy.count === 0) {
        db.prepare(`INSERT INTO policy_config (merchant_id, max_per_transaction_paise, max_daily_velocity_paise, max_daily_txn_count, discount_ceiling_pct, mandate_expiry_minutes, merchant_allowlist_json, category_allowlist_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(defaultPolicy.merchant_id, defaultPolicy.max_per_transaction_paise, defaultPolicy.max_daily_velocity_paise, defaultPolicy.max_daily_txn_count, defaultPolicy.discount_ceiling_pct, defaultPolicy.mandate_expiry_minutes, defaultPolicy.merchant_allowlist_json, defaultPolicy.category_allowlist_json);
        console.log('[Seed] Inserted default policy config');
    }
    // Seed policy — merchant 2 (distinct caps)
    const existingM2Policy = db.prepare("SELECT COUNT(*) as count FROM policy_config WHERE merchant_id = 'merchant_2'").get();
    if (existingM2Policy.count === 0) {
        db.prepare(`INSERT INTO policy_config (merchant_id, max_per_transaction_paise, max_daily_velocity_paise, max_daily_txn_count, discount_ceiling_pct, mandate_expiry_minutes, merchant_allowlist_json, category_allowlist_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(merchant2Policy.merchant_id, merchant2Policy.max_per_transaction_paise, merchant2Policy.max_daily_velocity_paise, merchant2Policy.max_daily_txn_count, merchant2Policy.discount_ceiling_pct, merchant2Policy.mandate_expiry_minutes, merchant2Policy.merchant_allowlist_json, merchant2Policy.category_allowlist_json);
        console.log('[Seed] Inserted merchant_2 policy config');
    }
    // Dev convenience: seed mandates — now merchant-scoped
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const existingMandates = db.prepare('SELECT COUNT(*) as count FROM mandates').get();
    if (existingMandates.count === 0) {
        db.prepare(`INSERT INTO mandates (id, merchant_id, agent_id, principal, granted_at, expires_at, revoked, scope_max_amount_paise, scope_category_json, issued_by, consent_method)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`).run('mandate_growth_001', 'default', 'growth', 'merchant_default', now, expiresAt, 300000, '["skincare","haircare","bodycare","wellness","accessories"]', 'system', 'dev_seed');
        db.prepare(`INSERT INTO mandates (id, merchant_id, agent_id, principal, granted_at, expires_at, revoked, scope_max_amount_paise, scope_category_json, issued_by, consent_method)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`).run('mandate_buyer_001', 'default', 'buyer', 'merchant_default', now, expiresAt, 300000, '["skincare","haircare","bodycare","wellness","accessories"]', 'system', 'dev_seed');
        db.prepare(`INSERT INTO mandates (id, merchant_id, agent_id, principal, granted_at, expires_at, revoked, scope_max_amount_paise, scope_category_json, issued_by, consent_method)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`).run('mandate_growth_m2_001', 'merchant_2', 'growth', 'merchant_2_owner', now, expiresAt, 500000, '["apparel","electronics"]', 'system', 'dev_seed');
        db.prepare(`INSERT INTO mandates (id, merchant_id, agent_id, principal, granted_at, expires_at, revoked, scope_max_amount_paise, scope_category_json, issued_by, consent_method)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`).run('mandate_buyer_m2_001', 'merchant_2', 'buyer', 'merchant_2_owner', now, expiresAt, 500000, '["apparel","electronics"]', 'system', 'dev_seed');
        console.log('[Seed] Inserted mandates for both merchants');
    }
    else {
        const active = db.prepare("SELECT COUNT(*) as count FROM mandates WHERE revoked = 0 AND expires_at > ?").get(now);
        if (active.count === 0) {
            console.log('[Seed] WARNING: No active mandates. Issue one via the dashboard before running agents.');
        }
        else {
            console.log(`[Seed] ${active.count} active mandate(s) found.`);
        }
    }
}
