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
    verify: (req, _res, buf) => {
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
// Bearer token auth (demo-grade; a real Connectors Directory listing would require full OAuth)
const MCP_TOKEN = process.env.MCP_BEARER_TOKEN;
function mcpAuth(req, res, next) {
    if (!MCP_TOKEN)
        return next();
    const auth = req.headers.authorization;
    if (!auth || auth !== `Bearer ${MCP_TOKEN}`) {
        res.status(401).json({ error: 'Unauthorized — provide a valid Bearer token in the Authorization header' });
        return;
    }
    next();
}
app.post('/mcp', mcpAuth, handleMcpPost);
app.get('/mcp', mcpAuth, handleMcpGet);
app.delete('/mcp', mcpAuth, handleMcpDelete);
// .well-known agent-commerce discovery manifest
app.get('/.well-known/agent-commerce.json', (_req, res) => {
    const host = _req.headers.host || `localhost:${PORT}`;
    const proto = _req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const baseUrl = `${proto}://${host}`;
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
        mcp_auth: {
            type: 'bearer',
            note: 'Demo-grade static bearer token. A real Connectors Directory submission would require full OAuth per Anthropic requirements.',
        },
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
