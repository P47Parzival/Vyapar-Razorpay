/**
 * Throwaway test script — connects to Vyapar's MCP server as an external client
 * and exercises all 4 tools. Shares NO code with packages/server.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const MCP_URL = 'http://localhost:3001/mcp';

async function main() {
  console.log('--- Vyapar MCP Client Test ---\n');

  // Connect to Vyapar's MCP server
  const client = new Client(
    { name: 'test-external-buyer', version: '1.0.0' },
    { capabilities: {} }
  );

  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
  await client.connect(transport);
  console.log('[OK] Connected to MCP server at', MCP_URL);

  // 1. List tools
  const tools = await client.listTools();
  console.log('\n[Tools available]:', tools.tools.map(t => t.name).join(', '));

  // 2. Browse catalog
  console.log('\n--- browse_catalog ---');
  const catalogResult = await client.callTool({ name: 'browse_catalog', arguments: {} });
  const catalog = JSON.parse(catalogResult.content[0].text);
  console.log(`Found ${catalog.length} products. First 3:`);
  catalog.slice(0, 3).forEach(p => console.log(`  ${p.id}: ${p.name} — ₹${p.price_rupees}`));

  // 3. Get a single product
  console.log('\n--- get_product ---');
  const productResult = await client.callTool({ name: 'get_product', arguments: { id: 'item_003' } });
  const product = JSON.parse(productResult.content[0].text);
  console.log(`Product: ${product.name} — ₹${product.price_rupees} (${product.category})`);

  // 4. Submit a purchase proposal
  console.log('\n--- submit_purchase_proposal ---');
  const proposalResult = await client.callTool({
    name: 'submit_purchase_proposal',
    arguments: {
      mandate_token: 'mandate_buyer_001',
      action: 'create_payment_link',
      amount_paise: product.price_paise,
      category: product.category,
      counterparty: 'external_test_buyer',
      agent_reasoning: 'Test purchase of Vitamin C Serum via external MCP client',
      description: `Purchase: ${product.name}`,
      item_ids: [product.id],
    },
  });
  const outcome = JSON.parse(proposalResult.content[0].text);
  console.log(`Verdict: ${outcome.verdict}`);
  console.log(`Status: ${outcome.final_status}`);
  console.log(`Explanation: ${outcome.explanation}`);

  // 5. Check proposal status
  if (outcome.proposal_id) {
    console.log('\n--- check_proposal_status ---');
    const statusResult = await client.callTool({
      name: 'check_proposal_status',
      arguments: { proposal_id: outcome.proposal_id },
    });
    const status = JSON.parse(statusResult.content[0].text);
    console.log(`Confirmed: ${status.final_status} — ${status.explanation}`);
  }

  console.log('\n--- ALL TESTS PASSED ---');
  await client.close();
  process.exit(0);
}

main().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
