/**
 * External Buyer Agent — an independent AI agent that discovers and transacts
 * with Vyapar through its public protocol surface (MCP + .well-known manifest).
 *
 * This process shares ZERO code with packages/server. It discovers capabilities
 * via the manifest, connects as an MCP client, browses the catalog, reasons
 * about what to buy using its own LLM call, and submits a purchase proposal.
 *
 * This is the proof that two independently-built agents can transact through
 * nothing but the standard protocol surface.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { callLlm } from './llm.mjs';

const VYAPAR_HOST = process.env.VYAPAR_HOST || 'http://localhost:3001';
const MANDATE_TOKEN = process.env.MANDATE_TOKEN || '';
const SHOPPING_GOAL = process.argv[2] || 'Buy me a birthday gift under 1000 rupees, something nice for skincare';

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  External Buyer Agent — Independent AI Shopper              ║');
  console.log('║  This agent shares NO code with the Vyapar server.          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  console.log(`Shopping goal: "${SHOPPING_GOAL}"\n`);

  // --- Phase 1: Discovery via .well-known manifest ---
  console.log('[1/5] Discovering merchant via .well-known manifest...');
  const manifestUrl = `${VYAPAR_HOST}/.well-known/agent-commerce.json`;
  const manifestRes = await fetch(manifestUrl);
  if (!manifestRes.ok) {
    throw new Error(`Failed to fetch manifest from ${manifestUrl}: ${manifestRes.status}`);
  }
  const manifest = await manifestRes.json();
  console.log(`  Merchant: ${manifest.merchant.name} (mode: ${manifest.merchant.mode})`);
  console.log(`  MCP endpoint: ${manifest.mcp_endpoint}`);
  console.log(`  Capabilities: ${manifest.capabilities.join(', ')}`);
  console.log(`  Mandate required: ${manifest.mandate_required}`);
  console.log(`  Currency: ${manifest.currency}\n`);

  // --- Phase 2: Read public policy ---
  console.log('[2/5] Reading public policy constraints...');
  const policyRes = await fetch(manifest.policy_summary_endpoint);
  const policy = await policyRes.json();
  console.log(`  Max per transaction: ${manifest.currency} ${policy.max_per_transaction_rupees}`);
  console.log(`  Categories allowed: ${policy.category_allowlist.join(', ')}`);
  console.log(`  Discount ceiling: ${policy.discount_ceiling_pct}%\n`);

  // --- Phase 3: Connect to MCP server ---
  console.log('[3/5] Connecting to MCP server...');
  const client = new Client(
    { name: 'external-buyer-agent', version: '1.0.0' },
    { capabilities: {} }
  );
  const transport = new StreamableHTTPClientTransport(new URL(manifest.mcp_endpoint));
  await client.connect(transport);

  const tools = await client.listTools();
  console.log(`  Connected. Tools available: ${tools.tools.map(t => t.name).join(', ')}\n`);

  // --- Phase 4: Browse catalog ---
  console.log('[4/5] Browsing catalog and reasoning about purchase...');
  const catalogResult = await client.callTool({ name: 'browse_catalog', arguments: {} });
  const catalog = JSON.parse(catalogResult.content[0].text);
  console.log(`  Found ${catalog.length} products in catalog.`);

  // --- Phase 5: LLM reasoning + purchase ---
  console.log('[5/5] AI reasoning about shopping goal...\n');

  const mandateToken = MANDATE_TOKEN || await discoverMandate();

  if (!mandateToken) {
    console.error('\nERROR: No mandate token provided.');
    console.error('Set MANDATE_TOKEN env var to an active mandate ID for the buyer agent.');
    console.error('Issue one via: curl -X POST http://localhost:3001/api/mandates -H "Content-Type: application/json" -d \'{"agent_id":"buyer","scope_max_amount_paise":100000,"scope_categories":["skincare","haircare","bodycare","wellness","accessories"],"expiry_minutes":60,"issued_by":"merchant_owner"}\'');
    process.exit(1);
  }

  const decision = await agentLoop(client, catalog, policy, mandateToken);

  console.log('\n┌────────────────────────────────────────────────────────┐');
  if (decision) {
    console.log(`│  Result: ${decision.verdict.toUpperCase()}                                  `);
    console.log(`│  ${decision.explanation}  `);
    console.log(`│  Proposal ID: ${decision.proposal_id}                    `);
  } else {
    console.log('│  Agent decided not to purchase anything.               │');
  }
  console.log('└────────────────────────────────────────────────────────┘');

  await client.close();
  process.exit(0);
}

async function discoverMandate() {
  try {
    const res = await fetch(`${VYAPAR_HOST}/api/mandates`);
    const data = await res.json();
    const active = data.mandates.find(m => m.is_active && m.agent_id === 'buyer');
    if (active) {
      console.log(`  Auto-discovered active mandate: ${active.id}`);
      return active.id;
    }
  } catch { /* ignore */ }
  return null;
}

