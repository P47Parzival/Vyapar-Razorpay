# Vyapar — Complete Technical Documentation

> Bounded Agentic Commerce on Razorpay  
> Hackathon Theme: "AI Growth & Agentic Commerce"

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture & Design Philosophy](#2-architecture--design-philosophy)
3. [Tech Stack & Frameworks](#3-tech-stack--frameworks)
4. [Monorepo Structure](#4-monorepo-structure)
5. [Environment & Configuration](#5-environment--configuration)
6. [Database Layer](#6-database-layer)
7. [Product Catalog](#7-product-catalog)
8. [Policy System (Bounded Rules)](#8-policy-system-bounded-rules)
9. [Policy Gateway — The 6 Checks](#9-policy-gateway--the-6-checks)
10. [Mandate System (AP2/UAP/UPI Circle)](#10-mandate-system-ap2uapupi-circle)
11. [LLM Integration (AWS Bedrock)](#11-llm-integration-aws-bedrock)
12. [Growth Agent](#12-growth-agent)
13. [Buyer Agent](#13-buyer-agent)
14. [Razorpay MCP Integration](#14-razorpay-mcp-integration)
15. [Audit Ledger](#15-audit-ledger)
16. [Human-Readable Explanations](#16-human-readable-explanations)
17. [API Endpoints](#17-api-endpoints)
18. [Dashboard Components](#18-dashboard-components)
19. [SSE Real-Time Feed](#19-sse-real-time-feed)
20. [Graceful Failure Flow](#20-graceful-failure-flow)
21. [Zod Schemas & Type Safety](#21-zod-schemas--type-safety)
22. [Test Mode & Razorpay Sandbox](#22-test-mode--razorpay-sandbox)
23. [Data Flow: End-to-End Sequence](#23-data-flow-end-to-end-sequence)
24. [Key Decisions & Trade-offs](#24-key-decisions--trade-offs)
25. [Known Limitations](#25-known-limitations)
26. [MCP Server — Vyapar as a Tool Provider](#26-mcp-server--vyapar-as-a-tool-provider)
27. [Discovery Manifest (.well-known)](#27-discovery-manifest-well-known)
28. [Webhook Receiver (Razorpay Events)](#28-webhook-receiver-razorpay-events)
29. [External Buyer Agent (Independent Process)](#29-external-buyer-agent-independent-process)
30. [Protocol Interoperability Summary](#30-protocol-interoperability-summary)

---

## 1. Project Overview

Vyapar demonstrates that AI agents can grow merchant revenue **safely** — by architectural constraint, not by hoping prompts behave — and that **any external AI agent** can discover and transact with this merchant through standard protocols.

Four agent entry points exist:

- **Merchant Growth Agent** — recovers abandoned carts, proposes upsells/cross-sells (internal, button-triggered or webhook-triggered)
- **AI Buyer Agent** — shops on behalf of a customer (internal, via dashboard)
- **MCP Server** — exposes Vyapar as a tool provider so any MCP-capable AI client can transact
- **External Buyer Demo** — an independent process (zero shared code) that discovers, reasons, and purchases through the protocol surface

No agent can touch Razorpay directly. They can only produce structured **Proposals**. A deterministic **Policy Gateway** (zero LLM involvement, 6 checks) evaluates every proposal against merchant rules. Only the gateway talks to Razorpay. Every action — approved, denied, errored — writes exactly one row to an append-only audit ledger.

Human-issued **Mandates** (AP2/UAP/UPI Circle pattern) authorize agents to operate within scoped bounds (amount + category + time). Mandates are instantly revocable.

**The one-sentence pitch:** "Any AI agent can transact with this merchant — bounded by deterministic policy, authorized by human-issued mandates, auditable in plain English."

---

## 2. Architecture & Design Philosophy

### Core Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Dashboard (React)                      │
│  RevenueCounter │ LedgerFeed │ PolicyPanel │ AgentTriggers│
└──────────────────────────┬──────────────────────────────┘
                           │ HTTP / SSE
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  Express API Server                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐     ┌──────────────┐                  │
│  │ Growth Agent │     │ Buyer Agent  │                  │
│  │   (Claude)   │     │   (Claude)   │                  │
│  └──────┬───────┘     └──────┬───────┘                  │
│         │ submit_proposal     │ submit_proposal          │
│         ▼                     ▼                          │
│  ┌──────────────────────────────────────────────┐       │
│  │         Policy Gateway (deterministic)        │       │
│  │  1. Mandate  2. Per-Txn Cap  3. Velocity     │       │
│  │  4. Allowlist  5. Discount  6. Idempotency   │       │
│  └──────────────────────┬───────────────────────┘       │
│                         │ ONLY if all 6 pass             │
│                         ▼                                │
│  ┌──────────────────────────────────────────────┐       │
│  │      Razorpay MCP Client (test mode)          │       │
│  │      StreamableHTTP → mcp.razorpay.com        │       │
│  └──────────────────────┬───────────────────────┘       │
│                         │                                │
│                         ▼                                │
│  ┌──────────────────────────────────────────────┐       │
│  │    Audit Ledger (SQLite, append-only)          │       │
│  │    Every proposal = exactly 1 row              │       │
│  └──────────────────────────────────────────────┘       │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Five Design Principles (inviolable)

| # | Principle | Implementation |
|---|-----------|---------------|
| 1 | Agents never get Razorpay credentials | Agent tool sets contain only `submit_proposal` (and `browse_catalog` for buyer). No MCP tool, no API key exposure. |
| 2 | Policy is data, not prompt text | All caps/limits are stored in SQLite `policy_config` table. Checked by pure deterministic functions. No LLM in the gateway. |
| 3 | Every proposal = exactly one ledger row | `writeLedgerEntry()` is called on approved, denied, AND errored paths. Nothing money-related happens off the record. |
| 4 | Denial is first-class | `Decision { verdict: "denied" }` is a normal return value with `reason_code` + `reason_text`. Never a thrown error. Agents handle it gracefully. |
| 5 | Test mode only | All Razorpay calls use `rzp_test_*` keys. No real money moves. The dashboard shows a TEST MODE badge. |

---

## 3. Tech Stack & Frameworks

### Backend

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Runtime | Node.js 18+ | Server runtime |
| Language | TypeScript (ESM) | Type safety across all layers |
| Framework | Express 4.x | HTTP routing, middleware |
| LLM SDK | `@aws-sdk/client-bedrock-runtime` | Claude Sonnet via AWS Bedrock Converse API |
| Payments | `@modelcontextprotocol/sdk` | Razorpay MCP client (StreamableHTTP + SSE fallback) |
| Database | `better-sqlite3` (WAL mode) | Ledger, catalog, policy, mandates |
| Validation | `zod` | Runtime schema validation for proposals, decisions |
| Dev Server | `tsx watch` | Hot-reload TypeScript execution |
| IDs | `uuid` v4 | Globally unique proposal/ledger IDs |
| Env | `dotenv` | Environment variable loading |

### Frontend

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Framework | React 18 | Component-based UI |
| Build Tool | Vite 5 | Fast HMR, proxy config, production builds |
| Styling | Tailwind CSS 3 | Utility-first styling |
| Real-time | EventSource (SSE) | Live ledger updates |
| Language | TypeScript | Type-safe components |

### Monorepo

| Tool | Purpose |
|------|---------|
| npm workspaces | Package linking without Lerna overhead |
| `concurrently` | Run server + dashboard in parallel with `npm run dev` |

---

## 4. Monorepo Structure

```
Vyapar/
├── package.json                   # Workspace root — defines workspaces + dev scripts
├── .env                           # All credentials (not committed)
├── BUILD_PLAN.md                  # Original design document (Steps 1-10)
├── BUILD_PLAN2.md                 # Protocol interoperability plan (Steps 1-6)
├── README.md                      # Quick-start + demo script
├── README_info.md                 # This file — exhaustive documentation
│
├── packages/
│   ├── server/
│   │   ├── package.json           # @vyapar/server — Express + all backend deps
│   │   ├── tsconfig.json          # ESM output, strict mode
│   │   └── src/
│   │       ├── env.ts             # dotenv loader (imported FIRST to solve ESM hoisting)
│   │       ├── index.ts           # Server entry — seeds DB, mounts routes, MCP + webhook
│   │       │
│   │       ├── agents/
│   │       │   ├── types.ts       # Zod schemas: Proposal, Decision, Outcome, LedgerEntry
│   │       │   ├── llm-client.ts  # AWS Bedrock Converse API wrapper
│   │       │   ├── growth-agent.ts# Merchant Growth Agent (cart recovery + upsell)
│   │       │   └── buyer-agent.ts # AI Buyer Agent (internal shopper)
│   │       │
│   │       ├── gateway/
│   │       │   ├── policy-gateway.ts  # Core orchestrator — runs checks, executes, logs
│   │       │   ├── policy-config.ts   # Read/update policy from SQLite
│   │       │   └── checks/
│   │       │       ├── mandate.ts             # Check 1: mandate + scope (amount + category)
│   │       │       ├── per-transaction-cap.ts # Check 2: amount <= cap
│   │       │       ├── velocity-cap.ts        # Check 3: daily total + count
│   │       │       ├── allowlist.ts           # Check 4: category in allowed list
│   │       │       ├── discount-ceiling.ts    # Check 5: discount % <= ceiling
│   │       │       └── idempotency.ts         # Check 6: no duplicate in last 60s
│   │       │
│   │       ├── mcp-server/
│   │       │   └── vyapar-mcp-server.ts  # Vyapar as MCP tool provider (external agent entry)
│   │       │
│   │       ├── webhooks/
│   │       │   └── razorpay-webhook.ts   # Signature-verified webhook → auto Growth Agent
│   │       │
│   │       ├── razorpay/
│   │       │   ├── mcp-client.ts  # MCP connection to mcp.razorpay.com (outgoing)
│   │       │   └── execution.ts   # executeOnRazorpay() wrapper
│   │       │
│   │       ├── ledger/
│   │       │   ├── ledger.ts      # Write/read ledger entries
│   │       │   └── explain.ts     # Template-based human-readable explanations
│   │       │
│   │       ├── catalog/
│   │       │   ├── catalog.ts     # CRUD for catalog items
│   │       │   └── catalog-api.ts # GET /api/catalog routes
│   │       │
│   │       ├── db/
│   │       │   ├── client.ts      # SQLite connection (WAL mode) + migrations
│   │       │   ├── schema.sql     # 4 tables + 3 indexes
│   │       │   └── seed.ts        # 15 products + policy + dev mandates
│   │       │
│   │       └── api/
│   │           └── routes.ts      # REST endpoints (policy, mandates, agents, ledger SSE)
│   │
│   ├── dashboard/
│   │   ├── package.json           # @vyapar/dashboard — React + Vite
│   │   ├── vite.config.ts         # Proxy /api → localhost:3001
│   │   ├── tailwind.config.js     # Tailwind setup
│   │   ├── index.html             # SPA entry
│   │   └── src/
│   │       ├── App.tsx            # Layout shell (header, grid, sidebar)
│   │       ├── main.tsx           # ReactDOM render
│   │       └── components/
│   │           ├── RevenueCounter.tsx   # 3 stat cards (recovery, upsell, buyer)
│   │           ├── LedgerFeed.tsx       # Live-updating audit ledger + source badges
│   │           ├── DecisionDetail.tsx   # Expandable check-by-check breakdown
│   │           ├── MandatePanel.tsx     # Issue/Revoke mandates with scope controls
│   │           ├── AgentAccessPanel.tsx # Protocol surface (MCP, manifest, webhook URLs)
│   │           ├── PolicyPanel.tsx      # Inline-editable policy controls
│   │           └── AgentTriggers.tsx    # Buttons/inputs to trigger agents
│   │
│   └── external-buyer-demo/
│       ├── package.json           # Independent package (NO shared imports from server)
│       └── src/
│           ├── index.mjs          # Main agent: discover → connect → browse → reason → buy
│           └── llm.mjs            # Independent Bedrock LLM client (copy, not import)
│
├── test-mcp-client.mjs            # Throwaway MCP client test script (Step 1 verification)
└── vyapar.db                      # SQLite database (auto-created on first run)
```

---

## 5. Environment & Configuration

### `.env` file (project root)

```env
# Razorpay Test Mode API Keys
RAZORPAY_KEY_ID=rzp_test_...          # Test-mode key ID
RAZORPAY_KEY_SECRET=...               # Test-mode secret

# Razorpay Webhook Verification
RAZORPAY_WEBHOOK_SECRET=whsec_...     # HMAC-SHA256 signing key for webhook payloads

# AWS Bedrock (Claude access)
BEDROCK_API_KEY=ABSK...               # ABSK-prefixed key (used as both accessKeyId AND secretAccessKey)
AWS_REGION=ap-south-1                 # AWS region for Bedrock
BEDROCK_MODEL_ID=global.anthropic.claude-sonnet-4-6  # Model identifier

# Server
PORT=3001                             # Express server port
```

### Environment Loading Strategy

The `env.ts` module is imported as the **very first line** in `index.ts` to solve an ESM import hoisting problem. Without this, `dotenv.config()` would execute after other imports that read `process.env` at module load time.

```typescript
// env.ts — tries multiple paths to find .env
const paths = [
  path.resolve(process.cwd(), '../../.env'),  // From packages/server/
  path.resolve(process.cwd(), '.env'),         // Direct execution
  path.resolve(__dirname, '../../../.env'),     // __dirname fallback
];
```

### Bedrock Authentication

The ABSK-prefixed API key is used as **both** `accessKeyId` and `secretAccessKey` in the AWS SDK credentials object. This is how Bedrock's API key authentication works (as opposed to IAM role-based auth).

```typescript
credentials: {
  accessKeyId: process.env.BEDROCK_API_KEY,
  secretAccessKey: process.env.BEDROCK_API_KEY,
}
```

---

## 6. Database Layer

### Engine: SQLite via `better-sqlite3`

- **WAL mode** enabled for concurrent reads during writes
- Single file: `vyapar.db` in the working directory
- Synchronous API (no async needed for DB calls) — simplifies the gateway's sequential check pipeline

### Schema (4 tables)

#### `catalog_items` — Product catalog

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | e.g. `item_001` |
| title | TEXT | Product name |
| description | TEXT | Human-readable description |
| price_paise | INTEGER | Price in paise (100 paise = ₹1) |
| category | TEXT | skincare, haircare, bodycare, wellness, accessories |
| stock | INTEGER | Available quantity |
| pairs_with_ids | TEXT (JSON) | Array of complementary item IDs |
| is_active | INTEGER | 1 = available, 0 = hidden |

#### `policy_config` — Merchant policy rules

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| merchant_id | TEXT PK | 'default' | Merchant identifier |
| max_per_transaction_paise | INTEGER | 300000 (₹3,000) | Max single transaction |
| max_daily_velocity_paise | INTEGER | 1000000 (₹10,000) | Max daily spend |
| max_daily_txn_count | INTEGER | 20 | Max transactions per day |
| discount_ceiling_pct | INTEGER | 15 | Max discount agents can offer |
| mandate_expiry_minutes | INTEGER | 60 | Mandate validity duration |
| merchant_allowlist_json | TEXT (JSON) | [] | Allowed buyer counterparties |
| category_allowlist_json | TEXT (JSON) | ["skincare","haircare","bodycare","wellness","accessories"] | Allowed product categories |
| updated_at | TEXT | datetime('now') | Last modification timestamp |

#### `mandates` — Agent authorization tokens

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | e.g. `mandate_growth_001` |
| agent_id | TEXT | 'growth' or 'buyer' |
| principal | TEXT | Who granted the mandate |
| granted_at | TEXT | ISO timestamp |
| expires_at | TEXT | ISO timestamp (24h from seed) |
| revoked | INTEGER | 0 = active, 1 = revoked |

#### `ledger` — Append-only audit trail

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID v4 |
| timestamp | TEXT | ISO timestamp |
| agent_type | TEXT | 'growth' or 'buyer' |
| proposal_json | TEXT | Full serialized proposal |
| checks_json | TEXT | Array of check results |
| decision_json | TEXT | Full decision object |
| razorpay_call_json | TEXT | What was sent to Razorpay (null if denied) |
| razorpay_response_json | TEXT | What Razorpay returned (null if denied/errored) |
| final_status | TEXT | 'executed', 'denied', or 'error' |
| human_readable_explanation | TEXT | Template-generated explanation |
| amount_paise | INTEGER | Transaction amount |
| category | TEXT | Product category |

**Indexes:** `idx_ledger_timestamp` (DESC), `idx_ledger_agent_type`, `idx_ledger_final_status`

---

## 7. Product Catalog

### D2C Skincare & Wellness Store

The seeded catalog contains **15 products** across 5 categories, designed to enable realistic cross-sell/upsell scenarios via `pairs_with_ids` relationships:

| ID | Product | Price | Category |
|----|---------|-------|----------|
| item_001 | Gentle Face Wash | ₹450 | skincare |
| item_002 | Daily Moisturizer SPF 30 | ₹650 | skincare |
| item_003 | Vitamin C Serum | ₹890 | skincare |
| item_004 | Hydrating Toner | ₹550 | skincare |
| item_005 | Anti-Dandruff Shampoo | ₹380 | haircare |
| item_006 | Nourishing Conditioner | ₹420 | haircare |
| item_007 | Hair Growth Oil | ₹350 | haircare |
| item_008 | Body Lotion Cocoa Butter | ₹480 | bodycare |
| item_009 | Exfoliating Body Scrub | ₹520 | bodycare |
| item_010 | Natural Deodorant Stick | ₹320 | bodycare |
| item_011 | Ashwagandha Capsules | ₹590 | wellness |
| item_012 | Multivitamin Gummies | ₹450 | wellness |
| item_013 | Collagen Powder | ₹1,250 | wellness |
| item_014 | Jade Face Roller | ₹750 | accessories |
| item_015 | Bamboo Makeup Brush Set | ₹950 | accessories |

### Cross-sell Relationships (pairs_with_ids)

Every product links to 2-3 complementary items. Examples:
- Face Wash pairs with Moisturizer + Vitamin C Serum
- Vitamin C Serum pairs with Face Wash + Moisturizer
- Shampoo pairs with Conditioner + Hair Oil

This graph powers the Growth Agent's upsell logic — after a purchase, it recommends from `pairs_with_ids`.

---

## 8. Policy System (Bounded Rules)

### What "Bounded" Means

The word "bounded" is central to this project. It means:

1. **Every agent action has a maximum scope** — defined by numerical caps, not by prompt instructions
2. **The bounds are enforced by code the agent cannot modify** — the gateway reads from the database, not from the agent's output
3. **Bounds are independently editable** — a merchant changes a cap in the dashboard, next agent call sees the new limit instantly

### Default Policy Configuration

| Rule | Value | Purpose |
|------|-------|---------|
| Per-Transaction Cap | ₹3,000 (300000 paise) | No single agent action can exceed this |
| Daily Velocity Cap | ₹10,000 (1000000 paise) | Total daily spending across all agents |
| Daily Transaction Count | 20 | Max number of transactions per day |
| Discount Ceiling | 15% | Growth agent cannot offer discounts above this |
| Mandate Expiry | 60 minutes (refreshed to 24h on seed) | Agents must have a valid mandate to operate |
| Category Allowlist | skincare, haircare, bodycare, wellness, accessories | Only these categories are transactable |
| Merchant Allowlist | [] (empty = no restriction) | For buyer agent counterparty validation |

### Live Editability

All policy values can be changed live via:
- `PATCH /api/policy` with any subset of fields
- The dashboard PolicyPanel (inline editing for all 5 numeric fields)

Changes take effect on the **next** proposal — no server restart needed. This enables the graceful failure demo: lower the cap, trigger agent, watch it get denied.

---

## 9. Policy Gateway — The 6 Checks

The gateway runs checks **in order** and **stops at the first failure**. This is deliberate: it shows exactly which check blocked the proposal, and doesn't waste compute on subsequent checks after a failure.

### Check Pipeline (sequential, fail-fast)

```
Proposal arrives
    │
    ▼
[1] Mandate Check ─── Is there a valid, non-expired, non-revoked mandate?
    │ PASS
    ▼
[2] Per-Transaction Cap ─── Is amount_paise <= max_per_transaction_paise?
    │ PASS
    ▼
[3] Velocity Cap ─── Would this push daily total/count over the limit?
    │ PASS
    ▼
[4] Category Allowlist ─── Is the product category in the allowed list?
    │ PASS
    ▼
[5] Discount Ceiling ─── Is discount_pct (if any) <= ceiling?
    │ PASS
    ▼
[6] Idempotency ─── Has this exact same proposal been seen in the last 60s?
    │ PASS
    ▼
ALL PASSED → Execute on Razorpay → Write ledger (status: executed)
```

If **any** check fails:
```
Check N FAILS → Stop checking → Build denial Decision → Write ledger (status: denied)
                                                        (NO Razorpay call)
```

### Check 1: Mandate (`mandate.ts`)

**Purpose:** Every agent must have explicit authorization to operate.

**Logic:**
```sql
SELECT * FROM mandates
WHERE agent_id = ? AND revoked = 0 AND expires_at > NOW()
ORDER BY granted_at DESC LIMIT 1
```

**Fail reason code:** `MANDATE_EXPIRED`

**Design note:** Mandates are time-boxed authorizations. They can be revoked instantly. This is analogous to OAuth token expiry — if a mandate expires, the agent cannot propose anything until re-authorized.

### Check 2: Per-Transaction Cap (`per-transaction-cap.ts`)

**Purpose:** No single action can exceed the merchant's maximum amount.

**Logic:** `proposal.amount_paise <= policy.max_per_transaction_paise`

**Fail reason code:** `PER_TRANSACTION_CAP_EXCEEDED`

**This is the primary demo check** — the graceful failure demo lowers this cap to ₹300, then the buyer agent tries to purchase a ₹890 item and gets denied.

### Check 3: Velocity Cap (`velocity-cap.ts`)

**Purpose:** Rate-limit total daily spending and transaction count.

**Logic:**
```sql
SELECT SUM(amount_paise), COUNT(*) FROM ledger
WHERE final_status = 'executed' AND timestamp >= today_midnight
```
Then: `existing_total + proposed_amount <= max_daily_velocity_paise` AND `existing_count + 1 <= max_daily_txn_count`

**Fail reason code:** `VELOCITY_CAP_EXCEEDED`

**Why this matters:** Even if individual transactions are small, a runaway agent loop could drain funds. The velocity cap prevents this.

### Check 4: Category Allowlist (`allowlist.ts`)

**Purpose:** Only certain product categories are transactable by agents.

**Logic:** `policy.category_allowlist.includes(proposal.category)`

Also checks merchant allowlist for buyer agent counterparties (if configured).

**Fail reason code:** `CATEGORY_NOT_ALLOWED`

### Check 5: Discount Ceiling (`discount-ceiling.ts`)

**Purpose:** The growth agent can offer discounts for cart recovery, but they cannot exceed the merchant's ceiling.

**Logic:** `proposal.discount_pct <= policy.discount_ceiling_pct` (skipped if discount_pct is 0 or undefined)

**Fail reason code:** `DISCOUNT_CEILING_EXCEEDED`

### Check 6: Idempotency (`idempotency.ts`)

**Purpose:** Prevent duplicate proposals from creating duplicate Razorpay resources.

**Logic:** Check if a proposal with the same `(agent_type, action, amount_paise, counterparty)` was submitted in the last **60 seconds**.

```sql
SELECT id FROM ledger
WHERE agent_type = ? AND json_extract(proposal_json, '$.action') = ?
  AND amount_paise = ? AND json_extract(proposal_json, '$.counterparty') = ?
  AND timestamp > (now - 60s)
```

**Fail reason code:** `DUPLICATE_DETECTED`

**Window:** 60 seconds (configurable in code via `DEDUP_WINDOW_SECONDS`)

---

## 10. Mandate System (AP2/UAP/UPI Circle)

### What Is a Mandate?

A mandate is a **human-issued, scoped, time-boxed, revocable** authorization that delegates spending authority from a principal (merchant/customer) to an AI agent. This mirrors three real-world protocols:

- **AP2 (Agent Payment Protocol)** — cryptographic proof that a human authorized an agent to spend, within limits
- **NPCI UAP (Unified Agent Protocol)** — India-specific, built on UPI Circle's delegated-payments feature
- **UPI Circle** — a primary user delegates a spending-capped mandate to a secondary party

Vyapar implements the *pattern* these protocols standardize (scoped delegation), honestly labeled as a demo simplification (no cryptographic signatures — `consent_method: dashboard_click`).

### Mandate Fields

| Field | Example | Purpose |
|-------|---------|---------|
| id | mandate_buyer_11d26730 | Unique identifier (serves as mandate_token) |
| agent_id | growth / buyer | Which agent this authorizes |
| principal | merchant_default | Who granted the mandate |
| granted_at | 2026-08-25T09:00:00Z | When authorization was given |
| expires_at | 2026-08-25T10:00:00Z | When it becomes invalid (time-boxed) |
| revoked | 0 / 1 | Can be set to 1 to immediately invalidate |
| scope_max_amount_paise | 50000 (₹500) | Maximum per-transaction amount this mandate allows |
| scope_category_json | ["skincare"] | Array of categories this mandate permits |
| issued_by | merchant_owner | Human-readable string of who issued it |
| consent_method | dashboard_click | How consent was obtained (honest labeling) |

### Scope Enforcement

The mandate check validates **three things**:
1. **Existence + validity** — a non-expired, non-revoked mandate exists for this agent
2. **Amount scope** — `proposal.amount_paise <= mandate.scope_max_amount_paise`
3. **Category scope** — `proposal.category` is in `mandate.scope_category_json`

Two distinct denial codes:
- `MANDATE_EXPIRED` — no valid mandate found at all
- `MANDATE_SCOPE_EXCEEDED` — mandate exists but the proposal exceeds its scope

### Mandate Lifecycle

1. **Issue** — human clicks "Issue Mandate" in the dashboard (sets agent, amount cap, categories, expiry)
2. **Active** — agent can submit proposals within scope
3. **Revoke** — human clicks "Revoke" → mandate immediately invalid, next proposal fails
4. **Expire** — time passes → mandate auto-invalidates

### Seed Behavior

On server start, `seed.ts`:
- Creates two dev-convenience mandates if none exist (fresh database)
- Does NOT auto-refresh expired mandates — warns the user to issue one via the dashboard
- This ensures mandates are intentionally issued, not silently maintained

### API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/mandates` | List all mandates (with computed `is_active` field) |
| POST | `/api/mandates` | Issue a new mandate (agent_id, scope, expiry) |
| POST | `/api/mandates/:id/revoke` | Instantly revoke a mandate |

---

## 11. LLM Integration (AWS Bedrock)

### Connection Details

| Parameter | Value |
|-----------|-------|
| Service | AWS Bedrock Runtime |
| Model | `global.anthropic.claude-sonnet-4-6` |
| Region | `ap-south-1` |
| API | Converse API (not InvokeModel) |
| Auth | ABSK key as credentials |

### LLM Client Architecture (`llm-client.ts`)

**Lazy initialization:** The Bedrock client is created on first call (not at import time). This solves the ESM import hoisting issue where env vars aren't available at module load time.

```typescript
function getClient(): BedrockRuntimeClient {
  if (!_client) {
    _client = new BedrockRuntimeClient({ ... });
  }
  return _client;
}
```

### Converse API

We use the **Converse** API (not InvokeModel) because it provides:
- Native tool-use support
- Structured message format (role: user/assistant)
- Tool result handling
- Stop reason signaling (end_turn vs tool_use)

### Tool Definition Format

Tools are defined as `ToolDefinition` objects and converted to the Bedrock `Tool[]` format:

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>; // JSON Schema
}
```

### Response Parsing

The `callLlm()` function returns:
- `text`: concatenated text blocks from the response
- `toolCalls[]`: array of `{ toolUseId, name, input }` objects
- `stopReason`: 'end_turn' or 'tool_use'

---

## 12. Growth Agent

### File: `packages/server/src/agents/growth-agent.ts`

### Role

The Growth Agent operates **on behalf of the merchant** to increase revenue through:
1. **Cart Recovery** — re-engage customers who abandoned their carts
2. **Upsell/Cross-sell** — suggest complementary products after a purchase

### Tool Set (exactly 1 tool)

| Tool | Purpose |
|------|---------|
| `submit_proposal` | Submit a structured proposal to the Policy Gateway |

**No Razorpay tool. No ledger tool. No catalog write tool.**

### System Prompt Constraints

The system prompt explicitly states:
- "YOU MUST NOT access payment systems directly"
- "YOU MUST NOT make any financial transactions yourself"
- "YOU CAN ONLY submit proposals via the submit_proposal tool"

### Context Provided to Agent

| Data | Purpose |
|------|---------|
| Full product catalog | So it can identify cross-sell opportunities |
| Current policy limits | So it can self-limit (but gateway is the real enforcement) |
| Scenario context | Customer details, abandoned items, order history |

### Cart Recovery Flow

1. Receives abandoned cart context (customer name, items, cart total, abandonment reason)
2. Analyzes the situation
3. Proposes a `create_payment_link` for the cart amount (optionally with a small discount)
4. Includes `original_order_id` to flag this as recovery (not net-new revenue)

### Upsell Flow

1. Receives completed order context (what was purchased)
2. Looks at `pairs_with_ids` in the catalog
3. Proposes a `create_payment_link` for a complementary product
4. No discount (it's a new recommendation, not a recovery)

### Agent Loop

Max **3 turns**:
1. Agent receives scenario → reasons → calls `submit_proposal`
2. Gateway result returned as tool result → agent formulates response
3. Agent produces final text (acknowledgment or explanation of denial)

### Simulated Scenarios (seeded for demo)

**Cart Recovery scenario:**
```json
{
  "customer_id": "cust_demo_001",
  "customer_name": "Priya Sharma",
  "abandoned_items": [
    {"id": "item_003", "name": "Vitamin C Serum", "price_paise": 89000},
    {"id": "item_004", "name": "Hydrating Toner", "price_paise": 55000}
  ],
  "cart_total_paise": 144000,
  "abandoned_at": "2h ago",
  "reason": "Payment failed — card declined"
}
```

**Upsell scenario:**
```json
{
  "customer_id": "cust_demo_002",
  "customer_name": "Rahul Verma",
  "completed_order": {
    "items": [{"id": "item_001", "name": "Gentle Face Wash", "price_paise": 45000}],
    "total_paise": 45000,
    "completed_at": "30min ago"
  }
}
```

---

## 13. Buyer Agent

### File: `packages/server/src/agents/buyer-agent.ts`

### Role

The Buyer Agent represents an **external** AI shopper — proving that any AI agent (not just ones built by the merchant) can transact with this store through a structured interface.

### Tool Set (exactly 2 tools)

| Tool | Purpose |
|------|---------|
| `browse_catalog` | Read-only access to the product catalog |
| `submit_proposal` | Submit a purchase proposal to the Policy Gateway |

**No Razorpay tool. No write access to anything.**

### System Prompt Framing

> "You are an external AI Buyer Agent shopping on behalf of a customer at a D2C skincare/wellness store called Vyapar. You represent an external AI buyer — you are NOT part of this merchant's system."

### Buyer Agent Flow

1. Receives natural-language shopping request (e.g. "Find me a birthday gift under ₹1,500")
2. Calls `browse_catalog` to see available products
3. Analyzes products against the customer's request
4. Calls `submit_proposal` with exact catalog price (no discounts — buyer agents don't set discounts)
5. If denied, explains why and suggests alternatives
6. If approved, confirms the purchase was successful

### Agent Loop

Max **5 turns** (more than growth agent because it needs: browse → reason → propose → handle → respond):
1. Receive request → call `browse_catalog`
2. Receive catalog → analyze → call `submit_proposal`
3. Receive gateway result → formulate customer-facing response

### Key Constraint

The buyer agent must use the **exact catalog price** in `amount_paise`. Unlike the growth agent (which can apply discounts), the buyer agent pays full price — it's representing the customer, not the merchant.

---

## 14. Razorpay MCP Integration

### File: `packages/server/src/razorpay/mcp-client.ts`

### What is MCP?

MCP (Model Context Protocol) is a standard for AI tools. Razorpay exposes their test-mode API as an MCP server at `https://mcp.razorpay.com/mcp`.

### Connection Strategy

The client tries **two transport methods** in order:

1. **StreamableHTTP** (preferred) — newer, more efficient
2. **SSE** (fallback) — Server-Sent Events based transport

```typescript
// Try StreamableHTTP first
const transport = new StreamableHTTPClientTransport(url, { headers: { Authorization } });
await client.connect(transport);

// If that fails, fall back to SSE
const sseTransport = new SSEClientTransport(url, { headers: { Authorization } });
await client.connect(sseTransport);
```

### Authentication

HTTP Basic Auth with `key_id:key_secret` base64-encoded:
```typescript
'Basic ' + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')
```

### Available MCP Tools (from Razorpay)

The gateway uses these Razorpay MCP tools:
- `create_payment_link` — creates a shareable payment link
- `create_order` — creates a Razorpay order
- `create_refund` — initiates a refund (not used in demo)

### Execution Layer (`execution.ts`)

A thin wrapper that:
1. Calls `callMcpTool(action, params)`
2. Returns `{ success: true, razorpay_response }` on success
3. Returns `{ success: false, error: message }` on failure (writes to ledger as `status: error`)

### Connection Lifecycle

- Client is created lazily on first use
- Singleton pattern — one connection shared across all gateway calls
- `disconnectMcp()` available for clean shutdown

---

## 15. Audit Ledger

### File: `packages/server/src/ledger/ledger.ts`

### Core Guarantee

**Every proposal that enters `processProposal()` produces exactly one ledger row.** There are three paths:

| Path | final_status | razorpay_call_json | razorpay_response_json |
|------|-------------|--------------------|-----------------------|
| Approved + executed | `executed` | action details | Razorpay response |
| Denied by gateway | `denied` | null | null |
| Approved but Razorpay errored | `error` | action details | null |

### Append-Only

The ledger table has no `UPDATE` or `DELETE` operations anywhere in the codebase. Once a row is written, it is permanent. This is the "audit trail" that makes every AI action accountable.

### Data Stored Per Row

Each ledger row contains the **complete lifecycle** of a proposal:
- The full proposal (who, what, why, how much)
- Every policy check result (pass/fail + detail string)
- The decision (verdict + reason code + reason text)
- What was sent to Razorpay (if anything)
- What Razorpay returned (if anything)
- A human-readable explanation

### Query Patterns

| Function | Purpose |
|----------|---------|
| `writeLedgerEntry()` | Append a new row |
| `getLedgerEntries(limit, offset)` | Paginated newest-first |
| `getLedgerEntry(id)` | Single row by UUID |
| `getLedgerEntriesSince(sinceId)` | All rows newer than a given ID (for SSE) |

---

## 16. Human-Readable Explanations

### File: `packages/server/src/ledger/explain.ts`

### Purpose

Every ledger row has a one-line English explanation suitable for non-technical readers (e.g. a merchant reviewing their agent's activity).

### Template System

Explanations are generated **deterministically** (no LLM) using templates:

**Denial templates:**
| Reason Code | Template |
|-------------|----------|
| MANDATE_EXPIRED | "Denied: no valid mandate for {agent}-agent." |
| PER_TRANSACTION_CAP_EXCEEDED | "Denied: proposed ₹{amount} exceeds per-transaction cap for {agent}-agent." |
| VELOCITY_CAP_EXCEEDED | "Denied: daily spending/transaction limit would be breached by this ₹{amount} proposal." |
| CATEGORY_NOT_ALLOWED | "Denied: category "{category}" is not in the merchant's allowed categories for {agent}-agent." |
| DISCOUNT_CEILING_EXCEEDED | "Denied: discount of {pct}% exceeds the {detail}." |
| DUPLICATE_DETECTED | "Denied: duplicate proposal detected — same action recently submitted by {agent}-agent." |

**Approval templates:**
| Action | Template |
|--------|----------|
| create_payment_link | "Approved and executed: ₹{amount} payment link created {context}." |
| create_order | "Approved and executed: ₹{amount} order created {context}." |
| create_refund | "Approved and executed: ₹{amount} refund initiated {context}." |

Context suffixes:
- Growth agent with `original_order_id`: "for cart recovery (order {id})"
- Growth agent without: "for upsell/cross-sell"
- Buyer agent: "by buyer-agent"

---

## 17. API Endpoints

### Base URL: `http://localhost:3001/api`

### Policy Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/policy` | Get current policy configuration |
| PATCH | `/policy` | Update policy (partial update, any subset of fields) |

**PATCH body example:**
```json
{
  "max_per_transaction_paise": 30000,
  "discount_ceiling_pct": 10
}
```

### Catalog Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/catalog` | All active catalog items |
| GET | `/catalog/:id` | Single item by ID |
| GET | `/catalog/category/:category` | Filter by category |

### Ledger Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/ledger` | Paginated entries (query: `limit`, `offset`, `since`) |
| GET | `/ledger/:id` | Full detail for one entry (parsed JSON fields) |
| GET | `/ledger/stream` | SSE endpoint for live updates |

### Agent Trigger Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/agents/growth/cart-recovery` | Trigger cart recovery agent with seeded scenario |
| POST | `/agents/growth/upsell` | Trigger upsell agent with seeded scenario |
| POST | `/agents/buyer/shop` | Trigger buyer agent with custom request |

**Buyer agent body:**
```json
{ "request": "Find me a birthday gift under ₹1,500" }
```

### Mandate Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/mandates` | All mandates (active, expired, revoked) |
| POST | `/mandates` | Issue new mandate (agent_id, scope_max_amount, categories, expires_at) |
| POST | `/mandates/:id/revoke` | Revoke an active mandate immediately |

**Issue mandate body:**
```json
{
  "agent_id": "buyer",
  "scope_max_amount_paise": 100000,
  "scope_categories": ["skincare", "haircare"],
  "expires_at": "2024-12-31T23:59:59Z"
}
```

### Webhook Endpoint

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/webhooks/razorpay` | Razorpay event receiver (signature-verified) |

Requires `X-Razorpay-Signature` header (HMAC-SHA256 of raw body with `RAZORPAY_WEBHOOK_SECRET`). Handles `payment_link.paid` and `order.paid` events — auto-triggers Growth Agent upsell.

### Protocol & Discovery Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/.well-known/agent-commerce.json` | Discovery manifest (capabilities, policy URL, MCP endpoint) |
| GET | `/api/policy/public` | Public policy summary (caps, categories — no secrets) |
| POST | `/mcp` | MCP server endpoint (StreamableHTTP transport) |
| DELETE | `/mcp` | MCP session teardown |

### Health Check

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Server health status |

---

## 18. Dashboard Components

### Layout (`App.tsx`)

```
┌─────────────────────────────────────────────────────────┐
│ Vyapar [TEST MODE] [MCP]                                 │
│ Bounded Agentic Commerce on Razorpay                     │
│ Protocol-interoperable: MCP + .well-known + AP2/UAP      │
├─────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐                 │
│ │Cart Recov│ │  Upsell  │ │ AI Buyer │                 │
│ │  ₹1,440  │ │   ₹650   │ │   ₹890   │                 │
│ └──────────┘ └──────────┘ └──────────┘                 │
├───────────────────────┬─────────────────────────────────┤
│                       │                                 │
│   Audit Ledger        │  Mandates (Issue/Revoke/View)   │
│   (live-updating)     │                                 │
│                       ├─────────────────────────────────┤
│   [green] EXECUTED    │  Protocol Surface               │
│     [MCP EXTERNAL]    │  (MCP Endpoint, Manifest URL,   │
│   [red]   DENIED      │   Webhook Receiver, Ext Buyer)  │
│     [INTERNAL]        │                                 │
│   [green] EXECUTED    ├─────────────────────────────────┤
│     [WEBHOOK]         │  Policy Controls                │
│                       │  (inline-editable caps)         │
│   (click to expand)   │                                 │
│                       ├─────────────────────────────────┤
│                       │  Agent Triggers                 │
│                       │  [Cart Recovery] [Upsell]       │
│                       │  [___input___] [Shop]           │
│                       │                                 │
└───────────────────────┴─────────────────────────────────┘
```

### Component Details

#### `RevenueCounter.tsx`

Three stat cards tracking agent performance:
- **Cart Recovery** — sum of `amount_paise` where `agent_type=growth` and `original_order_id` exists and `final_status=executed`
- **Upsell Revenue** — sum of growth-agent executed proposals WITHOUT `original_order_id`
- **AI Buyer** — sum of `amount_paise` where `agent_type=buyer` and `final_status=executed`

Polls `/api/ledger?limit=1000` every 5 seconds.

#### `LedgerFeed.tsx`

- Connects to `/api/ledger/stream` via SSE
- Falls back to polling if SSE fails
- Color-coded entries: green (executed), red (denied), yellow (error)
- Each entry shows: status badge, agent type badge, **source badge**, timestamp, explanation, amount
- Dynamic source badge via `getTriggerBadge()`:
  - **WEBHOOK** (purple) — triggered by Razorpay payment event
  - **MCP EXTERNAL** (cyan) — external agent via MCP protocol
  - **INTERNAL** (blue) — internal buyer agent
  - **SIMULATED** (amber) — dashboard button click
- Click to expand → shows `DecisionDetail`
- Max height with scroll (600px)

#### `DecisionDetail.tsx`

Expanded view for a ledger entry showing:
- **Proposal section** — grid of: action, amount, category, agent type, reasoning
- **Policy Gateway Checks** — vertical pipeline with colored circles (green check / red X), labels, PASS/FAIL badges, detail text
- **Decision section** — colored card (green/red) with verdict, reason code, reason text
- **Footer** — entry ID + triggered_by badge + TEST MODE badge

#### `MandatePanel.tsx`

Mandate lifecycle management:
- **Issue Mandate form** — select agent_id, set scope_max_amount, choose categories (multi-select), set expiry duration
- **Active mandates** — listed with ACTIVE badge, scope summary, Revoke button
- **History** — collapsible section showing expired/revoked mandates with status badges
- Calls: `GET /api/mandates`, `POST /api/mandates`, `POST /api/mandates/:id/revoke`

#### `AgentAccessPanel.tsx` (Protocol Surface)

Shows 4 copy-pasteable protocol entry points:
- **MCP Endpoint** (indigo) — `http://host:3001/mcp`
- **Discovery Manifest** (gray) — `http://host:3001/.well-known/agent-commerce.json`
- **Webhook Receiver** (purple) — `http://host:3001/api/webhooks/razorpay`
- **External Buyer Command** (emerald) — `npm run external-buyer`
- Each has a Copy button with "Copied!" confirmation

#### `PolicyPanel.tsx`

Live-editable controls for all 5 policy values:
- Per-Transaction Cap (highlighted in blue — primary demo control)
- Daily Velocity Cap
- Daily Txn Limit
- Discount Ceiling (%)
- Mandate Expiry (minutes)

Each has: input field, Save button, "Updated!" confirmation.
Also shows category allowlist as green badges (read-only display).

#### `AgentTriggers.tsx`

- **Growth Agent** section: two trigger buttons
  - "Simulate Abandoned Cart" — runs cart-recovery scenario
  - "Simulate Completed Order" — runs upsell scenario
  - Both show SIMULATED badges
- **AI Buyer Agent** section: free-text input + Shop button
- **Result display** — shows verdict badge (APPROVED/DENIED/ERROR), reason code, agent's natural-language response

---

## 19. SSE Real-Time Feed

### Endpoint: `GET /api/ledger/stream`

### Protocol

Standard Server-Sent Events (text/event-stream). Headers:
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

### Message Format

**Initial payload (on connect):**
```json
{"type": "init", "entries": [/* last 20 entries */]}
```

**Update payload (new entries):**
```json
{"type": "update", "entries": [/* new entries since last check */]}
```

### Server-Side Polling

The SSE endpoint polls the database every 2 seconds for new entries (comparing latest entry ID). This is simpler than database triggers and works well for the demo's update frequency.

### Client-Side Fallback

If SSE connection fails, the dashboard falls back to polling `GET /api/ledger?limit=50` every 3 seconds.

---

## 20. Graceful Failure Flow

### The Deliberate Denial Demo

This is a core demo requirement: prove that denials are handled gracefully, not as errors.

### Step-by-Step Sequence

```
1. Merchant lowers Per-Transaction Cap:  ₹3,000 → ₹300
   (via PATCH /api/policy or dashboard PolicyPanel)

2. Customer says: "I want to buy the Vitamin C Serum"
   (submitted to POST /api/agents/buyer/shop)

3. Buyer Agent browses catalog:
   → Finds Vitamin C Serum: ₹890 (item_003)

4. Buyer Agent submits proposal:
   {
     action: "create_payment_link",
     amount_paise: 89000,
     category: "skincare",
     ...
   }

5. Policy Gateway processes proposal:
   [1] Mandate: ✓ PASS (active mandate exists)
   [2] Per-Txn Cap: ✗ FAIL (₹890 > ₹300 cap)
   [3-6] NOT REACHED (fail-fast)

6. Gateway returns Decision:
   {
     verdict: "denied",
     reason_code: "PER_TRANSACTION_CAP_EXCEEDED",
     reason_text: "₹890 exceeds per-transaction cap of ₹300"
   }

7. NO Razorpay call is made.

8. Ledger entry written:
   {
     final_status: "denied",
     human_readable_explanation: "Denied: proposed ₹890 exceeds per-transaction cap for buyer-agent."
   }

9. Buyer Agent receives denial as tool result.

10. Buyer Agent responds gracefully:
    "I'm sorry, but the purchase of the Vitamin C Serum (₹890) was denied because
     it exceeds the current per-transaction cap. Here are some alternatives under ₹300:
     - Natural Deodorant Stick (₹320)... actually, let me check..."

11. Dashboard shows:
    - Red ledger row with "DENIED" badge
    - Explanation text
    - Expandable detail showing which check failed
```

### Why This Matters

- The agent doesn't crash or throw an error
- It acknowledges the denial in natural language
- It suggests alternatives
- The ledger has a complete record of what happened and why
- The denial explanation is **deterministic** (same inputs always produce same explanation)

---

## 21. Zod Schemas & Type Safety

### File: `packages/server/src/agents/types.ts`

### Why Zod?

Zod validates LLM output at runtime. An LLM might return malformed JSON or violate constraints. Zod schemas catch this at the boundary between "LLM world" (unpredictable) and "gateway world" (deterministic).

### Schema Definitions

#### `ProposalSchema`

```typescript
{
  proposal_id: z.string(),
  agent_type: z.enum(['growth', 'buyer']),
  agent_reasoning: z.string(),
  action: z.enum(['create_payment_link', 'create_order', 'create_refund']),
  amount_paise: z.number().int().positive(),
  currency: z.string().default('INR'),
  merchant_id: z.string().default('default'),
  counterparty: z.string(),
  category: z.string(),
  requested_at: z.string(),
  description: z.string().optional(),
  discount_pct: z.number().min(0).max(100).optional(),
  original_order_id: z.string().optional(),
  item_ids: z.array(z.string()).optional(),
  triggered_by: z.enum(['simulated_button', 'webhook', 'mcp_external', 'internal']).optional(),
}
```

Key validations:
- `amount_paise` must be a positive integer (no negative amounts, no decimals)
- `action` is constrained to exactly 3 possible values
- `agent_type` can only be 'growth' or 'buyer'
- `discount_pct` is bounded 0-100
- `triggered_by` tracks proposal origin — used for dashboard badges and audit trail

#### `PolicyCheckResultSchema`

```typescript
{
  check_name: z.string(),
  passed: z.boolean(),
  detail: z.string(),
}
```

#### `DecisionSchema`

```typescript
{
  proposal_id: z.string(),
  verdict: z.enum(['approved', 'denied']),
  reason_code: z.string(),
  reason_text: z.string(),
  checks: z.array(PolicyCheckResultSchema),
  checked_at: z.string(),
}
```

#### `OutcomeSchema`

```typescript
{
  proposal_id: z.string(),
  razorpay_action: z.string().nullable(),
  razorpay_response: z.unknown().nullable(),
  final_status: z.enum(['executed', 'denied', 'error']),
  executed_at: z.string(),
  error_message: z.string().optional(),
}
```

### Validation Point

Zod parsing happens **after** the LLM returns tool-use output and **before** the proposal enters the gateway:

```typescript
const proposal: Proposal = ProposalSchema.parse({ ...llmOutput });
const gatewayResult = await processProposal(proposal);
```

If the LLM produces invalid output (e.g. negative amount, unknown action), `ProposalSchema.parse()` throws a ZodError and the agent endpoint returns a 500. This is a crash-level defense — the gateway itself never sees invalid proposals.

---

## 22. Test Mode & Razorpay Sandbox

### Test Mode Keys

All Razorpay API keys used are test-mode keys (prefixed with `rzp_test_`). Test mode means:
- **No real money moves** — all transactions are simulated by Razorpay
- **Payment links are created** but never need to be paid
- **Orders exist** in Razorpay's test dashboard but have no real-world effect
- Keys can be found in Razorpay's test-mode dashboard

### Razorpay MCP Server

The MCP server at `mcp.razorpay.com` accepts test-mode credentials and returns realistic response objects (with IDs, timestamps, amounts) — identical structure to production responses.

### Dashboard Indicators

Two visual indicators that this is test mode:
1. **Header badge:** "TEST MODE" in amber at the top of the page
2. **Ledger entries:** "SIMULATED" badge on each entry
3. **DecisionDetail footer:** "TEST MODE" badge

### No Production Path

There is intentionally **no configuration switch** to enable production mode. This project is designed for demonstration only. If someone wanted to go to production, they would need to:
- Replace test keys with live keys
- Add real authentication/authorization
- Add rate limiting
- Add proper error retry logic
- Remove seeded scenarios and add real event sources
- Add monitoring and alerting

---

## 23. Data Flow: End-to-End Sequence

### Complete lifecycle of a buyer agent request

```
[User] types "Buy me the Vitamin C Serum" in dashboard
           │
           ▼
[Dashboard] POST /api/agents/buyer/shop { request: "..." }
           │
           ▼
[routes.ts] calls runBuyerAgent(request)
           │
           ▼
[buyer-agent.ts] builds context message with policy limits
           │
           ▼
[llm-client.ts] → AWS Bedrock Converse API
           │         model: global.anthropic.claude-sonnet-4-6
           │         tools: [browse_catalog, submit_proposal]
           │
           ▼
[Claude] reasons about the request
         calls tool: browse_catalog({})
           │
           ▼
[buyer-agent.ts] reads catalog from SQLite → returns product list to Claude
           │
           ▼
[Claude] analyzes products, picks Vitamin C Serum (₹890)
         calls tool: submit_proposal({
           action: "create_payment_link",
           amount_paise: 89000,
           category: "skincare",
           ...
         })
           │
           ▼
[buyer-agent.ts] validates with ProposalSchema.parse()
                 generates proposal_id: "prop_buyer_a1b2c3d4"
           │
           ▼
[policy-gateway.ts] processProposal(proposal)
           │
           ├─ [1] checkMandate() → PASS
           ├─ [2] checkPerTransactionCap() → PASS (₹890 <= ₹3000)
           ├─ [3] checkVelocityCap() → PASS
           ├─ [4] checkAllowlist() → PASS (skincare is allowed)
           ├─ [5] checkDiscountCeiling() → PASS (no discount)
           └─ [6] checkIdempotency() → PASS (no recent duplicate)
           │
           ▼
       ALL PASSED → Decision { verdict: "approved" }
           │
           ▼
[execution.ts] executeOnRazorpay("create_payment_link", params)
           │
           ▼
[mcp-client.ts] callMcpTool → StreamableHTTP → mcp.razorpay.com
           │
           ▼
[Razorpay] creates test-mode payment link
           returns { id: "plink_xxx", short_url: "https://rzp.io/...", ... }
           │
           ▼
[policy-gateway.ts] Outcome { final_status: "executed", razorpay_response: {...} }
           │
           ▼
[ledger.ts] writeLedgerEntry(proposal, checks, decision, outcome)
            generates human_readable_explanation
            INSERT INTO ledger
           │
           ▼
[buyer-agent.ts] returns tool result to Claude:
                 { verdict: "approved", explanation: "..." }
           │
           ▼
[Claude] generates final response:
         "I've successfully purchased the Vitamin C Serum (₹890)!
          A payment link has been created..."
           │
           ▼
[routes.ts] returns JSON response to dashboard
           │
           ▼
[Dashboard] shows result with APPROVED badge + agent response
[LedgerFeed] SSE delivers new green entry within 2 seconds
[RevenueCounter] updates AI Buyer stat on next poll
```

---

## 24. Key Decisions & Trade-offs

### Why MCP instead of Razorpay REST API directly?

MCP (Model Context Protocol) was chosen because:
1. It's the hackathon's recommended integration path for Razorpay
2. It demonstrates AI-native tool interop (the gateway treats Razorpay as a "tool," same as agents treat `submit_proposal`)
3. It abstracts away REST endpoint details — the gateway just calls tool names

### Why SQLite instead of Postgres?

1. Zero configuration (no database server needed)
2. Single-file — easy to reset (`rm vyapar.db`)
3. WAL mode handles our concurrent read-during-write pattern
4. Better-sqlite3 is synchronous — no async overhead in the gateway pipeline
5. Hackathon scope — Postgres adds deployment complexity with no benefit at this scale

### Why Bedrock instead of Anthropic API directly?

The user's API key is an ABSK (Bedrock) key. Bedrock provides:
- Access to Claude models via AWS
- Regional deployment (ap-south-1)
- Single auth mechanism for all Claude capabilities

### Why SSE instead of WebSocket?

1. Simpler implementation (just HTTP)
2. Auto-reconnect built into the EventSource API
3. Server push is unidirectional (perfect for ledger updates)
4. No library needed on the client
5. Polling fallback is trivial to implement

### Why fail-fast in the gateway (stop at first failure)?

1. **Explainability** — "this check failed" is clearer than "these 3 checks failed"
2. **Efficiency** — no need to run expensive velocity queries if the mandate is expired
3. **Simplicity** — one reason code per denial, not an array

### Why template-based explanations instead of LLM-generated ones?

1. **Deterministic** — same inputs always produce the same explanation
2. **Fast** — no LLM call needed
3. **Trustworthy** — can't hallucinate or be manipulated
4. **Auditable** — if the explanation says "denied for cap exceeded," you know exactly why

---

## 25. Known Limitations

| Limitation | Why It's Acceptable |
|------------|--------------------| 
| Seeded scenarios (not real cart abandonment events) | Hackathon demo — clearly labeled as SIMULATED |
| No user authentication | Demo runs locally; no multi-tenant needed |
| No retry logic for Razorpay failures | Test mode rarely fails; errors are logged regardless |
| Category allowlist not editable from dashboard | All 5 categories are allowed; restriction would need UI for array editing |
| SSE polls every 2s (not true push) | Acceptable latency for demo; true push would need DB triggers or pub/sub |
| No production mode switch | Intentionally demo-only — see Section 22 |
| Agent doesn't learn from denials | Stateless per-invocation; no memory between calls |
| Single merchant ("default") | Multi-tenancy is out of scope for hackathon |
| TypeScript strict mode type errors in AWS SDK types | Existing upstream type incompatibilities in Bedrock SDK; doesn't affect runtime |
| Mandates are not cryptographically signed | `consent_method: dashboard_click` — production would need AP2-style proof-of-authorization |
| .well-known manifest is convention-compliant, not certified | No UCP certification exists yet; honest label in manifest |
| External buyer shares AWS Bedrock credentials (env var) | Independent process, but same AWS account; real multi-party would use separate billing |
| MCP server is stateful (session-based) | Matches MCP spec for StreamableHTTP; no horizontal scaling without session store |

---

## Summary of What Was Built

### BUILD_PLAN.md (Core System)

| Step | What | Status |
|------|------|--------|
| 1 | Monorepo scaffold, dependencies, configs | Done |
| 2 | SQLite schema, seed data, catalog API | Done |
| 3 | Type contracts (Zod), Policy Gateway (6 checks), Razorpay MCP client | Done |
| 4 | Integrated test: 3 proposals (approved, denied cap, denied category) | Done |
| 5 | Ledger API + SSE + LedgerFeed + DecisionDetail dashboard components | Done |
| 6 | Growth Agent (cart recovery + upsell, tool-use loop) | Done |
| 7 | Buyer Agent (browse + propose, external AI shopper) | Done |
| 8 | Deliberate graceful failure (lower cap → denial → agent explains) | Done |
| 9 | Dashboard polish (3 stat cards, full editable policy, improved checks UI, badges) | Done |
| 10 | README + demo script | Done |

### BUILD_PLAN2.md (Protocol Interoperability)

| Step | What | Status |
|------|------|--------|
| 1 | MCP server (Vyapar as tool provider for external agents) | Done |
| 2 | Discovery manifest (.well-known/agent-commerce.json + public policy) | Done |
| 3 | Mandate scope enforcement (amount + category in AP2/UAP style) | Done |
| 4 | Razorpay webhook receiver (signature-verified, auto-triggers Growth Agent) | Done |
| 5 | External buyer agent (independent package, discovers via protocol surface) | Done |
| 6 | Dashboard + narrative polish (badges, protocol surface panel, demo script) | Done |

**Total: 16/16 steps complete across both plans. Project is demo-ready.**

---

## 26. MCP Server — Vyapar as Tool Provider

### File: `packages/server/src/mcp-server/vyapar-mcp-server.ts`

### Purpose

Exposes Vyapar as an MCP-compatible tool provider so that any external AI agent (Claude Desktop, Claude Code, custom bots) can discover and transact with this merchant through the standard Model Context Protocol.

### Transport

Uses `StreamableHTTPServerTransport` (stateful, session-based). Each connecting client gets a unique session. The server is mounted at `POST /mcp` and `DELETE /mcp` (session teardown).

### Tools Exposed

| Tool Name | Description | Parameters |
|-----------|-------------|------------|
| `browse_catalog` | Browse merchant product catalog | `category` (optional filter) |
| `get_policy` | Read current merchant policy (caps, limits, categories) | none |
| `submit_purchase` | Submit a purchase proposal through the policy gateway | `item_id`, `quantity`, `mandate_token`, `reasoning` |

### Architecture Constraint

The MCP server does NOT call Razorpay or bypass any check. `submit_purchase` constructs a Proposal object (with `triggered_by: 'mcp_external'`) and passes it to `processProposal()` — the same gateway used by internal agents.

### Session Management

```typescript
const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID() });
const server = new McpServer({ name: 'vyapar-merchant', version: '1.0.0' });
server.connect(transport);
```

The session map is cleaned up on `DELETE /mcp` or when the transport's `onclose` fires.

---

## 27. Discovery Manifest

### File served: `GET /.well-known/agent-commerce.json`

### Purpose

A static JSON document that tells any crawling agent: "this merchant exists, here are its capabilities, here's how to connect." Follows the emerging UCP (Unified Commerce Protocol) convention for agent-to-merchant discovery.

### Manifest Contents

```json
{
  "schema_version": "0.1.0",
  "merchant": {
    "name": "Vyapar Demo Store",
    "description": "Bounded agentic commerce — skincare, haircare, wellness",
    "categories": ["skincare", "haircare", "wellness", "fragrance", "makeup"]
  },
  "capabilities": {
    "mcp_endpoint": "http://localhost:3001/mcp",
    "supported_actions": ["browse_catalog", "submit_purchase"],
    "policy_url": "http://localhost:3001/api/policy/public",
    "mandate_required": true,
    "test_mode": true
  },
  "protocol": {
    "transport": "StreamableHTTP",
    "auth": "mandate_token"
  }
}
```

### Public Policy Endpoint: `GET /api/policy/public`

Returns the merchant's policy configuration without any secrets — caps, velocity limits, allowed categories. External agents read this to understand what proposals will be accepted before submitting.

### Honesty Note

The manifest is convention-compliant but not certified. No official UCP registry exists yet. The `schema_version: "0.1.0"` and `test_mode: true` fields are honest labels.

---

## 28. Webhook Receiver

### File: `packages/server/src/webhooks/razorpay-webhook.ts`

### Purpose

Receives Razorpay payment events (e.g., `payment_link.paid`, `order.paid`) and auto-triggers the Growth Agent to run an upsell — no human click needed. This proves the system can react to real-world events, not just button presses.

### Signature Verification

Every incoming request is verified using HMAC-SHA256:

```typescript
function verifySignature(body: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const sigBuf = Buffer.from(signature, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expectedBuf);
}
```

Key details:
- Uses `crypto.timingSafeEqual` for constant-time comparison (prevents timing attacks)
- Requires raw body (captured via `express.json({ verify: ... })` middleware)
- Rejects requests with missing/invalid `X-Razorpay-Signature` header (HTTP 401)

### Event Handling

On successful verification:
1. Extracts payment amount and metadata from the event payload
2. Constructs a Growth Agent scenario with `triggered_by: 'webhook'`
3. Calls `runGrowthAgent(scenario)` which creates a Proposal → processProposal()
4. Returns HTTP 200 to Razorpay (acknowledgment)

### Registration in Express

```typescript
// index.ts
app.use(express.json({
  verify: (req: any, _res, buf) => { req.rawBody = buf.toString(); },
}));
app.use('/api', webhookRouter);
```

The raw body must be captured before JSON parsing destroys it — otherwise signature verification fails.

---

## 29. External Buyer Agent

### Directory: `packages/external-buyer-demo/`

### Purpose

An independent AI buyer that discovers, connects to, and transacts with the Vyapar merchant **through the protocol surface only** — proving true agent-to-agent commerce. Shares zero code with the server package.

### Architecture

```
External Buyer (separate process)
       │
       ├── 1. GET /.well-known/agent-commerce.json   → discovers merchant
       ├── 2. GET /api/policy/public                 → reads policy constraints
       ├── 3. GET /api/mandates                      → auto-discovers active mandate
       ├── 4. Connect to /mcp (StreamableHTTP)       → establishes MCP session
       ├── 5. Call browse_catalog tool                → sees available products
       ├── 6. LLM reasoning (Bedrock Claude Sonnet)  → picks best item for goal
       └── 7. Call submit_purchase tool              → proposal enters gateway
```

### Key Design Decisions

- **Independent LLM client** (`src/llm.mjs`) — copy of the Bedrock integration, not an import. Proves zero coupling.
- **Auto-discovery of mandates** — if `MANDATE_TOKEN` env var is not set, the agent calls `GET /api/mandates` and finds the first active buyer mandate.
- **Tool-use loop** — the LLM decides which MCP tools to call and in what order, based on the user's shopping goal.
- **No hardcoded URLs** — the merchant endpoint comes from `.well-known`, not a config constant.

### Usage

```bash
# With explicit mandate token:
MANDATE_TOKEN=xxx npm run external-buyer -- "Buy me a birthday gift under 1000 rupees"

# Auto-discover mandate (dev mode):
npm run external-buyer -- "Find me a moisturizer under 700 rupees"
```

### What the Demo Proves

1. **Discoverability** — the agent finds the merchant via `.well-known`
2. **Protocol compliance** — connects via standard MCP, not a custom API
3. **Bounded** — the same 6 policy checks (including mandate scope) apply
4. **Independent** — different process, different LLM instance, different package.json
5. **Auditable** — the proposal lands in the same ledger with `triggered_by: 'mcp_external'`

---

## 30. Protocol Interoperability Summary

### The Four Entry Points

| Entry Point | Source | triggered_by | How It Reaches Gateway |
|-------------|--------|--------------|----------------------|
| Dashboard button | Human clicks "Cart Recovery" or "Upsell" | `simulated_button` | routes.ts → runGrowthAgent() → processProposal() |
| Internal Buyer Agent | Dashboard input field | `internal` | routes.ts → runBuyerAgent() → processProposal() |
| MCP External Agent | Any MCP-capable AI client | `mcp_external` | vyapar-mcp-server.ts → processProposal() |
| Razorpay Webhook | payment_link.paid / order.paid event | `webhook` | razorpay-webhook.ts → runGrowthAgent() → processProposal() |

### Invariant

All four paths converge on `processProposal()` in `policy-gateway.ts`. The gateway is the **only** code path that calls Razorpay. No entry point bypasses any check.

### What Makes This "Protocol-Interoperable"

1. **Discovery** — `.well-known/agent-commerce.json` tells any agent where to connect
2. **Standard transport** — MCP over StreamableHTTP (not a custom REST API)
3. **Public policy** — agents can pre-check their proposals against published caps
4. **Mandate-based auth** — a scoped token (not an API key) delegates bounded authority
5. **Event-driven** — webhooks trigger autonomous agent behavior from real Razorpay events

### The AP2/UAP Analogy

| UAP Concept | Vyapar Implementation |
|-------------|----------------------|
| Principal (human) | Merchant issuing mandate from dashboard |
| Agent (AI) | Buyer agent or external MCP client |
| Delegation | Mandate with scope (amount, categories, expiry) |
| Revocation | `POST /api/mandates/:id/revoke` — instant, absolute |
| Scope enforcement | Gateway check 1: amount ≤ scope_max AND category ∈ scope_categories |
| Audit | Append-only ledger with triggered_by provenance |

This is not a UAP implementation (UAP is not live). It implements the **pattern** UAP is standardizing — honestly labeled as such.
