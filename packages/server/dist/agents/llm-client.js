import { BedrockRuntimeClient, ConverseCommand, } from '@aws-sdk/client-bedrock-runtime';
let _client = null;
function parseBedrockApiKey(raw) {
    if (raw.startsWith('ABSK')) {
        const decoded = Buffer.from(raw.slice(4), 'base64').toString('utf-8');
        const colonIdx = decoded.indexOf(':');
        if (colonIdx > 0) {
            return {
                accessKeyId: decoded.slice(0, colonIdx),
                secretAccessKey: decoded.slice(colonIdx + 1),
            };
        }
    }
    return { accessKeyId: raw, secretAccessKey: raw };
}
function getClient() {
    if (!_client) {
        const creds = parseBedrockApiKey(process.env.BEDROCK_API_KEY || '');
        _client = new BedrockRuntimeClient({
            region: process.env.AWS_REGION || 'ap-south-1',
            credentials: creds,
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
