/**
 * Minimal LLM client for the external buyer agent.
 * This is an independent copy — it does NOT import from packages/server.
 * Uses AWS Bedrock (Claude) for reasoning.
 */

import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';

let _client = null;

function getClient() {
  if (!_client) {
    _client = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || 'ap-south-1',
      credentials: {
        accessKeyId: process.env.BEDROCK_API_KEY || process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.BEDROCK_API_KEY || process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
  }
  return _client;
}

function getModelId() {
  return process.env.BEDROCK_MODEL_ID || 'global.anthropic.claude-sonnet-4-6';
}

/**
 * Call the LLM with a system prompt, user message, and tool definitions.
 * Returns { text, toolCalls }.
 */
export async function callLlm(systemPrompt, userMessage, tools) {
  const bedrockTools = tools.map(t => ({
    toolSpec: {
      name: t.name,
      description: t.description,
      inputSchema: { json: t.inputSchema },
    },
  }));

  const command = new ConverseCommand({
    modelId: getModelId(),
    system: [{ text: systemPrompt }],
    messages: [
      { role: 'user', content: [{ text: userMessage }] },
    ],
    toolConfig: { tools: bedrockTools },
  });

  const response = await getClient().send(command);
  const output = response.output?.message;

  if (!output) {
    return { text: null, toolCalls: [] };
  }

  const text = (output.content || [])
    .filter(b => 'text' in b)
    .map(b => b.text)
    .join('') || null;

  const toolCalls = (output.content || [])
    .filter(b => 'toolUse' in b)
    .map(b => ({
      toolUseId: b.toolUse.toolUseId,
      name: b.toolUse.name,
      input: b.toolUse.input || {},
    }));

  return { text, toolCalls };
}
