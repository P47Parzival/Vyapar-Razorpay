import db from '../db/client.js';
export function getPolicyConfig(merchantId = 'default') {
    const row = db.prepare('SELECT * FROM policy_config WHERE merchant_id = ?').get(merchantId);
    return {
        merchant_id: row.merchant_id,
        max_per_transaction_paise: row.max_per_transaction_paise,
        max_daily_velocity_paise: row.max_daily_velocity_paise,
        max_daily_txn_count: row.max_daily_txn_count,
        discount_ceiling_pct: row.discount_ceiling_pct,
        mandate_expiry_minutes: row.mandate_expiry_minutes,
        merchant_allowlist: JSON.parse(row.merchant_allowlist_json),
        category_allowlist: JSON.parse(row.category_allowlist_json),
        updated_at: row.updated_at,
    };
}
export function updatePolicyConfig(merchantId, updates) {
    const current = getPolicyConfig(merchantId);
    const newConfig = {
        max_per_transaction_paise: updates.max_per_transaction_paise ?? current.max_per_transaction_paise,
        max_daily_velocity_paise: updates.max_daily_velocity_paise ?? current.max_daily_velocity_paise,
        max_daily_txn_count: updates.max_daily_txn_count ?? current.max_daily_txn_count,
        discount_ceiling_pct: updates.discount_ceiling_pct ?? current.discount_ceiling_pct,
        mandate_expiry_minutes: updates.mandate_expiry_minutes ?? current.mandate_expiry_minutes,
        merchant_allowlist: updates.merchant_allowlist ?? current.merchant_allowlist,
        category_allowlist: updates.category_allowlist ?? current.category_allowlist,
    };
    db.prepare(`UPDATE policy_config SET
      max_per_transaction_paise = ?,
      max_daily_velocity_paise = ?,
      max_daily_txn_count = ?,
      discount_ceiling_pct = ?,
      mandate_expiry_minutes = ?,
      merchant_allowlist_json = ?,
      category_allowlist_json = ?,
      updated_at = datetime('now')
    WHERE merchant_id = ?`).run(newConfig.max_per_transaction_paise, newConfig.max_daily_velocity_paise, newConfig.max_daily_txn_count, newConfig.discount_ceiling_pct, newConfig.mandate_expiry_minutes, JSON.stringify(newConfig.merchant_allowlist), JSON.stringify(newConfig.category_allowlist), merchantId);
    return getPolicyConfig(merchantId);
}
