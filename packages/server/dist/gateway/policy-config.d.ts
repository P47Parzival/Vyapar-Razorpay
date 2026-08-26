export interface PolicyConfig {
    merchant_id: string;
    max_per_transaction_paise: number;
    max_daily_velocity_paise: number;
    max_daily_txn_count: number;
    discount_ceiling_pct: number;
    mandate_expiry_minutes: number;
    merchant_allowlist: string[];
    category_allowlist: string[];
    updated_at: string;
}
export declare function getPolicyConfig(merchantId?: string): PolicyConfig;
export declare function updatePolicyConfig(merchantId: string, updates: Partial<Omit<PolicyConfig, 'merchant_id' | 'updated_at' | 'merchant_allowlist' | 'category_allowlist'>> & {
    merchant_allowlist?: string[];
    category_allowlist?: string[];
}): PolicyConfig;
