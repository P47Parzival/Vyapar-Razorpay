export function checkPerTransactionCap(proposal, policy) {
    const passed = proposal.amount_paise <= policy.max_per_transaction_paise;
    return {
        check_name: 'per_transaction_cap',
        passed,
        detail: passed
            ? `₹${(proposal.amount_paise / 100).toFixed(0)} <= cap ₹${(policy.max_per_transaction_paise / 100).toFixed(0)}`
            : `₹${(proposal.amount_paise / 100).toFixed(0)} exceeds per-transaction cap of ₹${(policy.max_per_transaction_paise / 100).toFixed(0)}`,
    };
}
