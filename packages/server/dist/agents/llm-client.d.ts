import { type Message } from '@aws-sdk/client-bedrock-runtime';
export interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
}
export interface ToolCall {
    toolUseId: string;
    name: string;
    input: Record<string, unknown>;
}
export interface LlmResponse {
    text: string | null;
    toolCalls: ToolCall[];
    stopReason: string;
}
export declare function callLlm(systemPrompt: string, messages: Message[], tools: ToolDefinition[]): Promise<LlmResponse>;
export declare function buildToolResultMessage(toolUseId: string, result: unknown): Message;
