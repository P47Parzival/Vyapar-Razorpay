import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { callMcpTool, listMcpTools, disconnectMcp } from '../packages/server/src/razorpay/mcp-client.js';

async function main() {
  console.log('=== Razorpay MCP Test Script ===\n');
  console.log('Key ID:', process.env.RAZORPAY_KEY_ID);
  console.log('');

  // Step 1: List available tools
  console.log('--- Listing available MCP tools ---');
  try {
    const tools = await listMcpTools();
    console.log('Available tools:', JSON.stringify(tools, null, 2).slice(0, 1000));
    console.log('');
  } catch (err) {
    console.error('Failed to list tools:', (err as Error).message);
  }

  // Step 2: Create a test order
  console.log('--- Creating test order (₹500 = 50000 paise) ---');
  let orderId: string | null = null;
  try {
    const orderResult = await callMcpTool('create_order', {
      amount: 50000,
      currency: 'INR',
      receipt: 'vyapar_test_001',
      notes: { source: 'vyapar-test-script' },
    });
    console.log('Order created:', JSON.stringify(orderResult, null, 2));
    // Extract order ID from response
    const content = orderResult as { content?: Array<{ text?: string }> };
    if (content?.content?.[0]?.text) {
      const parsed = JSON.parse(content.content[0].text);
      orderId = parsed.id;
      console.log('\nOrder ID:', orderId);
    }
  } catch (err) {
    console.error('Failed to create order:', (err as Error).message);
  }

  // Step 3: Create a payment link
  console.log('\n--- Creating payment link (₹500) ---');
  let paymentLinkId: string | null = null;
  try {
    const linkResult = await callMcpTool('create_payment_link', {
      amount: 50000,
      currency: 'INR',
      description: 'Vyapar test payment link',
      customer: {
        name: 'Test Customer',
        email: 'test@vyapar.dev',
        contact: '+919999999999',
      },
      notify: { sms: false, email: false },
      notes: { source: 'vyapar-test-script', order_id: orderId || 'none' },
    });
    console.log('Payment link created:', JSON.stringify(linkResult, null, 2));
    const content = linkResult as { content?: Array<{ text?: string }> };
    if (content?.content?.[0]?.text) {
      const parsed = JSON.parse(content.content[0].text);
      paymentLinkId = parsed.id;
      console.log('\nPayment Link ID:', paymentLinkId);
      console.log('Short URL:', parsed.short_url);
    }
  } catch (err) {
    console.error('Failed to create payment link:', (err as Error).message);
  }

  // Step 4: Fetch the payment link back
  if (paymentLinkId) {
    console.log('\n--- Fetching payment link back ---');
    try {
      const fetchResult = await callMcpTool('fetch_payment_link', {
        payment_link_id: paymentLinkId,
      });
      console.log('Fetched payment link:', JSON.stringify(fetchResult, null, 2));
    } catch (err) {
      console.error('Failed to fetch payment link:', (err as Error).message);
    }
  }

  // Step 5: Fetch the order back
  if (orderId) {
    console.log('\n--- Fetching order back ---');
    try {
      const fetchResult = await callMcpTool('fetch_order', {
        order_id: orderId,
      });
      console.log('Fetched order:', JSON.stringify(fetchResult, null, 2));
    } catch (err) {
      console.error('Failed to fetch order:', (err as Error).message);
    }
  }

  await disconnectMcp();
  console.log('\n=== Test complete ===');
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
