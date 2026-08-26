import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
const MCP_ENDPOINT = 'https://mcp.razorpay.com/mcp';
let clientInstance = null;
function getAuthHeader() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
        throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in .env');
    }
    return 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
}
async function createClient() {
    const authHeader = getAuthHeader();
    const client = new Client({ name: 'vyapar-gateway', version: '1.0.0' }, { capabilities: {} });
    // Try StreamableHTTP first (newer MCP transport), fall back to SSE
    try {
        const transport = new StreamableHTTPClientTransport(new URL(MCP_ENDPOINT), {
            requestInit: {
                headers: { Authorization: authHeader },
            },
        });
        await client.connect(transport);
        console.log('[MCP] Connected via StreamableHTTP transport');
        return client;
    }
    catch (err) {
        console.log('[MCP] StreamableHTTP failed, trying SSE transport...', err.message);
    }
    // Fallback: SSE transport
    const sseTransport = new SSEClientTransport(new URL(MCP_ENDPOINT), {
        requestInit: {
            headers: { Authorization: authHeader },
        },
    });
    await client.connect(sseTransport);
    console.log('[MCP] Connected via SSE transport');
    return client;
}
export async function getMcpClient() {
    if (!clientInstance) {
        clientInstance = await createClient();
    }
    return clientInstance;
}
export async function callMcpTool(toolName, args) {
    const client = await getMcpClient();
    const result = await client.callTool({ name: toolName, arguments: args });
    return result;
}
export async function listMcpTools() {
    const client = await getMcpClient();
    const tools = await client.listTools();
    return tools;
}
export async function disconnectMcp() {
    if (clientInstance) {
        await clientInstance.close();
        clientInstance = null;
    }
}
