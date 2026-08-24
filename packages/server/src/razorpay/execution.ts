import { callMcpTool } from './mcp-client.js';

export interface RazorpayOutcome {
  success: boolean;
  action: string;
  razorpay_response: unknown;
  error?: string;
}

export async function executeOnRazorpay(
  action: string,
  params: Record<string, unknown>
): Promise<RazorpayOutcome> {
  try {
    const response = await callMcpTool(action, params);
    return {
      success: true,
      action,
      razorpay_response: response,
    };
  } catch (err) {
    const error = err as Error;
    return {
      success: false,
      action,
      razorpay_response: null,
      error: error.message,
    };
  }
}
