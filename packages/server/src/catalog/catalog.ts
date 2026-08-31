import db from '../db/client.js';

export interface CatalogItem {
  id: string;
  merchant_id: string;
  title: string;
  description: string;
  price_paise: number;
  category: string;
  stock: number;
  pairs_with_ids: string[];
  is_active: boolean;
  image_url: string | null;
  source_connection_id: string | null;
  shopify_product_id: string | null;
}

interface CatalogRow {
  id: string;
  merchant_id: string;
  title: string;
  description: string;
  price_paise: number;
  category: string;
  stock: number;
  pairs_with_ids: string;
  is_active: number;
  image_url: string | null;
  source_connection_id: string | null;
  shopify_product_id: string | null;
}

function rowToItem(row: CatalogRow): CatalogItem {
  return {
    ...row,
    pairs_with_ids: JSON.parse(row.pairs_with_ids),
    is_active: row.is_active === 1,
  };
}

export function getAllCatalogItems(merchantId?: string): CatalogItem[] {
  if (merchantId) {
    const rows = db.prepare('SELECT * FROM catalog_items WHERE is_active = 1 AND merchant_id = ?').all(merchantId) as CatalogRow[];
    return rows.map(rowToItem);
  }
  const rows = db.prepare('SELECT * FROM catalog_items WHERE is_active = 1').all() as CatalogRow[];
  return rows.map(rowToItem);
}

export function getCatalogItem(id: string): CatalogItem | null {
  const row = db.prepare('SELECT * FROM catalog_items WHERE id = ?').get(id) as CatalogRow | undefined;
  if (!row) return null;
  return rowToItem(row);
}

export function getCatalogByCategory(category: string, merchantId?: string): CatalogItem[] {
  if (merchantId) {
    const rows = db.prepare('SELECT * FROM catalog_items WHERE category = ? AND is_active = 1 AND merchant_id = ?').all(category, merchantId) as CatalogRow[];
    return rows.map(rowToItem);
  }
  const rows = db.prepare('SELECT * FROM catalog_items WHERE category = ? AND is_active = 1').all(category) as CatalogRow[];
  return rows.map(rowToItem);
}
