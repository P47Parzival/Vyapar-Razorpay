import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '../../../data/vyapar.db');
const SCHEMA_PATH = path.resolve(__dirname, './schema.sql');
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
db.exec(schema);
// Migrations for existing databases
const cols = db.prepare("PRAGMA table_info(mandates)").all();
const colNames = cols.map(c => c.name);
if (!colNames.includes('scope_max_amount_paise')) {
    db.exec("ALTER TABLE mandates ADD COLUMN scope_max_amount_paise INTEGER NOT NULL DEFAULT 300000");
    db.exec("ALTER TABLE mandates ADD COLUMN scope_category_json TEXT NOT NULL DEFAULT '[\"skincare\",\"haircare\",\"bodycare\",\"wellness\",\"accessories\"]'");
    db.exec("ALTER TABLE mandates ADD COLUMN issued_by TEXT NOT NULL DEFAULT 'system'");
    db.exec("ALTER TABLE mandates ADD COLUMN consent_method TEXT NOT NULL DEFAULT 'auto_seed'");
}
const policyCols = db.prepare("PRAGMA table_info(policy_config)").all();
const policyColNames = policyCols.map(c => c.name);
if (!policyColNames.includes('agent_commerce_enabled')) {
    db.exec("ALTER TABLE policy_config ADD COLUMN agent_commerce_enabled INTEGER NOT NULL DEFAULT 1");
}
const catalogCols = db.prepare("PRAGMA table_info(catalog_items)").all();
const catalogColNames = catalogCols.map(c => c.name);
if (!catalogColNames.includes('source_connection_id')) {
    db.exec("ALTER TABLE catalog_items ADD COLUMN source_connection_id TEXT DEFAULT NULL");
    db.exec("ALTER TABLE catalog_items ADD COLUMN shopify_product_id TEXT DEFAULT NULL");
}
// Multi-tenant merchant_id migration (BUILD_PLAN8)
if (!catalogColNames.includes('merchant_id')) {
    db.exec("ALTER TABLE catalog_items ADD COLUMN merchant_id TEXT NOT NULL DEFAULT 'default'");
}
const mandateCols = db.prepare("PRAGMA table_info(mandates)").all();
if (!mandateCols.map(c => c.name).includes('merchant_id')) {
    db.exec("ALTER TABLE mandates ADD COLUMN merchant_id TEXT NOT NULL DEFAULT 'default'");
}
const ledgerCols = db.prepare("PRAGMA table_info(ledger)").all();
if (!ledgerCols.map(c => c.name).includes('merchant_id')) {
    db.exec("ALTER TABLE ledger ADD COLUMN merchant_id TEXT NOT NULL DEFAULT 'default'");
}
const orderCols = db.prepare("PRAGMA table_info(orders)").all();
if (!orderCols.map(c => c.name).includes('merchant_id')) {
    db.exec("ALTER TABLE orders ADD COLUMN merchant_id TEXT NOT NULL DEFAULT 'default'");
}
const customerCols = db.prepare("PRAGMA table_info(customers)").all();
if (!customerCols.map(c => c.name).includes('merchant_id')) {
    db.exec("ALTER TABLE customers ADD COLUMN merchant_id TEXT NOT NULL DEFAULT 'default'");
}
const shopifyConnCols = db.prepare("PRAGMA table_info(shopify_connections)").all();
if (!shopifyConnCols.map(c => c.name).includes('merchant_id')) {
    db.exec("ALTER TABLE shopify_connections ADD COLUMN merchant_id TEXT NOT NULL DEFAULT 'default'");
}
db.exec("CREATE INDEX IF NOT EXISTS idx_ledger_merchant_id ON ledger(merchant_id)");
db.exec("CREATE INDEX IF NOT EXISTS idx_orders_merchant_id ON orders(merchant_id)");
db.exec("CREATE INDEX IF NOT EXISTS idx_customers_merchant_id ON customers(merchant_id)");
db.exec("CREATE INDEX IF NOT EXISTS idx_catalog_items_merchant_id ON catalog_items(merchant_id)");
db.exec("CREATE INDEX IF NOT EXISTS idx_mandates_merchant_id ON mandates(merchant_id)");
export default db;
