import type { Proposal, Decision, PolicyCheckResult, Outcome } from '../agents/types.js';
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
export declare function writeLedgerEntry(proposal: Proposal, checks: PolicyCheckResult[], decision: Decision, outcome: Outcome): LedgerRow;
export declare function getLedgerEntries(limit?: number, offset?: number): LedgerRow[];
export declare function getLedgerEntry(id: string): LedgerRow | null;
export declare function getLedgerEntriesSince(sinceId: string): LedgerRow[];
