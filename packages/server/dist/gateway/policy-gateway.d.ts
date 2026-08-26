import type { Proposal, Decision, Outcome } from '../agents/types.js';
import type { LedgerRow } from '../ledger/ledger.js';
interface GatewayResult {
    decision: Decision;
    outcome: Outcome;
    ledgerRow: LedgerRow;
}
export declare function processProposal(proposal: Proposal): Promise<GatewayResult>;
export {};