async function agentLoop(client, catalog, policy, mandateToken) {
  const systemPrompt = `You are an independent AI shopping agent. A human has given you a shopping goal and a budget. You must decide what to buy from the available catalog.

You are transacting with a merchant called "Vyapar" through their MCP protocol surface. You have been issued a mandate (authorization token) to spend on behalf of your principal.

CONSTRAINTS (from the merchant's public policy):
- Max per transaction: ${policy.max_per_transaction_rupees} ${policy.currency || 'INR'}
- Allowed categories: ${policy.category_allowlist.join(', ')}
- Discount ceiling: ${policy.discount_ceiling_pct}%

INSTRUCTIONS:
- Choose the BEST product from the catalog that matches the shopping goal
- Respect the budget in the shopping goal
- You MUST call the purchase tool exactly once with your chosen item
- Keep your reasoning concise (2-3 sentences)
- amount_paise = price in rupees * 100`;

  const userMessage = `SHOPPING GOAL: ${SHOPPING_GOAL}

AVAILABLE CATALOG:
${JSON.stringify(catalog, null, 2)}

Choose the best product and submit a purchase. Use mandate token: ${mandateToken}`;

  const tools = [
    {
      name: 'submit_purchase',
      description: 'Submit a purchase proposal for the chosen product',
      inputSchema: {
        type: 'object',
        properties: {
          item_id: { type: 'string', description: 'The product ID from the catalog' },
          item_name: { type: 'string', description: 'The product name' },
          amount_paise: { type: 'number', description: 'Price in paise (rupees * 100)' },
          category: { type: 'string', description: 'Product category' },
          reasoning: { type: 'string', description: 'Why you chose this product' },
        },
        required: ['item_id', 'item_name', 'amount_paise', 'category', 'reasoning'],
      },
    },
  ];

  const response = await callLlm(systemPrompt, userMessage, tools);

  if (response.toolCalls.length === 0) {
    console.log('  Agent response:', response.text);
    return null;
  }

  const toolCall = response.toolCalls[0];
  const { item_id, item_name, amount_paise, category, reasoning } = toolCall.input;

  console.log(`  Agent reasoning: ${reasoning}`);
  console.log(`  Selected: ${item_name} (${item_id}) — ${amount_paise / 100} INR [${category}]`);
  console.log(`  Submitting purchase proposal via MCP...`);

  const result = await client.callTool({
    name: 'submit_purchase_proposal',
    arguments: {
      mandate_token: mandateToken,
      action: 'create_order',
      amount_paise,
      category,
      counterparty: 'external_buyer_agent_principal',
      agent_reasoning: reasoning,
      description: `External agent purchase: ${item_name}`,
      item_ids: [item_id],
    },
  });

  const outcome = JSON.parse(result.content[0].text);
  return outcome;
}

main().catch(err => {
  console.error('External buyer agent failed:', err.message);
  process.exit(1);
});
