import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.BEDROCK_API_KEY || '',
    secretAccessKey: process.env.BEDROCK_API_KEY || '',
  },
});

async function test() {
  const models = [
    'global.anthropic.claude-sonnet-4-6',
    'global.anthropic.claude-sonnet-4-6-v1',
    'global.anthropic.claude-sonnet-4-6-v1:0',
    'apac.anthropic.claude-sonnet-4-6-v1:0',
    'anthropic.claude-sonnet-4-6-v1:0',
    'us.anthropic.claude-sonnet-4-6-v1:0',
  ];

  for (const modelId of models) {
    console.log(`\nTrying model: ${modelId}`);
    try {
      const cmd = new ConverseCommand({
        modelId,
        messages: [{ role: 'user', content: [{ text: 'Say hi in one word' }] }],
      });
      const res = await client.send(cmd);
      const text = res.output?.message?.content?.[0];
      console.log(`SUCCESS: ${JSON.stringify(text)}`);
      console.log(`\nWorking model ID: ${modelId}`);
      return;
    } catch (e: any) {
      console.log(`FAILED: ${e.name} - ${e.message?.slice(0, 150)}`);
    }
  }
  console.log('\nNo model ID worked. Please check your Bedrock access configuration.');
}

test();
