import { useState, useEffect } from 'react';

interface PickRate {
  item_id: string;
  item_title: string;
  category: string;
  times_picked: number;
  total_trials: number;
  rate: number;
}

interface NeverPicked {
  item_id: string;
  item_title: string;
  category: string;
  price_rupees: number;
}

interface PositionAnalysis {
  top_third_picks: number;
  middle_third_picks: number;
  bottom_third_picks: number;
  total_valid: number;
  summary: string;
}

interface GoalFindings {
  goal_id: string;
  goal_text: string;
  total_trials: number;
  valid_picks: number;
  null_picks: number;
  pick_rates: PickRate[];
  never_picked: NeverPicked[];
  position_analysis: PositionAnalysis;
}

interface BatchFindings {
  run_batch_id: string;
  total_trials: number;
  total_goals: number;
  catalog_size: number;
  goals: GoalFindings[];
}

interface ApiResponse {
  has_data: boolean;
  findings?: BatchFindings;
  message?: string;
}

export default function CatalogAudit() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/catalog-audit/findings')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 p-4 animate-pulse">
        Loading catalog audit...
      </div>
    );
  }

  if (!data?.has_data || !data.findings) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="px-4 py-3 border-b border-amber-200 bg-amber-50">
          <h2 className="text-lg font-semibold text-amber-900">Catalog Legibility Check</h2>
        </div>
        <div className="p-4 text-sm text-gray-500">
          No audit data yet. Run <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">npm run catalog-audit</code> to generate.
        </div>
      </div>
    );
  }

  const f = data.findings;

  const totalPicked = f.goals.reduce((sum, g) => {
    const uniqueItems = new Set(g.pick_rates.map(p => p.item_id));
    return sum + uniqueItems.size;
  }, 0);
  const totalNeverPicked = new Set(f.goals.flatMap(g => g.never_picked.map(n => n.item_id))).size;

  return (
    <div className="bg-white rounded-lg shadow border border-amber-200">
      <div className="px-4 py-3 border-b border-amber-200 bg-amber-50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-amber-900">Catalog Legibility Check</h2>
            <p className="text-[10px] text-amber-700 mt-0.5 uppercase tracking-wider font-medium">
              One-Time Measurement
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded font-mono">
              N={f.goals[0]?.total_trials || 0}/goal
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <p className="text-xs text-gray-500 leading-relaxed border-l-2 border-amber-300 pl-3">
          This is a one-time measurement (N={f.goals[0]?.total_trials || 0} trials per goal) of whether
          our AI agents fairly consider every catalog item, not a live monitor. Small sample
          size — read as a directional signal, not a statistical guarantee.
        </p>

        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 bg-gray-50 rounded border border-gray-200">
            <p className="text-lg font-bold text-gray-900">{f.total_trials}</p>
            <p className="text-[10px] text-gray-500 uppercase">Total Trials</p>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded border border-gray-200">
            <p className="text-lg font-bold text-gray-900">{f.total_goals}</p>
            <p className="text-[10px] text-gray-500 uppercase">Goals Tested</p>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded border border-gray-200">
            <p className="text-lg font-bold text-gray-900">{f.catalog_size}</p>
            <p className="text-[10px] text-gray-500 uppercase">Catalog Items</p>
          </div>
        </div>

        {f.goals.map(goal => {
          const isExpanded = expandedGoal === goal.goal_id;
          const maxPicks = Math.max(...goal.pick_rates.map(p => p.times_picked));

          return (
            <div key={goal.goal_id} className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setExpandedGoal(isExpanded ? null : goal.goal_id)}
                className="w-full px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left flex items-center justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{goal.goal_id.replace(/_/g, ' ')}</p>
                  <p className="text-[10px] text-gray-500 truncate mt-0.5">{goal.goal_text}</p>
                </div>
                <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                  <span className="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded">
                    {goal.pick_rates.length} picked
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded">
                    {goal.never_picked.length} invisible
                  </span>
                  <span className="text-gray-400 text-xs">{isExpanded ? '▲' : '▼'}</span>
                </div>
              </button>

              {isExpanded && (
                <div className="p-3 space-y-3 border-t border-gray-200">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-2">
                      Pick Rates ({goal.total_trials} trials)
                    </p>
                    <div className="space-y-1.5">
                      {goal.pick_rates.map(p => (
                        <div key={p.item_id} className="flex items-center gap-2">
                          <div className="w-32 truncate text-xs text-gray-700" title={p.item_title}>
                            {p.item_title}
                          </div>
                          <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden relative">
                            <div
                              className="h-full bg-amber-400 rounded transition-all"
                              style={{ width: `${(p.times_picked / maxPicks) * 100}%` }}
                            />
                            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-medium text-gray-800">
                              {p.times_picked}/{p.total_trials}
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-400 w-8 text-right">
                            {(p.rate * 100).toFixed(0)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {goal.never_picked.length > 0 && (
                    <div>
                      <p className="text-[10px] text-red-500 uppercase tracking-wider font-medium mb-1.5">
                        Never Picked — "Invisible" Items ({goal.never_picked.length})
                      </p>
                      <div className="max-h-32 overflow-y-auto">
                        <div className="flex flex-wrap gap-1">
                          {goal.never_picked
                            .filter(n => isRelevantToGoal(goal.goal_id, n.category))
                            .map(n => (
                              <span
                                key={n.item_id}
                                className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded"
                                title={`${n.item_title} — ₹${n.price_rupees} (${n.category})`}
                              >
                                {n.item_title}
                              </span>
                            ))}
                          {goal.never_picked.filter(n => !isRelevantToGoal(goal.goal_id, n.category)).length > 0 && (
                            <span className="text-[10px] text-gray-400 px-1.5 py-0.5">
                              +{goal.never_picked.filter(n => !isRelevantToGoal(goal.goal_id, n.category)).length} from other categories
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="pt-1 border-t border-gray-100">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-1">
                      Position Bias
                    </p>
                    <div className="flex items-center gap-3">
                      <PositionBar
                        label="Top ⅓"
                        count={goal.position_analysis.top_third_picks}
                        total={goal.position_analysis.total_valid}
                      />
                      <PositionBar
                        label="Mid ⅓"
                        count={goal.position_analysis.middle_third_picks}
                        total={goal.position_analysis.total_valid}
                      />
                      <PositionBar
                        label="Bot ⅓"
                        count={goal.position_analysis.bottom_third_picks}
                        total={goal.position_analysis.total_valid}
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Catalog order was shuffled each trial. {goal.position_analysis.summary.includes('possible') ? 'Possible position bias detected.' : 'No strong position bias.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <p className="text-[10px] text-gray-400 text-center">
          Batch: {f.run_batch_id}
        </p>
      </div>
    </div>
  );
}

function PositionBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex-1 text-center">
      <div className="h-4 bg-gray-100 rounded overflow-hidden relative">
        <div
          className="h-full bg-amber-300 rounded"
          style={{ width: `${pct}%` }}
        />
        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-mono text-gray-700">
          {count}/{total}
        </span>
      </div>
      <p className="text-[9px] text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

function isRelevantToGoal(goalId: string, category: string): boolean {
  const relevanceMap: Record<string, string[]> = {
    skincare_daily: ['skincare'],
    wellness_fitness: ['wellness'],
    casual_clothing: ['t-shirt', 'graphic_t-shirt', 'hoodie', 'jeans', 'cargo_pants'],
    tech_gadget: ['keyboard', 'mouse', 'bluetooth_speaker', 'wireless_earbuds', 'smartwatch', 'desk_lamp', 'pen_set'],
    haircare: ['haircare'],
    gift_under_1500: [],
  };
  const relevant = relevanceMap[goalId];
  if (!relevant || relevant.length === 0) return true;
  return relevant.includes(category);
}
