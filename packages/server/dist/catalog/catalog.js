import db from '../db/client.js';
function rowToItem(row) {
    return {
        ...row,
        pairs_with_ids: JSON.parse(row.pairs_with_ids),
        is_active: row.is_active === 1,
    };
}
export function getAllCatalogItems(merchantId) {
    if (merchantId) {
        const rows = db.prepare('SELECT * FROM catalog_items WHERE is_active = 1 AND merchant_id = ?').all(merchantId);
        return rows.map(rowToItem);
    }
    const rows = db.prepare('SELECT * FROM catalog_items WHERE is_active = 1').all();
    return rows.map(rowToItem);
}
export function getOptedInCatalogItems(category) {
    const query = category
        ? `SELECT ci.* FROM catalog_items ci
       JOIN policy_config pc ON ci.merchant_id = pc.merchant_id
       WHERE ci.is_active = 1 AND pc.agent_commerce_enabled = 1 AND ci.category = ?
       ORDER BY ci.category, ci.price_paise ASC`
        : `SELECT ci.* FROM catalog_items ci
       JOIN policy_config pc ON ci.merchant_id = pc.merchant_id
       WHERE ci.is_active = 1 AND pc.agent_commerce_enabled = 1
       ORDER BY ci.category, ci.price_paise ASC`;
    const rows = (category
        ? db.prepare(query).all(category)
        : db.prepare(query).all());
    return rows.map(rowToItem);
}
export function getCatalogItem(id) {
    const row = db.prepare('SELECT * FROM catalog_items WHERE id = ?').get(id);
    if (!row)
        return null;
    return rowToItem(row);
}
export function getCatalogByCategory(category, merchantId) {
    if (merchantId) {
        const rows = db.prepare('SELECT * FROM catalog_items WHERE category = ? AND is_active = 1 AND merchant_id = ?').all(category, merchantId);
        return rows.map(rowToItem);
    }
    const rows = db.prepare('SELECT * FROM catalog_items WHERE category = ? AND is_active = 1').all(category);
    return rows.map(rowToItem);
}
