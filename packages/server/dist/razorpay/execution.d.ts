export interface RazorpayOutcome {
    success: boolean;
    action: string;
    razorpay_response: unknown;
    error?: string;
}
export declare function executeOnRazorpay(action: string, params: Record<string, unknown>): Promise<RazorpayOutcome>;
