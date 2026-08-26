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

app.listen(PORT, () => {
  console.log(`Vyapar server running on http://localhost:${PORT}`);
  console.log(`MCP server endpoint: http://localhost:${PORT}/mcp`);
});

export default app;
