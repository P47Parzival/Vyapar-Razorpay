import db from '../db/client.js';
export function getAllCatalogItems() {
    const rows = db.prepare('SELECT * FROM catalog_items WHERE is_active = 1').all();
    return rows.map(row => ({
        ...row,
        pairs_with_ids: JSON.parse(row.pairs_with_ids),
        is_active: row.is_active === 1,
    }));
}
export function getCatalogItem(id) {
    const row = db.prepare('SELECT * FROM catalog_items WHERE id = ?').get(id);
    if (!row)
        return null;
    return {
        ...row,
        pairs_with_ids: JSON.parse(row.pairs_with_ids),
        is_active: row.is_active === 1,
    };
}
export function getCatalogByCategory(category) {
    const rows = db.prepare('SELECT * FROM catalog_items WHERE category = ? AND is_active = 1').all(category);
    return rows.map(row => ({
        ...row,
        pairs_with_ids: JSON.parse(row.pairs_with_ids),
        is_active: row.is_active === 1,
    }));
}
