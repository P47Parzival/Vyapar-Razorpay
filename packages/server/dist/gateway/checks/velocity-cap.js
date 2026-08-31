import db from '../../db/client.js';
export function checkVelocityCap(proposal, policy) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const row = db.prepare(`SELECT COALESCE(SUM(amount_paise), 0) as total_paise, COUNT(*) as txn_count
     FROM ledger
     WHERE final_status = 'executed'
       AND merchant_id = ?
       AND timestamp >= ?`).get(proposal.merchant_id, todayStart.toISOString());
    const dailyTotal = (row.total_paise || 0) + proposal.amount_paise;
    const dailyCount = row.txn_count + 1;
    if (dailyTotal > policy.max_daily_velocity_paise) {
        return {
            check_name: 'velocity_cap',
            passed: false,
            detail: `Daily total would be ₹${(dailyTotal / 100).toFixed(0)} (exceeds velocity cap ₹${(policy.max_daily_velocity_paise / 100).toFixed(0)})`,
        };
    }
    if (dailyCount > policy.max_daily_txn_count) {
        return {
            check_name: 'velocity_cap',
            passed: false,
            detail: `Daily transaction count would be ${dailyCount} (exceeds max ${policy.max_daily_txn_count})`,
        };
    }
    return {
        check_name: 'velocity_cap',
        passed: true,
        detail: `Daily total ₹${(dailyTotal / 100).toFixed(0)}/${(policy.max_daily_velocity_paise / 100).toFixed(0)}, count ${dailyCount}/${policy.max_daily_txn_count}`,
    };
}
