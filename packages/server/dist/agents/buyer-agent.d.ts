import { type Proposal } from './types.js';
export interface BuyerAgentResult {
    reasoning: string;
    proposal: Proposal | null;
    decision: {
        verdict: string;
        reason_code: string;
        reason_text: string;
    } | null;
    outcome: {
        final_status: string;
        razorpay_response?: unknown;
    } | null;
    agentResponse: string;
}
export declare function runBuyerAgent(shoppingRequest: string): Promise<BuyerAgentResult>;
