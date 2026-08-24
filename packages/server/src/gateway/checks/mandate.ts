import db from '../../db/client.js';
import type { Proposal, PolicyCheckResult } from '../../agents/types.js';

interface MandateRow {
  id: string;
  agent_id: string;
  principal: string;
  granted_at: string;
  expires_at: string;
  revoked: number;
}

export function checkMandate(proposal: Proposal): PolicyCheckResult {
  const now = new Date().toISOString();

  const mandate = db.prepare(
    `SELECT * FROM mandates
     WHERE agent_id = ? AND revoked = 0 AND expires_at > ?
     ORDER BY granted_at DESC LIMIT 1`
  ).get(proposal.agent_type, now) as MandateRow | undefined;

  if (!mandate) {
    return {
      check_name: 'mandate',
      passed: false,
      detail: `No valid (non-revoked, non-expired) mandate found for agent "${proposal.agent_type}"`,
    };
  }

  return {
    check_name: 'mandate',
    passed: true,
    detail: `Active mandate ${mandate.id} valid until ${mandate.expires_at}`,
  };
}
