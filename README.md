# Vyapar — Bounded Agentic Commerce on Razorpay

AI agents that grow merchant revenue, bounded by deterministic policy and fully auditable.

## What This Is

A hackathon project for the theme **"AI Growth & Agentic Commerce."**

Two LLM agents — a **Merchant Growth Agent** (cart recovery, upsell/cross-sell) and a **Buyer Shopping Agent** (AI-powered checkout) — never touch money directly. They only produce structured **Proposals**. A deterministic **Policy Gateway** (zero LLM calls) checks every proposal against merchant-defined rules before anything reaches Razorpay. Every action — approved, denied, or errored — is logged to an append-only audit ledger with a human-readable explanation.

### Core Architecture

```
┌─────────────┐     ┌─────────────┐
│ Growth Agent│     │ Buyer Agent │
│  (Claude)   │     │  (Claude)   │
└──────┬──────┘     └──────┬──────┘
       │ Proposal           │ Proposal
       ▼                    ▼
┌──────────────────────────────────┐
│       Policy Gateway             │
│  (deterministic, no LLM calls)   │
│  ─ mandate check                 │
│  ─ per-transaction cap           │
│  ─ velocity cap                  │
│  ─ category allowlist            │
│  ─ discount ceiling              │
│  ─ idempotency                   │
└──────────────┬───────────────────┘
               │ Only if ALL pass
               ▼
┌──────────────────────────────────┐
│    Razorpay MCP Server           │
│    (test mode only)              │
└──────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│    Audit Ledger (SQLite)         │
│    Every proposal = 1 row        │
└──────────────────────────────────┘
```

**Key invariants:**
- Agents NEVER get Razorpay credentials or call Razorpay directly
- Policy Gateway contains ZERO LLM calls — only deterministic code
- Every proposal writes exactly one ledger row (approved, denied, or errored)
- Test mode only — no real money moves

For the full build plan and design rationale, see [BUILD_PLAN.md](./BUILD_PLAN.md).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| LLM | Claude Sonnet via AWS Bedrock Converse API |
| Payments | Razorpay MCP Server (test mode, StreamableHTTP) |
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
```

Open **http://localhost:5173** in your browser.

---

## Demo Script

Follow these steps in order during the live demo. No code changes needed.

### 1. Show the empty state

- Open the dashboard at `http://localhost:5173`
- Point out: empty audit ledger, the 3 stat cards at zero, the Policy Controls panel showing all current caps (Per-Transaction Cap: ₹3,000, Daily Velocity: ₹10,000, etc.)
- Note the **TEST MODE** badge in the header

### 2. Cart Recovery Agent

- In the **Growth Agent** section, click **"Simulate Abandoned Cart"**
- Wait for the agent to run (~5-10 seconds)
- Show the result: agent's reasoning, the proposal it drafted, gateway approval
- In the **Audit Ledger**, a new green row appears with explanation
- The **Cart Recovery** stat card updates with the recovered amount
- Note the **SIMULATED** badge on the ledger entry

### 3. AI Buyer Agent — successful purchase

- In the **AI Buyer Agent** input, type: `Find me a good moisturizer under ₹1500`
- Click **Shop**
- Wait for the agent to browse the catalog, pick a product, and propose a purchase
- Show: proposal approved, real Razorpay test-mode payment link created
- New green ledger row appears, **AI Buyer** stat card updates

### 4. Lower the per-transaction cap

- In **Policy Controls**, change the Per-Transaction Cap from `3000` to `300`
- Click **Save** — confirm "Updated!" appears
- Explain: "I just lowered the cap. The agent doesn't know. The gateway will enforce it."

### 5. AI Buyer Agent — graceful denial

- In the AI Buyer input, type: `I want to buy the Vitamin C Serum`
- Click **Shop**
- The agent proposes (₹890) → gateway denies with `PER_TRANSACTION_CAP_EXCEEDED`
- Show the result: agent's natural-language explanation acknowledging the denial, suggesting alternatives
- A **red** ledger row appears with the denial reason
- **No Razorpay call was made** — the gateway stopped it

### 6. Inspect the audit trail

- Click the red ledger row to expand it
- Walk through the **Policy Gateway Checks** pipeline:
  - Mandate: PASS
  - Per-Txn Cap: **FAIL** — "proposed ₹890 exceeds cap of ₹300"
  - (remaining checks not reached — gateway stops at first failure)
- Show the **Decision** card: DENIED, reason code, explanation
- Point out: this is the "explainable, bounded, gated" requirement fulfilled

### 7. Restore and re-run (if time)

- Change cap back to `3000`, click Save
- Re-run: `Buy me the Vitamin C Serum`
- This time it succeeds — green row, payment link created
- "This proves the policy is live-editable, not a hardcoded demo path"

---

## Project Structure

```
Vyapar/
├── packages/
│   ├── server/
│   │   └── src/
│   │       ├── agents/         # Growth + Buyer agents (LLM tool-use)
│   │       ├── gateway/        # Policy Gateway + 6 check modules
│   │       ├── razorpay/       # MCP client + execution wrapper
│   │       ├── ledger/         # Append-only audit log + explainer
│   │       ├── db/             # SQLite schema, seed, client
│   │       └── api/            # Express routes + SSE
│   └── dashboard/
│       └── src/
│           └── components/     # React UI (LedgerFeed, PolicyPanel, etc.)
├── BUILD_PLAN.md               # Full design document
├── .env                        # Credentials (not committed)
└── package.json                # Workspace root
```

---

## Architecture Highlights for Judges

1. **Separation of concerns**: Agents propose, gateway decides, Razorpay executes. No layer does another's job.
2. **Denial is first-class**: A denied proposal is a normal return value with a structured reason — not an error. The agent handles it gracefully.
3. **Zero-trust agent boundary**: Even if the LLM hallucinates a ₹50,000 transaction, the gateway's deterministic cap check will deny it. No prompt engineering required for safety.
4. **Full audit trail**: Every row has: who proposed, what they proposed, which checks ran, what passed/failed, and what happened on Razorpay (if anything).
5. **Live policy editing**: A merchant can change caps in real-time; no deploy needed. The next agent proposal immediately sees the new rules.
