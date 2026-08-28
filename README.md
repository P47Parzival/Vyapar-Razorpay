# Vyapar — Bounded Agentic Commerce on Razorpay

Any AI agent can transact with this merchant. Every transaction is gated by deterministic policy, scoped by human-issued mandates, and fully auditable.

## What This Is

A hackathon project for the theme **"AI Growth & Agentic Commerce."**

Vyapar makes a merchant **transactable by any AI buyer, end to end** — discoverable via `.well-known`, connectable via MCP, authorized via AP2/UAP-style mandates — while keeping a human merchant in control through deterministic, live-editable policy.

Two internal LLM agents (Growth Agent, Buyer Agent), one external independent buyer process, and any MCP-capable AI client can submit **Proposals**. A deterministic **Policy Gateway** (6 checks, zero LLM calls) evaluates every proposal against merchant-defined rules. Only if all checks pass does anything reach Razorpay. Every action — approved, denied, or errored — writes exactly one row to an append-only audit ledger.

### Core Architecture

```
                    ┌───────────────────────────────────────────┐
                    │         External AI Agents                 │
                    │  (Claude Desktop, other teams' bots, etc.) │
                    └─────────────────┬─────────────────────────┘
                                      │ MCP Protocol
                    ┌─────────────────▼─────────────────────────┐
                    │  .well-known/agent-commerce.json           │
                    │  Discovery: capabilities, policy, endpoint │
                    └─────────────────┬─────────────────────────┘
                                      │
┌─────────────┐   ┌─────────────┐    │    ┌──────────────────┐
│ Growth Agent│   │ Buyer Agent │    │    │ Webhook Trigger  │
│  (Claude)   │   │  (Claude)   │    │    │ (payment events) │
└──────┬──────┘   └──────┬──────┘    │    └────────┬─────────┘
       │ Proposal         │ Proposal  │ Proposal    │ Auto-trigger
       └──────────────────┴───────────┴─────────────┘
                          │
                          ▼
       ┌──────────────────────────────────────────────┐
       │         Mandate Check (AP2/UAP-style)        │
       │  Human-issued, scoped, time-boxed, revocable │
       └──────────────────────┬───────────────────────┘
                              ▼
       ┌──────────────────────────────────────────────┐
       │           Policy Gateway (6 checks)          │
       │       deterministic • zero LLM calls         │
       │  ─ mandate (scope: amount + category)        │
       │  ─ per-transaction cap                       │
       │  ─ velocity cap (daily total + count)        │
       │  ─ category allowlist                        │
       │  ─ discount ceiling                          │
       │  ─ idempotency (dedup)                       │
       └──────────────────────┬───────────────────────┘
                              │ Only if ALL pass
                              ▼
       ┌──────────────────────────────────────────────┐
       │       Razorpay MCP Server (test mode)        │
       └──────────────────────┬───────────────────────┘
                              ▼
       ┌──────────────────────────────────────────────┐
       │    Audit Ledger (SQLite, append-only)        │
       │    Every proposal = exactly 1 row            │
       └──────────────────────────────────────────────┘
```

**Key invariants:**
- Agents NEVER get Razorpay credentials or call Razorpay directly
- Policy Gateway contains ZERO LLM calls — only deterministic code
- Every proposal writes exactly one ledger row (approved, denied, or errored)
- Mandates are human-issued, scoped (amount + category), time-boxed, and revocable
- Test mode only — no real money moves

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| LLM | Claude Sonnet via AWS Bedrock Converse API |
| Payments | Razorpay MCP Server (test mode, StreamableHTTP) |
| Protocol | MCP Server (StreamableHTTP) + .well-known discovery |
| Mandates | AP2/UAP/UPI Circle-style delegation model |
| Backend | Express + TypeScript (tsx) |
| Database | SQLite via better-sqlite3 (WAL mode) |
| Frontend | React + Vite + Tailwind CSS |
| Monorepo | npm workspaces |

---

## Setup

### Prerequisites

- Node.js 18+
- npm 9+

### 1. Clone and install

```bash
git clone <repo-url>
cd Vyapar
npm install
```

### 2. Environment variables

Create a `.env` file in the project root:

```env
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=whsec_...
BEDROCK_API_KEY=ABSK...
AWS_REGION=ap-south-1
BEDROCK_MODEL_ID=global.anthropic.claude-sonnet-4-6
PORT=3001
```

