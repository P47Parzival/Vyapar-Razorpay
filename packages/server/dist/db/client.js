import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
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
export default db;
