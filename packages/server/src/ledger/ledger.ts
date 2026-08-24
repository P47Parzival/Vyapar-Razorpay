import { v4 as uuidv4 } from 'uuid';
import db from '../db/client.js';
import type { Proposal, Decision, PolicyCheckResult, Outcome } from '../agents/types.js';
import { generateExplanation } from './explain.js';

export interface LedgerRow {
  id: string;
  timestamp: string;
  agent_type: string;
  proposal_json: string;
  checks_json: string;
  decision_json: string;
  razorpay_call_json: string | null;
  razorpay_response_json: string | null;
  final_status: string;
  human_readable_explanation: string;
  amount_paise: number;
  category: string | null;
}

export function writeLedgerEntry(
  proposal: Proposal,
  checks: PolicyCheckResult[],
  decision: Decision,
  outcome: Outcome
): LedgerRow {
  const id = uuidv4();
  const timestamp = new Date().toISOString();
  const explanation = generateExplanation(proposal, decision);

  const row: LedgerRow = {
    id,
    timestamp,
    agent_type: proposal.agent_type,
    proposal_json: JSON.stringify(proposal),
    checks_json: JSON.stringify(checks),
    decision_json: JSON.stringify(decision),
    razorpay_call_json: outcome.razorpay_action ? JSON.stringify({ action: outcome.razorpay_action }) : null,
    razorpay_response_json: outcome.razorpay_response ? JSON.stringify(outcome.razorpay_response) : null,
    final_status: outcome.final_status,
    human_readable_explanation: explanation,
    amount_paise: proposal.amount_paise,
    category: proposal.category,
  };

  db.prepare(
    `INSERT INTO ledger (id, timestamp, agent_type, proposal_json, checks_json, decision_json,
     razorpay_call_json, razorpay_response_json, final_status, human_readable_explanation, amount_paise, category)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    row.id, row.timestamp, row.agent_type, row.proposal_json, row.checks_json,
    row.decision_json, row.razorpay_call_json, row.razorpay_response_json,
    row.final_status, row.human_readable_explanation, row.amount_paise, row.category
  );

  return row;
}

export function getLedgerEntries(limit: number = 50, offset: number = 0): LedgerRow[] {
  return db.prepare(
    'SELECT * FROM ledger ORDER BY timestamp DESC LIMIT ? OFFSET ?'
  ).all(limit, offset) as LedgerRow[];
}

export function getLedgerEntry(id: string): LedgerRow | null {
  return (db.prepare('SELECT * FROM ledger WHERE id = ?').get(id) as LedgerRow) || null;
}

export function getLedgerEntriesSince(sinceId: string): LedgerRow[] {
  const refRow = db.prepare('SELECT timestamp FROM ledger WHERE id = ?').get(sinceId) as { timestamp: string } | undefined;
  if (!refRow) return getLedgerEntries(50);
  return db.prepare(
    'SELECT * FROM ledger WHERE timestamp > ? ORDER BY timestamp ASC'
  ).all(refRow.timestamp) as LedgerRow[];
}
