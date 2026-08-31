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
