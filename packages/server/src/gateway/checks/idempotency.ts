import db from '../../db/client.js';
import type { Proposal, PolicyCheckResult } from '../../agents/types.js';

const DEDUP_WINDOW_SECONDS = 60;

interface DuplicateRow {
  id: string;
  timestamp: string;
}

export function checkIdempotency(proposal: Proposal): PolicyCheckResult {
  const windowStart = new Date(Date.now() - DEDUP_WINDOW_SECONDS * 1000).toISOString();

  const duplicate = db.prepare(
    `SELECT id, timestamp FROM ledger
     WHERE merchant_id = ?
       AND agent_type = ?
       AND json_extract(proposal_json, '$.action') = ?
       AND amount_paise = ?
       AND json_extract(proposal_json, '$.counterparty') = ?
       AND timestamp > ?
     LIMIT 1`
  ).get(
    proposal.merchant_id,
    proposal.agent_type,
    proposal.action,
    proposal.amount_paise,
    proposal.counterparty,
    windowStart
  ) as DuplicateRow | undefined;

  if (duplicate) {
    return {
      check_name: 'idempotency',
      passed: false,
      detail: `Duplicate detected: same agent/action/amount/counterparty seen at ${duplicate.timestamp} (within ${DEDUP_WINDOW_SECONDS}s window)`,
    };
  }

  return {
    check_name: 'idempotency',
    passed: true,
    detail: `No duplicate found in last ${DEDUP_WINDOW_SECONDS}s`,
  };
}
