import crypto from 'node:crypto';
import db from '../db/client.js';

const SHOPIFY_API_VERSION = '2024-10';

const CATEGORY_MAP: Record<string, string> = {
  skincare: 'skincare',
  'skin care': 'skincare',
  haircare: 'haircare',
  'hair care': 'haircare',
  hair: 'haircare',
  bodycare: 'bodycare',
  'body care': 'bodycare',
  body: 'bodycare',
  wellness: 'wellness',
  health: 'wellness',
  supplement: 'wellness',
  supplements: 'wellness',
  accessories: 'accessories',
  accessory: 'accessories',
  beauty: 'skincare',
  fragrance: 'accessories',
  makeup: 'accessories',
};

function mapCategory(productType: string, tags: string): string {
  const candidates = [productType.toLowerCase(), ...tags.toLowerCase().split(',').map(t => t.trim())];
  for (const candidate of candidates) {
    if (CATEGORY_MAP[candidate]) return CATEGORY_MAP[candidate];
    for (const [key, value] of Object.entries(CATEGORY_MAP)) {
      if (candidate.includes(key)) return value;
    }
  }
  console.log(`[Shopify] Unmapped category for product_type="${productType}", tags="${tags}" — defaulting to accessories`);
  return 'accessories';
}

function getEncryptionKey(): Buffer {
  const key = process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY || 'vyapar_dev_encryption_key_32b!';
  return crypto.scryptSync(key, 'vyapar_salt', 32);
}

export function encryptToken(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', getEncryptionKey(), iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decryptToken(ciphertext: string): string {
  const [ivHex, encrypted] = ciphertext.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', getEncryptionKey(), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

interface ShopifyProduct {
  id: number;
  title: string;
  body_html: string;
  product_type: string;
  tags: string;
  variants: Array<{
    price: string;
    inventory_quantity: number;
  }>;
}

async function shopifyFetch(shopDomain: string, token: string, path: string): Promise<any> {
  const url = `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/${path}`;
  const res = await fetch(url, {
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return { body: await res.json(), headers: res.headers };
}

export async function exchangeClientCredentials(shopDomain: string, clientId: string, clientSecret: string): Promise<{ access_token: string; expires_in: number }> {
  const url = `https://${shopDomain}/admin/oauth/access_token`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  if (!data.access_token) {
    throw new Error('Token exchange returned no access_token');
  }
  return { access_token: data.access_token, expires_in: data.expires_in || 86400 };
}

export async function validateShopifyConnection(shopDomain: string, token: string): Promise<{ valid: boolean; shopName?: string; error?: string }> {
  try {
    const { body } = await shopifyFetch(shopDomain, token, 'shop.json');
    return { valid: true, shopName: body.shop?.name };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Connection failed' };
  }
}

export async function fetchShopifyProducts(shopDomain: string, token: string): Promise<ShopifyProduct[]> {
  const allProducts: ShopifyProduct[] = [];
  let url = 'products.json?limit=250';

  while (url) {
    const { body, headers } = await shopifyFetch(shopDomain, token, url);
    allProducts.push(...(body.products || []));

    const linkHeader = headers.get('link') || '';
    const nextMatch = linkHeader.match(/<[^>]*\/admin\/api\/[^/]+\/([^>]+)>;\s*rel="next"/);
    url = nextMatch ? nextMatch[1] : '';
  }

  return allProducts;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim().slice(0, 500);
}

function priceToPaise(priceStr: string): number {
  const price = parseFloat(priceStr);
  return Math.round(price * 100);
}

export interface ConnectResult {
  connectionId: string;
  productsImported: number;
  shopName: string;
}

interface ConnectOptions {
  shopDomain: string;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
}

export async function connectShopifyStore(opts: ConnectOptions): Promise<ConnectResult> {
  const { shopDomain } = opts;
  let accessToken: string;

  if (opts.clientId && opts.clientSecret) {
    const tokenResult = await exchangeClientCredentials(shopDomain, opts.clientId, opts.clientSecret);
    accessToken = tokenResult.access_token;
  } else if (opts.accessToken) {
    accessToken = opts.accessToken;
  } else {
    throw new Error('Either client_id + client_secret, or an access_token is required');
  }

  const validation = await validateShopifyConnection(shopDomain, accessToken);
  if (!validation.valid) {
    throw new Error(`Could not connect — check the shop domain and credentials. Details: ${validation.error}`);
  }

  const products = await fetchShopifyProducts(shopDomain, accessToken);

  const connectionId = `shopify_${crypto.randomUUID().slice(0, 12)}`;
  const now = new Date().toISOString();
  const credentialsToStore = opts.clientId && opts.clientSecret
    ? JSON.stringify({ client_id: opts.clientId, client_secret: opts.clientSecret })
    : accessToken;
  const tokenEncrypted = encryptToken(credentialsToStore);

  db.prepare(
    `INSERT INTO shopify_connections (id, shop_domain, access_token_encrypted, connected_at, last_synced_at, product_count, status)
     VALUES (?, ?, ?, ?, ?, ?, 'active')`
  ).run(connectionId, shopDomain, tokenEncrypted, now, now, products.length);

  const insertItem = db.prepare(
    `INSERT OR IGNORE INTO catalog_items (id, title, description, price_paise, category, stock, pairs_with_ids, is_active, source_connection_id, shopify_product_id)
     VALUES (?, ?, ?, ?, ?, ?, '[]', 1, ?, ?)`
  );

  const importMany = db.transaction(() => {
    for (const product of products) {
      const variant = product.variants[0];
      if (!variant) continue;

      const pricePaise = priceToPaise(variant.price);
      if (pricePaise <= 0) continue;

      const totalStock = product.variants.reduce((sum, v) => sum + Math.max(0, v.inventory_quantity || 0), 0);
      const category = mapCategory(product.product_type || '', product.tags || '');
      const description = stripHtml(product.body_html || product.title);
      const itemId = `shopify_${product.id}`;

      insertItem.run(
        itemId,
        product.title,
        description || product.title,
        pricePaise,
        category,
        totalStock,
        connectionId,
        String(product.id)
      );
    }
  });
  importMany();

  return { connectionId, productsImported: products.length, shopName: validation.shopName || shopDomain };
}

export function getConnections() {
  return db.prepare('SELECT id, shop_domain, connected_at, last_synced_at, product_count, status FROM shopify_connections ORDER BY connected_at DESC').all();
}
