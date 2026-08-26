import { Client } from '@modelcontextprotocol/sdk/client/index.js';
export declare function getMcpClient(): Promise<Client>;
export declare function callMcpTool(toolName: string, args: Record<string, unknown>): Promise<unknown>;
export declare function listMcpTools(): Promise<unknown>;
export declare function disconnectMcp(): Promise<void>;
