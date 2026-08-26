import { z } from 'zod';
export declare const ProposalSchema: z.ZodObject<{
    proposal_id: z.ZodString;
    agent_type: z.ZodEnum<["growth", "buyer"]>;
    agent_reasoning: z.ZodString;
    action: z.ZodEnum<["create_payment_link", "create_order", "create_refund"]>;
    amount_paise: z.ZodNumber;
    currency: z.ZodDefault<z.ZodString>;
    merchant_id: z.ZodDefault<z.ZodString>;
    counterparty: z.ZodString;
    category: z.ZodString;
    requested_at: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    discount_pct: z.ZodOptional<z.ZodNumber>;
    original_order_id: z.ZodOptional<z.ZodString>;
    item_ids: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    category: string;
    merchant_id: string;
    proposal_id: string;
    agent_type: "growth" | "buyer";
    agent_reasoning: string;
    action: "create_payment_link" | "create_order" | "create_refund";
    amount_paise: number;
    currency: string;
    counterparty: string;
    requested_at: string;
    description?: string | undefined;
    discount_pct?: number | undefined;
    original_order_id?: string | undefined;
    item_ids?: string[] | undefined;
}, {
    category: string;
    proposal_id: string;
    agent_type: "growth" | "buyer";
    agent_reasoning: string;
    action: "create_payment_link" | "create_order" | "create_refund";
    amount_paise: number;
    counterparty: string;
    requested_at: string;
    merchant_id?: string | undefined;
    currency?: string | undefined;
    description?: string | undefined;
    discount_pct?: number | undefined;
    original_order_id?: string | undefined;
    item_ids?: string[] | undefined;
}>;
export type Proposal = z.infer<typeof ProposalSchema>;
export declare const PolicyCheckResultSchema: z.ZodObject<{
    check_name: z.ZodString;
    passed: z.ZodBoolean;
    detail: z.ZodString;
}, "strip", z.ZodTypeAny, {
    check_name: string;
    passed: boolean;
    detail: string;
}, {
    check_name: string;
    passed: boolean;
    detail: string;
}>;
export type PolicyCheckResult = z.infer<typeof PolicyCheckResultSchema>;
export declare const DecisionSchema: z.ZodObject<{
    proposal_id: z.ZodString;
    verdict: z.ZodEnum<["approved", "denied"]>;
    reason_code: z.ZodString;
    reason_text: z.ZodString;
    checks: z.ZodArray<z.ZodObject<{
        check_name: z.ZodString;
        passed: z.ZodBoolean;
        detail: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        check_name: string;
        passed: boolean;
        detail: string;
    }, {
        check_name: string;
        passed: boolean;
        detail: string;
    }>, "many">;
    checked_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    proposal_id: string;
    verdict: "approved" | "denied";
    reason_code: string;
    reason_text: string;
    checks: {
        check_name: string;
        passed: boolean;
        detail: string;
    }[];
    checked_at: string;
}, {
    proposal_id: string;
    verdict: "approved" | "denied";
    reason_code: string;
    reason_text: string;
    checks: {
        check_name: string;
        passed: boolean;
        detail: string;
    }[];
    checked_at: string;
}>;
export type Decision = z.infer<typeof DecisionSchema>;
export declare const OutcomeSchema: z.ZodObject<{
    proposal_id: z.ZodString;
    razorpay_action: z.ZodNullable<z.ZodString>;
    razorpay_response: z.ZodNullable<z.ZodUnknown>;
    final_status: z.ZodEnum<["executed", "denied", "error"]>;
    executed_at: z.ZodString;
    error_message: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    proposal_id: string;
    razorpay_action: string | null;
    final_status: "denied" | "executed" | "error";
    executed_at: string;
    razorpay_response?: unknown;
    error_message?: string | undefined;
}, {
    proposal_id: string;
    razorpay_action: string | null;
    final_status: "denied" | "executed" | "error";
    executed_at: string;
    razorpay_response?: unknown;
    error_message?: string | undefined;
}>;
export type Outcome = z.infer<typeof OutcomeSchema>;
export declare const LedgerEntrySchema: z.ZodObject<{
    id: z.ZodString;
    timestamp: z.ZodString;
    agent_type: z.ZodEnum<["growth", "buyer"]>;
    proposal: z.ZodObject<{
        proposal_id: z.ZodString;
        agent_type: z.ZodEnum<["growth", "buyer"]>;
        agent_reasoning: z.ZodString;
        action: z.ZodEnum<["create_payment_link", "create_order", "create_refund"]>;
        amount_paise: z.ZodNumber;
        currency: z.ZodDefault<z.ZodString>;
        merchant_id: z.ZodDefault<z.ZodString>;
        counterparty: z.ZodString;
        category: z.ZodString;
        requested_at: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        discount_pct: z.ZodOptional<z.ZodNumber>;
        original_order_id: z.ZodOptional<z.ZodString>;
        item_ids: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        category: string;
        merchant_id: string;
        proposal_id: string;
        agent_type: "growth" | "buyer";
        agent_reasoning: string;
        action: "create_payment_link" | "create_order" | "create_refund";
        amount_paise: number;
        currency: string;
        counterparty: string;
        requested_at: string;
        description?: string | undefined;
        discount_pct?: number | undefined;
        original_order_id?: string | undefined;
        item_ids?: string[] | undefined;
    }, {
        category: string;
        proposal_id: string;
        agent_type: "growth" | "buyer";
        agent_reasoning: string;
        action: "create_payment_link" | "create_order" | "create_refund";
        amount_paise: number;
        counterparty: string;
        requested_at: string;
        merchant_id?: string | undefined;
        currency?: string | undefined;
        description?: string | undefined;
        discount_pct?: number | undefined;
        original_order_id?: string | undefined;
        item_ids?: string[] | undefined;
    }>;
    checks: z.ZodArray<z.ZodObject<{
        check_name: z.ZodString;
        passed: z.ZodBoolean;
        detail: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        check_name: string;
        passed: boolean;
        detail: string;
    }, {
        check_name: string;
        passed: boolean;
        detail: string;
    }>, "many">;
    decision: z.ZodObject<{
        proposal_id: z.ZodString;
        verdict: z.ZodEnum<["approved", "denied"]>;
        reason_code: z.ZodString;
        reason_text: z.ZodString;
        checks: z.ZodArray<z.ZodObject<{
            check_name: z.ZodString;
            passed: z.ZodBoolean;
            detail: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            check_name: string;
            passed: boolean;
            detail: string;
        }, {
            check_name: string;
            passed: boolean;
            detail: string;
        }>, "many">;
        checked_at: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        proposal_id: string;
        verdict: "approved" | "denied";
        reason_code: string;
        reason_text: string;
        checks: {
            check_name: string;
            passed: boolean;
            detail: string;
        }[];
        checked_at: string;
    }, {
        proposal_id: string;
        verdict: "approved" | "denied";
        reason_code: string;
        reason_text: string;
        checks: {
            check_name: string;
            passed: boolean;
            detail: string;
        }[];
        checked_at: string;
    }>;
    outcome: z.ZodNullable<z.ZodObject<{
        proposal_id: z.ZodString;
        razorpay_action: z.ZodNullable<z.ZodString>;
        razorpay_response: z.ZodNullable<z.ZodUnknown>;
        final_status: z.ZodEnum<["executed", "denied", "error"]>;
        executed_at: z.ZodString;
        error_message: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        proposal_id: string;
        razorpay_action: string | null;
        final_status: "denied" | "executed" | "error";
        executed_at: string;
        razorpay_response?: unknown;
        error_message?: string | undefined;
    }, {
        proposal_id: string;
        razorpay_action: string | null;
        final_status: "denied" | "executed" | "error";
        executed_at: string;
        razorpay_response?: unknown;
        error_message?: string | undefined;
    }>>;
    human_readable_explanation: z.ZodString;
    amount_paise: z.ZodNumber;
    category: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    category: string | null;
    agent_type: "growth" | "buyer";
    amount_paise: number;
    checks: {
        check_name: string;
        passed: boolean;
        detail: string;
    }[];
    timestamp: string;
    proposal: {
        category: string;
        merchant_id: string;
        proposal_id: string;
        agent_type: "growth" | "buyer";
        agent_reasoning: string;
        action: "create_payment_link" | "create_order" | "create_refund";
        amount_paise: number;
        currency: string;
        counterparty: string;
        requested_at: string;
        description?: string | undefined;
        discount_pct?: number | undefined;
        original_order_id?: string | undefined;
        item_ids?: string[] | undefined;
    };
    decision: {
        proposal_id: string;
        verdict: "approved" | "denied";
        reason_code: string;
        reason_text: string;
        checks: {
            check_name: string;
            passed: boolean;
            detail: string;
        }[];
        checked_at: string;
    };
    outcome: {
        proposal_id: string;
        razorpay_action: string | null;
        final_status: "denied" | "executed" | "error";
        executed_at: string;
        razorpay_response?: unknown;
        error_message?: string | undefined;
    } | null;
    human_readable_explanation: string;
}, {
    id: string;
    category: string | null;
    agent_type: "growth" | "buyer";
    amount_paise: number;
    checks: {
        check_name: string;
        passed: boolean;
        detail: string;
    }[];
    timestamp: string;
    proposal: {
        category: string;
        proposal_id: string;
        agent_type: "growth" | "buyer";
        agent_reasoning: string;
        action: "create_payment_link" | "create_order" | "create_refund";
        amount_paise: number;
        counterparty: string;
        requested_at: string;
        merchant_id?: string | undefined;
        currency?: string | undefined;
        description?: string | undefined;
        discount_pct?: number | undefined;
        original_order_id?: string | undefined;
        item_ids?: string[] | undefined;
    };
    decision: {
        proposal_id: string;
        verdict: "approved" | "denied";
        reason_code: string;
        reason_text: string;
        checks: {
            check_name: string;
            passed: boolean;
            detail: string;
        }[];
        checked_at: string;
    };
    outcome: {
        proposal_id: string;
        razorpay_action: string | null;
        final_status: "denied" | "executed" | "error";
        executed_at: string;
        razorpay_response?: unknown;
        error_message?: string | undefined;
    } | null;
    human_readable_explanation: string;
}>;
export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;
