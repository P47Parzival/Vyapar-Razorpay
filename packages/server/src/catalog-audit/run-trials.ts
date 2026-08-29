import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ContentBlock,
} from '@aws-sdk/client-bedrock-runtime';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '..', '..', '..', '.env') });

import db from '../db/client.js';
import { getAllCatalogItems } from '../catalog/catalog.js';

interface TrialGoal {
  id: string;
  goal: string;
  relevant_categories: string[];
}

const TRIALS_PER_GOAL = 10;

function getBedrockClient(): BedrockRuntimeClient {
  return new BedrockRuntimeClient({
    region: process.env.AWS_REGION || 'ap-south-1',
    credentials: {
      accessKeyId: process.env.BEDROCK_API_KEY || '',
      secretAccessKey: process.env.BEDROCK_API_KEY || '',
    },
  });
}

function getModelId(): string {
  return process.env.BEDROCK_MODEL_ID || 'global.anthropic.claude-sonnet-4-6';
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function askLlmToPick(client: BedrockRuntimeClient, goal: string, catalogJson: string, validIds: Set<string>): Promise<string | null> {
  const systemPrompt = `You are a shopping assistant. The user will give you a shopping request and a product catalog as JSON. Pick exactly ONE item from the catalog that best matches the request. Respond with ONLY the item's "id" field — nothing else, no quotes, no explanation, no markdown. Just the raw id string.`;

  const userMessage = `Shopping request: "${goal}"

Here is the full product catalog:
${catalogJson}

Pick the single best matching item. Respond with only its id.`;

  const maxRetries = 3;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const command = new ConverseCommand({
        modelId: getModelId(),
        system: [{ text: systemPrompt }],
        messages: [{ role: 'user', content: [{ text: userMessage }] }],
        inferenceConfig: { maxTokens: 64, temperature: 0.7 },
      });

      const response = await client.send(command);
      const output = response.output?.message;
      if (!output?.content) return null;

      const text = output.content
        .filter((b): b is ContentBlock.TextMember => 'text' in b)
        .map(b => b.text)
        .join('')
        .trim();

      if (validIds.has(text)) return text;

      const idMatch = text.match(/(item_\d+|shopify_\d+)/);
      if (idMatch && validIds.has(idMatch[1])) return idMatch[1];

      console.log(`  [!] Unparseable LLM response: "${text.slice(0, 100)}"`);
      return null;
    } catch (err: any) {
      const isRateLimit = err.message?.includes('Too many requests') || err.name === 'ThrottlingException';
      if (isRateLimit && attempt < maxRetries) {
        const backoff = (attempt + 1) * 3000;
        console.log(`  [~] Rate limited, retrying in ${backoff / 1000}s (attempt ${attempt + 1}/${maxRetries})...`);
        await sleep(backoff);
        continue;
      }
      console.log(`  [!] LLM call failed: ${err.message}`);
      return null;
    }
  }
  return null;
}

function ensureTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS catalog_trials (
      id TEXT PRIMARY KEY,
      goal TEXT NOT NULL,
      goal_id TEXT NOT NULL,
      trial_number INTEGER NOT NULL,
      catalog_snapshot_order_json TEXT NOT NULL,
      picked_item_id TEXT,
      run_batch_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_catalog_trials_batch ON catalog_trials(run_batch_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_catalog_trials_goal ON catalog_trials(goal_id)`);
}

async function main() {
  console.log('=== Vyapar Catalog Audit: Trial Runner ===\n');

  ensureTable();

  const goalsPath = resolve(__dirname, 'trial-goals.json');
  const goals: TrialGoal[] = JSON.parse(readFileSync(goalsPath, 'utf-8'));
  console.log(`Loaded ${goals.length} goals from trial-goals.json`);

  const allItems = getAllCatalogItems();
  const activeItems = allItems.filter(i => i.stock > 0);
  console.log(`Catalog: ${activeItems.length} active, in-stock items\n`);

  const validIds = new Set(activeItems.map(i => i.id));
  const batchId = `batch_${Date.now()}_${randomUUID().slice(0, 6)}`;
  console.log(`Run batch ID: ${batchId}`);
  console.log(`Trials per goal: ${TRIALS_PER_GOAL}`);
  console.log(`Total LLM calls: ${goals.length * TRIALS_PER_GOAL}\n`);

  const client = getBedrockClient();

  const insertTrial = db.prepare(
    `INSERT INTO catalog_trials (id, goal, goal_id, trial_number, catalog_snapshot_order_json, picked_item_id, run_batch_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  let totalTrials = 0;
  let validPicks = 0;
  let nullPicks = 0;

  for (const goal of goals) {
    console.log(`--- Goal: "${goal.id}" ---`);
    console.log(`  "${goal.goal}"`);

    for (let trial = 1; trial <= TRIALS_PER_GOAL; trial++) {
      const shuffled = shuffle(activeItems);
      const snapshotOrder = shuffled.map(i => i.id);

      const catalogForLlm = shuffled.map(i => ({
        id: i.id,
        name: i.title,
        description: i.description,
        price_rupees: i.price_paise / 100,
        category: i.category,
        stock: i.stock,
      }));
      const catalogJson = JSON.stringify(catalogForLlm, null, 2);

      if (totalTrials > 0) await sleep(1500);
      const pickedId = await askLlmToPick(client, goal.goal, catalogJson, validIds);

      insertTrial.run(
        `trial_${randomUUID().slice(0, 8)}`,
        goal.goal,
        goal.id,
        trial,
        JSON.stringify(snapshotOrder),
        pickedId,
        batchId,
      );

      totalTrials++;
      if (pickedId) {
        validPicks++;
        const item = activeItems.find(i => i.id === pickedId);
        console.log(`  Trial ${trial}: picked ${pickedId} (${item?.title || '?'})`);
      } else {
        nullPicks++;
        console.log(`  Trial ${trial}: null (unparseable/failed)`);
      }
    }
    console.log('');
  }

  console.log('=== Summary ===');
  console.log(`Batch ID: ${batchId}`);
  console.log(`Total trials: ${totalTrials}`);
  console.log(`Valid picks: ${validPicks}`);
  console.log(`Null picks: ${nullPicks}`);

  const rowCount = (db.prepare('SELECT COUNT(*) as n FROM catalog_trials WHERE run_batch_id = ?').get(batchId) as any).n;
  console.log(`Rows in catalog_trials: ${rowCount}`);
  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
