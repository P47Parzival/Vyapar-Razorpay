import { callMcpTool } from './mcp-client.js';
export async function executeOnRazorpay(action, params) {
    try {
        const response = await callMcpTool(action, params);
        return {
            success: true,
            action,
            razorpay_response: response,
        };
    }
    catch (err) {
        const error = err;
        return {
            success: false,
            action,
            razorpay_response: null,
            error: error.message,
        };
    }
}
