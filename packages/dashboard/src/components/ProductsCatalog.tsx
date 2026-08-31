import { useState, useEffect } from 'react';
import { useMerchant } from '../MerchantContext';

interface CatalogItem {
  id: string;
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

export default function ProductsCatalog() {
  const { apiUrl, merchantId } = useMerchant();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchItems = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.set('category', selectedCategory);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      const res = await fetch(apiUrl(`/api/catalog-dashboard?${params}`));
      const data = await res.json();
      setItems(data.items || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch(apiUrl('/api/categories'));
      const data = await res.json();
      setCategories(data.categories || []);
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchCategories(); }, [merchantId]);
  useEffect(() => { fetchItems(); }, [selectedCategory, searchQuery, merchantId]);

  const grouped = items.reduce<Record<string, CatalogItem[]>>((acc, item) => {
    const cat = item.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const totalValue = items.reduce((sum, item) => sum + item.price_paise * item.stock, 0);
  const inStock = items.filter(i => i.stock > 0).length;
  const outOfStock = items.filter(i => i.stock === 0).length;
  const shopifyItems = items.filter(i => i.source_connection_id).length;

  return (
    <div className="space-y-6">
      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="register px-4 py-3">
          <p className="font-body text-[11px] text-ink-muted uppercase tracking-wider font-medium">Total Products</p>
          <p className="font-data text-2xl font-medium text-ink mt-1">{items.length}</p>
        </div>
        <div className="register px-4 py-3">
          <p className="font-body text-[11px] text-ink-muted uppercase tracking-wider font-medium">In Stock</p>
          <p className="font-data text-2xl font-medium text-seal-green mt-1">{inStock}</p>
          {outOfStock > 0 && (
            <p className="font-data text-[10px] text-seal-red mt-0.5">{outOfStock} out of stock</p>
          )}
        </div>
        <div className="register px-4 py-3">
          <p className="font-body text-[11px] text-ink-muted uppercase tracking-wider font-medium">Inventory Value</p>
          <p className="font-data text-2xl font-medium text-ink mt-1">₹{(totalValue / 100).toLocaleString('en-IN')}</p>
        </div>
        <div className="register px-4 py-3">
          <p className="font-body text-[11px] text-ink-muted uppercase tracking-wider font-medium">Categories</p>
          <p className="font-data text-2xl font-medium text-ink mt-1">{categories.length}</p>
          {shopifyItems > 0 && (
            <p className="font-data text-[10px] text-ink-muted mt-0.5">{shopifyItems} from Shopify</p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="register">
        <div className="register-body flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search products..."
            className="flex-1 w-full sm:w-auto px-3 py-2 border rounded text-sm font-body text-ink"
            style={{ borderColor: 'var(--ledger-line)' }}
          />
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedCategory('all')}
              className="font-body text-xs px-2.5 py-1 rounded border transition-colors"
              style={{
                borderColor: selectedCategory === 'all' ? 'var(--signal-indigo)' : 'var(--ledger-line)',
                background: selectedCategory === 'all' ? 'var(--signal-indigo)' : 'transparent',
                color: selectedCategory === 'all' ? '#fff' : 'var(--ink-muted)',
              }}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className="font-body text-xs px-2.5 py-1 rounded border transition-colors"
                style={{
                  borderColor: selectedCategory === cat ? 'var(--signal-indigo)' : 'var(--ledger-line)',
                  background: selectedCategory === cat ? 'var(--signal-indigo)' : 'transparent',
                  color: selectedCategory === cat ? '#fff' : 'var(--ink-muted)',
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Product list */}
      {loading ? (
        <div className="register p-8 text-center">
          <p className="font-body text-sm text-ink-muted animate-pulse">Loading catalog...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="register p-8 text-center">
          <p className="font-body text-sm text-ink-muted">No products found</p>
          <p className="font-body text-xs text-ink-muted mt-1">Try adjusting filters or import a catalog from Merchant Setup</p>
        </div>
      ) : (
        Object.entries(grouped).map(([category, catItems]) => (
          <div key={category} className="register">
            <div className="register-header flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base font-semibold text-ink">{category}</h3>
                <span className="font-data text-[10px] text-ink-muted">{catItems.length} items</span>
              </div>
            </div>
            <div className="register-body">
              <div className="space-y-0">
                {catItems.map(item => {
                  const isExpanded = expandedId === item.id;
                  const pairsWithIds: string[] = JSON.parse(item.pairs_with_ids || '[]');

                  return (
                    <div key={item.id}>
                      <div
                        className="ledger-row flex items-center gap-3 cursor-pointer"
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      >
                        {/* Image or placeholder */}
                        <div className="w-10 h-10 rounded border flex-shrink-0 flex items-center justify-center overflow-hidden"
                             style={{ borderColor: 'var(--ledger-line)', background: 'rgba(0,0,0,0.02)' }}>
                          {item.image_url ? (
                            <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-body text-[10px] text-ink-muted">IMG</span>
                          )}
                        </div>

                        {/* Title + description */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-body text-sm font-medium text-ink truncate">{item.title}</p>
                            {item.source_connection_id && (
                              <span className="font-data text-[9px] text-ink-muted flex-shrink-0">shopify</span>
                            )}
                          </div>
                          <p className="font-body text-xs text-ink-muted truncate">{item.description}</p>
                        </div>

                        {/* Stock */}
                        <div className="flex-shrink-0 text-right">
                          <span className={`font-data text-xs ${item.stock > 0 ? 'text-ink' : 'text-seal-red'}`}>
                            {item.stock > 0 ? `${item.stock} in stock` : 'Out of stock'}
                          </span>
                        </div>

                        {/* Price */}
                        <div className="flex-shrink-0 text-right w-20">
                          <span className="font-data text-sm font-medium text-ink">
                            ₹{(item.price_paise / 100).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="px-5 pb-4 pt-1 border-t" style={{ borderColor: 'var(--ledger-line)', background: 'rgba(0,0,0,0.015)' }}>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                            <div>
                              <p className="font-body text-[10px] text-ink-muted uppercase tracking-wider">Item ID</p>
                              <p className="font-data text-xs text-ink mt-0.5">{item.id}</p>
                            </div>
                            <div>
                              <p className="font-body text-[10px] text-ink-muted uppercase tracking-wider">Category</p>
                              <p className="font-body text-xs text-ink mt-0.5">{item.category}</p>
                            </div>
                            <div>
                              <p className="font-body text-[10px] text-ink-muted uppercase tracking-wider">Price</p>
                              <p className="font-data text-xs text-ink mt-0.5">₹{(item.price_paise / 100).toLocaleString('en-IN')} ({item.price_paise} paise)</p>
                            </div>
                            <div>
                              <p className="font-body text-[10px] text-ink-muted uppercase tracking-wider">Stock</p>
                              <p className={`font-data text-xs mt-0.5 ${item.stock > 0 ? 'text-ink' : 'text-seal-red'}`}>{item.stock} units</p>
                            </div>
                          </div>

                          <div className="mt-3">
                            <p className="font-body text-[10px] text-ink-muted uppercase tracking-wider">Description</p>
                            <p className="font-body text-xs text-ink mt-0.5 leading-relaxed">{item.description}</p>
                          </div>

                          {pairsWithIds.length > 0 && (
                            <div className="mt-3">
                              <p className="font-body text-[10px] text-ink-muted uppercase tracking-wider">Pairs With</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {pairsWithIds.map(pid => (
                                  <span key={pid} className="font-data text-[10px] px-1.5 py-0.5 rounded border text-ink-muted" style={{ borderColor: 'var(--ledger-line)' }}>
                                    {pid}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {item.source_connection_id && (
                            <div className="mt-3 flex items-center gap-3">
                              <div>
                                <p className="font-body text-[10px] text-ink-muted uppercase tracking-wider">Source</p>
                                <p className="font-data text-xs text-ink-muted mt-0.5">Shopify</p>
                              </div>
                              {item.shopify_product_id && (
                                <div>
                                  <p className="font-body text-[10px] text-ink-muted uppercase tracking-wider">Shopify ID</p>
                                  <p className="font-data text-xs text-ink-muted mt-0.5">{item.shopify_product_id}</p>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="mt-3 pt-2 border-t flex items-center justify-between" style={{ borderColor: 'var(--ledger-line)' }}>
                            <span className={`font-data text-[10px] ${item.is_active ? 'text-seal-green' : 'text-seal-red'}`}>
                              {item.is_active ? 'ACTIVE' : 'INACTIVE'}
                            </span>
                            <span className="font-data text-[10px] text-ink-muted">{item.id}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
