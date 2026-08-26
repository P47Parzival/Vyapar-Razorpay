import './env.js';

import express from 'express';
import cors from 'cors';

import { seedDatabase } from './db/seed.js';
import catalogRouter from './catalog/catalog-api.js';
import apiRouter from './api/routes.js';
import { handleMcpPost, handleMcpGet, handleMcpDelete } from './mcp-server/vyapar-mcp-server.js';

seedDatabase();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'vyapar-server' });
});

app.use('/api', catalogRouter);
app.use('/api', apiRouter);

// MCP Server — exposes Vyapar as a tool provider for external AI agents
app.post('/mcp', handleMcpPost);
app.get('/mcp', handleMcpGet);
app.delete('/mcp', handleMcpDelete);

// .well-known agent-commerce discovery manifest
app.get('/.well-known/agent-commerce.json', (_req, res) => {
  const host = _req.headers.host || `localhost:${PORT}`;
  const baseUrl = `http://${host}`;
  res.json({
    protocol_note: 'Vyapar publishes this manifest in the spirit of emerging agent-commerce discovery conventions (UCP/.well-known pattern). This is not a certified UCP implementation.',
    merchant: { name: 'Vyapar', id: 'default', mode: 'test' },
    catalog_feed: `${baseUrl}/api/catalog`,
    mcp_endpoint: `${baseUrl}/mcp`,
    capabilities: ['browse_catalog', 'get_product', 'submit_purchase_proposal', 'check_proposal_status'],
    mandate_required: true,
    currency: 'INR',
    policy_summary_endpoint: `${baseUrl}/api/policy/public`,
  });
});

app.listen(PORT, () => {
  console.log(`Vyapar server running on http://localhost:${PORT}`);
  console.log(`MCP server endpoint: http://localhost:${PORT}/mcp`);
  console.log(`Discovery manifest: http://localhost:${PORT}/.well-known/agent-commerce.json`);
});

export default app;
