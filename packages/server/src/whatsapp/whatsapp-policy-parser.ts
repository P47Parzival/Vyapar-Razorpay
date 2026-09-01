import { callLlm, type ToolDefinition } from '../agents/llm-client.js';
import type { ParseResult } from './policy-change-evaluator.js';

const SYSTEM_PROMPT = `You are a policy change parser for Vyapar, a merchant commerce platform.

Your ONLY job is to extract a structured policy change request from a merchant's WhatsApp message. You NEVER decide whether a change should be applied — you only extract what was requested.

You can recognize changes to these EXACT fields only:
- per_transaction_cap — the maximum amount (in rupees) allowed for a single transaction
- daily_velocity_cap — the maximum total amount (in rupees) allowed per day across all transactions
- discount_ceiling — the maximum discount percentage allowed

Rules:
- If the merchant clearly specifies one of these fields and a numeric target value, extract it as a policy_field_change.
- If the message mentions "cap" or "limit" without specifying which one, assume per_transaction_cap.
- If the message says "approve <id>" or wants to override a specific denied proposal, extract it as a single_use_override with the proposal_id.
- Values for caps are in RUPEES (not paise). Values for discount_ceiling are in PERCENT.
- Extract ONLY what the merchant clearly stated. Do NOT guess or infer missing values.
- If the message does not clearly map to one of these fields with a clear target value, and is not an override request, return a parse_failure with a brief reason.
- Casual greetings, questions about status, or anything that is not a policy change instruction should be a parse_failure.

You MUST call the extract_policy_change tool exactly once with your extraction.`;

const TOOLS: ToolDefinition[] = [
  {
    name: 'extract_policy_change',
    description: 'Extract a structured policy change from the merchant message',
    inputSchema: {
      type: 'object',
      properties: {
        change_type: {
          type: 'string',
          enum: ['policy_field_change', 'single_use_override', 'parse_failure'],
          description: 'The type of extraction result',
        },
        field: {
          type: 'string',
          enum: ['per_transaction_cap', 'daily_velocity_cap', 'discount_ceiling'],
          description: 'The policy field to change. Required for policy_field_change.',
        },
        to: {
          type: 'number',
          description: 'Target value in rupees (for caps) or percent (for discount_ceiling). Required for policy_field_change.',
        },
        proposal_id: {
          type: 'string',
          description: 'The proposal ID to override. Required for single_use_override.',
        },
        action: {
          type: 'string',
          enum: ['approve'],
          description: 'Override action. Required for single_use_override.',
        },
        discount_pct: {
          type: 'number',
          description: 'Optional discount percentage for the override.',
        },
        reason: {
          type: 'string',
          description: 'Why the message could not be parsed. Required for parse_failure.',
        },
      },
      required: ['change_type'],
    },
  },
];

export async function parseWhatsAppPolicyMessage(messageText: string): Promise<ParseResult> {
  try {
    const response = await callLlm(
      SYSTEM_PROMPT,
      [{ role: 'user', content: [{ text: messageText }] }],
      TOOLS
    );

    const toolCall = response.toolCalls[0];
    if (!toolCall || toolCall.name !== 'extract_policy_change') {
      return { type: 'parse_failure', reason: 'LLM did not return a structured extraction.' };
    }

    const input = toolCall.input as Record<string, any>;

    if (input.change_type === 'policy_field_change') {
      if (!input.field || input.to === undefined || input.to === null) {
        return { type: 'parse_failure', reason: 'Incomplete policy field change — missing field or target value.' };
      }
      return {
        type: 'policy_field_change',
        field: input.field as string,
        to: input.to as number,
      };
    }

    if (input.change_type === 'single_use_override') {
      return {
        type: 'single_use_override',
        proposal_id: (input.proposal_id as string) || '',
        action: 'approve',
        discount_pct: input.discount_pct as number | undefined,
      };
    }

    return {
      type: 'parse_failure',
      reason: (input.reason as string) || 'Message does not contain a recognizable policy change request.',
    };
  } catch (err: any) {
    console.error('[WhatsApp Parser] LLM call failed:', err.message);
    return {
      type: 'parse_failure',
      reason: `LLM parsing error: ${err.message}`,
    };
  }
}
