export interface CatalogItem {
    id: string;
    title: string;
    description: string;
    price_paise: number;
    category: string;
    stock: number;
    pairs_with_ids: string[];
    is_active: boolean;
}
export declare function getAllCatalogItems(): CatalogItem[];
export declare function getCatalogItem(id: string): CatalogItem | null;
export declare function getCatalogByCategory(category: string): CatalogItem[];
