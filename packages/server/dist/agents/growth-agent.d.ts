import { type Proposal } from './types.js';
export interface GrowthAgentScenario {
    type: 'cart_recovery' | 'upsell';
    context: Record<string, unknown>;
}
export interface GrowthAgentResult {
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
export declare function runGrowthAgent(scenario: GrowthAgentScenario): Promise<GrowthAgentResult>;