### 3. Run

```bash
# Start both server and dashboard:
npm run dev

# Or separately:
npm run dev:server    # Express API on :3001
npm run dev:dashboard # Vite dev server on :5173 (proxies /api to :3001)

# Run the external buyer agent (separate terminal):
npm run external-buyer -- "Buy me a birthday gift under 1000 rupees"
```

Open **http://localhost:5173** in your browser.

---

## Demo Script (90-second version)

Follow these steps in order during the live demo. No code changes needed.
Two terminal windows: one for the server/dashboard, one for the external buyer.

### 1. Dashboard Tour (15s)

- Open `http://localhost:5173`
- Point out: **Protocol Surface** panel (MCP endpoint, manifest URL, webhook receiver, external buyer command)
- Show: empty ledger, stat cards, policy controls, mandate panel

### 2. Issue a Scoped Mandate (10s)

- Click **"Issue Mandate"** in the Mandates panel
- Set: Agent = Buyer, Max = 1000, Categories = skincare only, Expiry = 30 min
- Click **Issue** — the mandate appears with ACTIVE badge
- "This is the human authorization — same shape as NPCI's proposed UAP on UPI Circle"

### 3. Internal Buyer — Successful Purchase (15s)

- In AI Buyer Agent, type: `Find me a moisturizer under 700 rupees`
- Click **Shop** — agent browses catalog, proposes, gateway approves
- Green ledger row appears with **INTERNAL** badge
- "Our own buyer agent, bounded by the mandate scope and all 6 policy checks"

### 4. External Buyer — Agent-to-Agent Commerce (20s)

- **Switch to second terminal**
- Run: `npm run external-buyer -- "Buy me a skincare gift under 900 rupees"`
- Show the output: discovers merchant via manifest, connects MCP, reasons, proposes
- **Switch back to dashboard** — new green row with **MCP EXTERNAL** badge
- "This is a separate process, zero shared code, transacting through the protocol surface"

### 5. Mandate Scope Enforcement (15s)

- In AI Buyer, type: `Buy the Collagen Powder` (wellness, ₹1250)
- Gateway denies with **MANDATE_SCOPE_EXCEEDED** — red row appears
- "The agent doesn't know about the mandate scope. The gateway enforces it deterministically."
- Click to expand: show the pipeline check that failed

### 6. Revoke Mandate (10s)

- Click **Revoke** on the active mandate
- Try: `Buy the Gentle Face Wash` (₹450, skincare — normally fine)
- Gateway denies with **MANDATE_EXPIRED** — "Revocation is instant and absolute"

### 7. Webhook-triggered Growth (bonus, 15s)

- Point to a green ledger row with **WEBHOOK** badge (if one exists from a real payment)
- "When a real Razorpay payment completes, the webhook fires, signature is verified, and the Growth Agent automatically runs an upsell — no human click needed"

### Closing Framing

> "This mandate model — a principal delegating a capped, revocable authority to an agent — is the same shape NPCI's proposed Unified Agent Protocol is standardizing on top of UPI Circle. We didn't implement UAP (it isn't live yet). We implemented the pattern it's standardizing, honestly labeled, on real Razorpay rails."

---

## Project Structure

```
Vyapar/
├── packages/
│   ├── server/
│   │   └── src/
│   │       ├── agents/         # Growth + Buyer agents (LLM tool-use loops)
│   │       ├── gateway/        # Policy Gateway + 6 deterministic check modules
│   │       ├── mcp-server/     # Vyapar as MCP server (external agent entry point)
│   │       ├── webhooks/       # Razorpay webhook receiver (signature-verified)
│   │       ├── razorpay/       # MCP client → Razorpay execution
│   │       ├── ledger/         # Append-only audit log + human-readable explainer
│   │       ├── catalog/        # Product catalog + API
│   │       ├── db/             # SQLite schema, migrations, seed
│   │       └── api/            # REST routes (policy, mandates, agents, ledger SSE)
│   ├── dashboard/
│   │   └── src/
│   │       └── components/     # React UI (LedgerFeed, MandatePanel, PolicyPanel, etc.)
│   └── external-buyer-demo/
│       └── src/                # Independent AI buyer (zero shared code with server)
├── BUILD_PLAN.md               # Original design document (Steps 1-10)
├── BUILD_PLAN2.md              # Protocol interoperability plan (Steps 1-6)
├── .env                        # Credentials (not committed)
└── package.json                # Workspace root
```

