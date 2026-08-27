import { Router } from 'express';
import { getAllCatalogItems, getCatalogItem, getCatalogByCategory } from './catalog.js';

const router = Router();

// Agent-readable catalog endpoint (schema.org-inspired shape)
router.get('/catalog', (_req, res) => {
  const items = getAllCatalogItems();

  const products = items.map(item => ({
    '@type': 'Product',
    id: item.id,
    name: item.title,
    description: item.description,
    offers: {
      '@type': 'Offer',
      price: item.price_paise / 100,
      priceCurrency: 'INR',
      price_paise: item.price_paise,
      availability: item.stock > 0 ? 'InStock' : 'OutOfStock',
      stock: item.stock,
    },
    category: item.category,
    relatedProducts: item.pairs_with_ids,
    source_connection_id: item.source_connection_id,
  }));

  res.json({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    merchant: 'vyapar-demo-store',
    numberOfItems: products.length,
    itemListElement: products,
  });
});

router.get('/catalog/:id', (req, res) => {
  const item = getCatalogItem(req.params.id);
  if (!item) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }
  res.json({
    '@type': 'Product',
    id: item.id,
    name: item.title,
    description: item.description,
    offers: {
      '@type': 'Offer',
      price: item.price_paise / 100,
      priceCurrency: 'INR',
      price_paise: item.price_paise,
      availability: item.stock > 0 ? 'InStock' : 'OutOfStock',
      stock: item.stock,
    },
    category: item.category,
    relatedProducts: item.pairs_with_ids,
  });
});

router.get('/catalog/category/:category', (req, res) => {
  const items = getCatalogByCategory(req.params.category);
  res.json({
    category: req.params.category,
    items: items.map(item => ({
      id: item.id,
      name: item.title,
      price: item.price_paise / 100,
      price_paise: item.price_paise,
      stock: item.stock,
    })),
  });
});

export default router;
