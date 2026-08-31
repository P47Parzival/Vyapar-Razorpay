import '../env.js';
// Redirect all console output to stderr — stdout is reserved for MCP JSON-RPC protocol
console.log = (...args) => process.stderr.write(args.join(' ') + '\n');
console.error = (...args) => process.stderr.write(args.join(' ') + '\n');
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { seedDatabase } from '../db/seed.js';
import { createMcpServer } from './vyapar-mcp-server.js';
seedDatabase();
async function main() {
    const server = createMcpServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    process.stderr.write('[Vyapar MCP] Server connected via stdio\n');
}
main().catch((err) => {
    process.stderr.write(`[Vyapar MCP] Fatal: ${err.message}\n`);
    process.exit(1);
});
