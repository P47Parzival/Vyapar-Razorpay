CREATE TABLE IF NOT EXISTS catalog_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price_paise INTEGER NOT NULL,
  category TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 100,
  pairs_with_ids TEXT NOT NULL DEFAULT '[]', -- JSON array of item IDs
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS policy_config (
  merchant_id TEXT PRIMARY KEY DEFAULT 'default',
  max_per_transaction_paise INTEGER NOT NULL DEFAULT 300000,
  max_daily_velocity_paise INTEGER NOT NULL DEFAULT 1000000,
  max_daily_txn_count INTEGER NOT NULL DEFAULT 20,
  discount_ceiling_pct INTEGER NOT NULL DEFAULT 15,
  mandate_expiry_minutes INTEGER NOT NULL DEFAULT 60,
  merchant_allowlist_json TEXT NOT NULL DEFAULT '[]',
  category_allowlist_json TEXT NOT NULL DEFAULT '["skincare","haircare","bodycare","wellness","accessories"]',
  agent_commerce_enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mandates (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  principal TEXT NOT NULL,
  granted_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  scope_max_amount_paise INTEGER NOT NULL DEFAULT 300000,
  scope_category_json TEXT NOT NULL DEFAULT '["skincare","haircare","bodycare","wellness","accessories"]',
  issued_by TEXT NOT NULL DEFAULT 'system',
  consent_method TEXT NOT NULL DEFAULT 'auto_seed'
);

CREATE TABLE IF NOT EXISTS ledger (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  agent_type TEXT NOT NULL,
  proposal_json TEXT NOT NULL,
  checks_json TEXT NOT NULL DEFAULT '[]',
  decision_json TEXT NOT NULL DEFAULT '{}',
  razorpay_call_json TEXT DEFAULT NULL,
  razorpay_response_json TEXT DEFAULT NULL,
  final_status TEXT NOT NULL, -- 'executed' | 'denied' | 'error'
  human_readable_explanation TEXT NOT NULL,
  amount_paise INTEGER NOT NULL DEFAULT 0,
  category TEXT DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_purchase_at TEXT NOT NULL DEFAULT (datetime('now')),
  total_spent_paise INTEGER NOT NULL DEFAULT 0,
  order_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  ledger_id TEXT NOT NULL REFERENCES ledger(id),
  item_ids_json TEXT NOT NULL DEFAULT '[]',
  amount_paise INTEGER NOT NULL,
  category TEXT,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ledger_timestamp ON ledger(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_agent_type ON ledger(agent_type);
CREATE INDEX IF NOT EXISTS idx_ledger_final_status ON ledger(final_status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(source);
CREATE INDEX IF NOT EXISTS idx_customers_identifier ON customers(identifier);
