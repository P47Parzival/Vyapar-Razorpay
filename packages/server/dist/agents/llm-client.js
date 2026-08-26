import { BedrockRuntimeClient, ConverseCommand, } from '@aws-sdk/client-bedrock-runtime';
let _client = null;
function getClient() {
    if (!_client) {
        _client = new BedrockRuntimeClient({
            region: process.env.AWS_REGION || 'ap-south-1',
            credentials: {
                accessKeyId: process.env.BEDROCK_API_KEY || '',
                secretAccessKey: process.env.BEDROCK_API_KEY || '',
            },
        });
    }
    return _client;
}
function getModelId() {
    return process.env.BEDROCK_MODEL_ID || 'global.anthropic.claude-sonnet-4-6';
}
function convertToolDefs(tools) {
    return tools.map(t => ({
        toolSpec: {
            name: t.name,
            description: t.description,
            inputSchema: { json: t.inputSchema },
        },
    }));
}
export async function callLlm(systemPrompt, messages, tools) {
    const command = new ConverseCommand({
        modelId: getModelId(),
        system: [{ text: systemPrompt }],
        messages,
        toolConfig: {
            tools: convertToolDefs(tools),
        },
    });
    const response = await getClient().send(command);
    const output = response.output?.message;
    if (!output) {
        return { text: null, toolCalls: [], stopReason: response.stopReason || 'end_turn' };
    }
    const text = output.content
        ?.filter((b) => 'text' in b)
        .map(b => b.text)
        .join('') || null;
    const toolCalls = (output.content || [])
        .filter((b) => 'toolUse' in b)
        .map(b => ({
        toolUseId: b.toolUse.toolUseId,
        name: b.toolUse.name,
        input: b.toolUse.input || {},
    }));
    return { text, toolCalls, stopReason: response.stopReason || 'end_turn' };
}
export function buildToolResultMessage(toolUseId, result) {
    return {
        role: 'user',
        content: [
            {
                toolResult: {
                    toolUseId,
                    content: [{ text: JSON.stringify(result) }],
                },
            },
        ],
    };
}