---

## Architecture Highlights for Judges

1. **Protocol-interoperable**: Any MCP-capable AI agent can discover (`.well-known`), connect (MCP), and transact with this merchant — no custom integration code on the buyer's side.

2. **Mandate model mirrors UAP/UPI Circle**: Human-issued, scoped (amount + category), time-boxed, instantly revocable. Not an API key — a delegation. `MANDATE_SCOPE_EXCEEDED` is a distinct denial from `MANDATE_EXPIRED`.

3. **True agent-to-agent proof**: The external buyer process (`packages/external-buyer-demo/`) shares zero code with the server. It discovers the merchant, reasons with its own LLM, and proposes through the protocol — landing in the same ledger, same 6 checks.

4. **Separation of concerns**: Agents propose, gateway decides, Razorpay executes. No layer does another's job. The gateway is the ONLY thing that calls Razorpay.

5. **Denial is first-class**: A denied proposal is a normal return value with a structured reason code, not an exception. Agents handle denials gracefully.

6. **Zero-trust agent boundary**: Even if the LLM hallucinates a ₹50,000 transaction, the gateway's deterministic cap check denies it. No prompt engineering required for safety.

7. **Full audit trail**: Every row records: who proposed, what they proposed, which checks ran, what passed/failed, what happened on Razorpay (if anything), and a human-readable explanation.

8. **Live policy editing**: A merchant can change caps in real-time. The next proposal immediately sees the new rules.

9. **Real event triggers**: The Growth Agent's upsell flow can fire automatically from a Razorpay `payment_link.paid` webhook — signature-verified, not just a button click.

10. **Honest labeling**: Every simplification is explicitly labeled (test mode, `consent_method: dashboard_click`, "not a certified UCP implementation"). No overclaiming.

---

## Honesty Notes

- **Not a full protocol implementation**: We publish a `.well-known` manifest and an MCP server in the *spirit* of UCP/ACP discovery conventions. We do not claim spec compliance.
- **Mandates are not cryptographically signed**: `consent_method: dashboard_click` is an honest label. A production system would use AP2-style proof-of-authorization.
- **Webhook secret is a shared HMAC key**: Standard Razorpay practice, but not a zero-knowledge proof.
- **Test mode only**: All Razorpay calls use test-mode keys. No real money moves.
- **UAP is not live**: We implement the *pattern* NPCI is standardizing, not the protocol itself.

---

## Real-World Evidence & Rollout Path

### The problem this plan solves is not hypothetical

GoKwik and PayU launched a live, multi-brand D2C agentic-checkout experience inside ChatGPT in India in July 2026 — brands including Hyphen, Beardo, and Kilrr, with hundreds more planned — built on the Agentic Commerce Protocol. This proves both that this category is real and that India-specific rollout is already underway. This project is not staking out imaginary future ground.

### Adoption friction, not protocol capability, is the actual bottleneck

OpenAI's first attempt at exactly this category (Instant Checkout, launched with Shopify and Etsy in September 2025) reached fewer than 15 live merchants out of over a million eligible ones within six months, and was shelved in March 2026 before a February 2026 relaunch as "Buy it in ChatGPT." The gap wasn't technical feasibility — the protocol worked — it was that merchants weren't willing or able to self-integrate into a new checkout surface.

### GoKwik's stated model is the one this project mirrors

GoKwik's repeated positioning across every announcement:

> "Every GoKwik merchant becomes available inside ChatGPT with **no engineering work, no new integration, and no separate listing fee.** Brands **keep full ownership of catalogue, customer and conversion data.**"

This project's zero-code onboarding simulation (Step 1 of Build Plan 3) and merchant-owned `orders`/`customers` tables (Step 2) are a working demonstration of exactly those two guarantees — not descriptions of them, but running code you can point at on screen.

### The realistic deployment shape

In order:

