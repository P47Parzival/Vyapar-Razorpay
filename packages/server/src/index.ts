import './env.js';

import express from 'express';
import cors from 'cors';

import { seedDatabase } from './db/seed.js';
import catalogRouter from './catalog/catalog-api.js';
import apiRouter from './api/routes.js';
import webhookRouter from './webhooks/razorpay-webhook.js';
import { handleMcpPost, handleMcpGet, handleMcpDelete } from './mcp-server/vyapar-mcp-server.js';
import { startAutoSync } from './shopify/connector.js';

seedDatabase();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf.toString();
  },
}));

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'vyapar-server' });
});

app.use('/api', catalogRouter);
app.use('/api', apiRouter);

// Razorpay webhook — signature-verified, triggers Growth Agent on payment events
app.use('/api', webhookRouter);

// MCP Server — exposes Vyapar as a tool provider for external AI agents
app.post('/mcp', handleMcpPost);
app.get('/mcp', handleMcpGet);
app.delete('/mcp', handleMcpDelete);

// .well-known agent-commerce discovery manifest
app.get('/.well-known/agent-commerce.json', (_req, res) => {
  const host = _req.headers.host || `localhost:${PORT}`;
  const baseUrl = `http://${host}`;
  res.json({
    mode: 'test',
    protocol_note: 'This manifest follows emerging agent-commerce discovery conventions (UCP/.well-known pattern). Not a certified UCP implementation.',
    platform_provider: 'Razorpay Agentic Commerce Layer (demo)',
    platform: { name: 'Vyapar', mode: 'test' },
    merchants_endpoint: `${baseUrl}/api/merchants`,
    catalog_source: 'live_shopify_pilot',
    catalog_source_note: 'Product data is live from a connected Shopify store. Payment settlement uses Razorpay test-mode credentials - no real funds are transferred.',
    catalog_feed: `${baseUrl}/api/catalog`,
    mcp_endpoint: `${baseUrl}/mcp`,
    capabilities: ['browse_catalog', 'get_product', 'submit_purchase_proposal', 'submit_addon_proposal', 'get_active_mandate', 'check_proposal_status'],
    mandate_required: true,
    currency: 'INR',
    policy_summary_endpoint: `${baseUrl}/api/policy/public`,
  });
});

app.listen(PORT, () => {
  console.log(`Vyapar server running on http://localhost:${PORT}`);
  console.log(`MCP server endpoint: http://localhost:${PORT}/mcp`);
  console.log(`Discovery manifest: http://localhost:${PORT}/.well-known/agent-commerce.json`);
  startAutoSync();
});

export default app;
