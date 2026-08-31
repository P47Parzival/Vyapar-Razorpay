import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '..', '..', '..', '.env') });
import db from '../db/client.js';
import { getAllCatalogItems } from '../catalog/catalog.js';
export function computeFindings(batchId) {
    const trials = db.prepare('SELECT * FROM catalog_trials WHERE run_batch_id = ? ORDER BY goal_id, trial_number').all(batchId);
    if (trials.length === 0) {
        throw new Error(`No trials found for batch ${batchId}`);
    }
    const allItems = getAllCatalogItems();
    const activeItems = allItems.filter(i => i.stock > 0);
    const itemMap = new Map(activeItems.map(i => [i.id, i]));
    const goalGroups = new Map();
    for (const t of trials) {
        const arr = goalGroups.get(t.goal_id) || [];
        arr.push(t);
        goalGroups.set(t.goal_id, arr);
    }
    const goals = [];
    for (const [goalId, goalTrials] of goalGroups) {
        const goalText = goalTrials[0].goal;
        const totalTrials = goalTrials.length;
        const validTrials = goalTrials.filter(t => t.picked_item_id !== null);
        const nullPicks = totalTrials - validTrials.length;
        // 1. Pick rates
        const pickCounts = new Map();
        for (const t of validTrials) {
            pickCounts.set(t.picked_item_id, (pickCounts.get(t.picked_item_id) || 0) + 1);
        }
        const pickRates = [];
        for (const [itemId, count] of pickCounts) {
            const item = itemMap.get(itemId);
            pickRates.push({
                item_id: itemId,
                item_title: item?.title || itemId,
                category: item?.category || 'unknown',
                times_picked: count,
                total_trials: totalTrials,
                rate: count / totalTrials,
            });
        }
        pickRates.sort((a, b) => b.times_picked - a.times_picked);
        // 2. Never-picked items
        const pickedIds = new Set(pickCounts.keys());
        const neverPicked = activeItems
            .filter(i => !pickedIds.has(i.id))
            .map(i => ({
            item_id: i.id,
            item_title: i.title,
            category: i.category,
            price_rupees: i.price_paise / 100,
        }));
        // 3. Position correlation
        const catalogSize = activeItems.length;
        const thirdSize = Math.ceil(catalogSize / 3);
        let topThird = 0;
        let middleThird = 0;
        let bottomThird = 0;
        const positionData = new Map();
        for (const t of validTrials) {
            const snapshotOrder = JSON.parse(t.catalog_snapshot_order_json);
            const position = snapshotOrder.indexOf(t.picked_item_id);
            if (position === -1)
                continue;
            if (position < thirdSize)
                topThird++;
            else if (position < thirdSize * 2)
                middleThird++;
            else
                bottomThird++;
            const arr = positionData.get(t.picked_item_id) || [];
            arr.push(position + 1);
            positionData.set(t.picked_item_id, arr);
        }
        const totalValid = topThird + middleThird + bottomThird;
        let positionSummary;
        if (totalValid === 0) {
            positionSummary = 'No valid picks to analyze position correlation.';
        }
        else {
            positionSummary = `Of ${totalValid} valid picks: ${topThird} from top third (positions 1-${thirdSize}), ${middleThird} from middle third, ${bottomThird} from bottom third of the shuffled catalog.`;
            if (topThird > totalValid * 0.5) {
                positionSummary += ` The top third of the presented list accounted for ${topThird}/${totalValid} picks — possible position bias.`;
            }
            else {
                positionSummary += ' No strong position bias observed.';
            }
        }
        const positionEntries = [];
        for (const [itemId, positions] of positionData) {
            const item = itemMap.get(itemId);
            positionEntries.push({
                item_id: itemId,
                item_title: item?.title || itemId,
                times_picked: positions.length,
                avg_position: Math.round((positions.reduce((a, b) => a + b, 0) / positions.length) * 10) / 10,
                positions_when_picked: positions,
            });
        }
        goals.push({
            goal_id: goalId,
            goal_text: goalText,
            total_trials: totalTrials,
            valid_picks: validTrials.length,
            null_picks: nullPicks,
            pick_rates: pickRates,
            never_picked: neverPicked,
            position_analysis: {
                top_third_picks: topThird,
                middle_third_picks: middleThird,
                bottom_third_picks: bottomThird,
                total_valid: totalValid,
                summary: positionSummary,
            },
        });
    }
    return {
        run_batch_id: batchId,
        total_trials: trials.length,
        total_goals: goals.length,
        catalog_size: activeItems.length,
        goals,
    };
}
function printFindings(findings) {
    console.log('=== Catalog Legibility Findings ===');
    console.log(`Batch: ${findings.run_batch_id}`);
    console.log(`${findings.total_goals} goals, ${findings.total_trials} total trials, ${findings.catalog_size} active catalog items\n`);
    for (const g of findings.goals) {
        console.log(`━━━ Goal: "${g.goal_id}" (${g.total_trials} trials, ${g.valid_picks} valid, ${g.null_picks} null) ━━━`);
        console.log(`  "${g.goal_text}"\n`);
        console.log('  Pick rates:');
        for (const p of g.pick_rates) {
            console.log(`    ${p.item_title} (${p.item_id}): ${p.times_picked}/${p.total_trials} trials (${(p.rate * 100).toFixed(0)}%) — category: ${p.category}`);
        }
        console.log(`\n  Never picked (${g.never_picked.length} of ${findings.catalog_size} items):`);
        const grouped = new Map();
        for (const np of g.never_picked) {
            const arr = grouped.get(np.category) || [];
            arr.push(np);
            grouped.set(np.category, arr);
        }
        for (const [cat, items] of [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
            console.log(`    [${cat}] ${items.map(i => `${i.item_title} (₹${i.price_rupees})`).join(', ')}`);
        }
        console.log(`\n  Position analysis:`);
        console.log(`    ${g.position_analysis.summary}`);
        console.log('');
    }
}
function getLatestBatchId() {
    const row = db.prepare('SELECT run_batch_id FROM catalog_trials ORDER BY created_at DESC LIMIT 1').get();
    return row?.run_batch_id || null;
}
const isDirectRun = process.argv[1]?.includes('compute-findings');
if (isDirectRun) {
    const batchArg = process.argv[2];
    const batchId = batchArg || getLatestBatchId();
    if (!batchId) {
        console.error('No batch found. Run the trial runner first.');
        process.exit(1);
    }
    const findings = computeFindings(batchId);
    printFindings(findings);
}
