import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Message,
  type SystemContentBlock,
  type Tool,
  type ToolResultContentBlock,
  type ContentBlock,
} from '@aws-sdk/client-bedrock-runtime';

let _client: BedrockRuntimeClient | null = null;

function parseBedrockApiKey(raw: string): { accessKeyId: string; secretAccessKey: string } {
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

function getClient(): BedrockRuntimeClient {
  if (!_client) {
    const rawKey = process.env.BEDROCK_API_KEY || '';
    console.log(`[Bedrock] Raw key length: ${rawKey.length}, starts with ABSK: ${rawKey.startsWith('ABSK')}`);
    const creds = parseBedrockApiKey(rawKey);
    console.log(`[Bedrock] Parsed accessKeyId: ${creds.accessKeyId}, secretKey length: ${creds.secretAccessKey.length}`);
    const region = process.env.AWS_REGION || 'ap-south-1';
    console.log(`[Bedrock] Region: ${region}, Model: ${getModelId()}`);
    // Check for interfering AWS env vars
    const awsEnvVars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN', 'AWS_PROFILE']
      .filter(k => !!process.env[k]);
    if (awsEnvVars.length > 0) {
      console.log(`[Bedrock] WARNING: Found AWS env vars that may interfere: ${awsEnvVars.join(', ')}`);
    }
    _client = new BedrockRuntimeClient({
      region,
      credentials: {
        accessKeyId: creds.accessKeyId,
        secretAccessKey: creds.secretAccessKey,
      },
    });
  }
  return _client;
}

function getModelId(): string {
  return process.env.BEDROCK_MODEL_ID || 'global.anthropic.claude-sonnet-4-6';
}

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

function convertToolDefs(tools: ToolDefinition[]): Tool[] {
  return tools.map(t => ({
    toolSpec: {
      name: t.name,
      description: t.description,
      inputSchema: { json: t.inputSchema as Record<string, unknown> },
    },
  } as Tool));
}

export async function callLlm(
  systemPrompt: string,
  messages: Message[],
  tools: ToolDefinition[]
): Promise<LlmResponse> {
  const command = new ConverseCommand({
    modelId: getModelId(),
    system: [{ text: systemPrompt } as SystemContentBlock],
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
    ?.filter((b): b is ContentBlock.TextMember => 'text' in b)
    .map(b => b.text)
    .join('') || null;

  const toolCalls: ToolCall[] = (output.content || [])
    .filter((b): b is ContentBlock.ToolUseMember => 'toolUse' in b)
    .map(b => ({
      toolUseId: b.toolUse!.toolUseId!,
      name: b.toolUse!.name!,
      input: (b.toolUse!.input as Record<string, unknown>) || {},
    }));

  return { text, toolCalls, stopReason: response.stopReason || 'end_turn' };
}

export function buildToolResultMessage(toolUseId: string, result: unknown): Message {
  return {
    role: 'user',
    content: [
      {
        toolResult: {
          toolUseId,
          content: [{ text: JSON.stringify(result) } as ToolResultContentBlock],
        },
      } as ContentBlock.ToolResultMember,
    ],
  };
}