1. **NPCI defines agent-native delegation primitives** at the UPI rail level (UPI Circle, UPI Reserve — both explicitly named as "upcoming" in GoKwik's own announcements, meaning even GoKwik's live system isn't on agent-native rails yet).
2. **A PSP/platform layer** (Razorpay, or a GoKwik-style enabler built on top of a PSP) implements the policy gateway, mandate system, and merchant-facing dashboard once.
3. **Individual merchants opt in** via a settings toggle, connecting an already-existing catalog, writing zero code.

This project is a working prototype of the middle layer (#2), built ahead of the bottom layer (agent-native UPI rails) being finalized — which is an honest description of where this sits, not a weakness to obscure.

### What this means for judges

Every architectural choice in this project (the deterministic gateway, the scoped mandates, the platform/merchant separation, the zero-code onboarding, the merchant-owned data tables) is a direct response to a specific, named, real-world friction that either killed a live product (Instant Checkout v1) or is the stated differentiator of a live competitor (GoKwik). None of it is speculative.

---

## Pilot: Real Shopify Catalog Connection

### What was connected

A real Shopify development store (`vyapar-hmndi3kr.myshopify.com`, store name: "Vyapar") was connected as a live pilot. This is a Shopify-hosted store with real product data — not a mock, not seeded fixtures, not a simulation.

17 products were imported from the store's live catalog (Shopify's default development store sample data: Gift Cards, Snowboards, Selling Plans items). These sit alongside the 15 pre-existing demo catalog items — the pilot is additive, not destructive.

### How the merchant connected (zero engineering work)

The merchant (in this case, the project developer acting as the pilot merchant) performed the following steps, taking under two minutes:

1. Opened the Shopify Dev Dashboard and created an app
2. Configured Admin API scopes: granted `read_products` only
3. Installed the app on the development store
4. Copied the Client ID and Client Secret from the app settings
5. Pasted both into Vyapar's onboarding form (domain + credentials)

No code was written by the merchant. No OAuth app review was needed. No Shopify approval process. The platform (Vyapar) handles the token exchange (client credentials grant for a temporary access token) and encryption automatically.

### The boundary: real catalog, test-mode checkout

Product data flowing through this system is real — live from the connected Shopify store, synced every 15 minutes, with manual refresh available. Prices, stock levels, titles, and descriptions are the merchant's actual catalog data.

Payment settlement is not real. All Razorpay calls use test-mode API keys belonging to the project developer's own Razorpay account. No funds are transferred to the connected Shopify merchant or anyone else. This is disclosed explicitly on every surface:

- The `.well-known/agent-commerce.json` manifest carries `"mode": "test"` and `"catalog_source": "live_shopify_pilot"` at the top level
- Every Shopify-sourced catalog item in the API includes `checkout_mode: "razorpay_test"` and a human-readable disclosure note
- The dashboard shows paired `LIVE SHOPIFY` + `TEST CHECKOUT` badges on any ledger entry involving pilot items
- The MCP server's proposal responses include a `settlement_disclosure` field for any transaction against pilot catalog items

### Why real checkout is out of scope (and why that's honest, not a gap)

Moving real funds to a real third-party merchant through Razorpay requires:

1. **Razorpay Partner account** — a business relationship with Razorpay (Partner Dashboard access, `client_id`/`client_secret` from Razorpay, not self-serve)
2. **Linked Account with KYC** — the pilot merchant must submit PAN, bank account details, and business proof; Razorpay must verify and approve
3. **Route-based settlement** — transfers/settlements configured per-transaction to the merchant's linked account, with hold periods and compliance obligations
4. **Chargeback and refund liability** — real financial risk that requires legal agreements, not just API integration

None of this is available in the time scope of a hackathon, and even if it were, taking on real financial risk with a pilot merchant's real money for a demo deadline would be reckless. The test-mode boundary is a deliberate architectural choice — the same code path that processes a test-mode payment would process a real one, with only the Razorpay credentials and Route configuration changing. The policy gateway, the six checks, the mandate system, and the ledger all work identically regardless of whether the payment is real.

### What a production version additionally requires

To accept real payments for this pilot merchant and settle real funds to their bank account:

- Razorpay Partner approval (business relationship, not a self-serve signup)
- A Linked Account created for the merchant with verified KYC documents
- Route-based transfer logic in the Razorpay execution layer (the only code change needed — the gateway stays as-is)
- Legal agreements covering chargeback liability, refund policy, and settlement schedules
- The merchant's explicit written consent to receive real payments through this platform

The code is ready. The business and compliance prerequisites are not — and honestly naming them is more credible than hand-waving past them.
