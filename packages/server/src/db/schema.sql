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
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mandates (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  principal TEXT NOT NULL,
  granted_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0
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

CREATE INDEX IF NOT EXISTS idx_ledger_timestamp ON ledger(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_agent_type ON ledger(agent_type);
CREATE INDEX IF NOT EXISTS idx_ledger_final_status ON ledger(final_status);
