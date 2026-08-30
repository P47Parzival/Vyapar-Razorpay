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
      <div className="register p-4 animate-pulse font-body text-sm text-ink-muted">
        Loading catalog audit...
      </div>
    );
  }

  if (!data?.has_data || !data.findings) {
    return (
      <div className="register">
        <div className="register-header">
          <h2>Catalog Legibility Check</h2>
          <p className="font-body text-xs text-ink-muted mt-0.5">One-time measurement</p>
        </div>
        <div className="register-body font-body text-sm text-ink-muted">
          No audit data yet. Run <span className="font-data text-xs">npm run catalog-audit</span> to generate.
        </div>
      </div>
    );
  }

  const f = data.findings;

  return (
    <div className="register">
      <div className="register-header flex items-center justify-between">
        <div>
          <h2>Catalog Legibility Check</h2>
          <p className="font-body text-[10px] text-ink-muted uppercase tracking-wider mt-0.5">One-Time Measurement</p>
        </div>
        <span className="font-data text-xs text-ink-muted">
          N={f.goals[0]?.total_trials || 0}/goal
        </span>
      </div>

      <div className="register-body space-y-4">
        <p className="font-body text-xs text-ink-muted leading-relaxed pl-3 border-l-2" style={{ borderColor: 'var(--signal-indigo)' }}>
          This is a one-time measurement (N={f.goals[0]?.total_trials || 0} trials per goal) of whether
          our AI agents fairly consider every catalog item, not a live monitor. Small sample
          size — read as a directional signal, not a statistical guarantee.
        </p>

        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 rounded border" style={{ borderColor: 'var(--ledger-line)' }}>
            <p className="font-data text-lg font-bold text-ink">{f.total_trials}</p>
            <p className="font-body text-[10px] text-ink-muted uppercase">Total Trials</p>
          </div>
          <div className="text-center p-2 rounded border" style={{ borderColor: 'var(--ledger-line)' }}>
            <p className="font-data text-lg font-bold text-ink">{f.total_goals}</p>
            <p className="font-body text-[10px] text-ink-muted uppercase">Goals Tested</p>
          </div>
          <div className="text-center p-2 rounded border" style={{ borderColor: 'var(--ledger-line)' }}>
            <p className="font-data text-lg font-bold text-ink">{f.catalog_size}</p>
            <p className="font-body text-[10px] text-ink-muted uppercase">Catalog Items</p>
          </div>
        </div>

        {f.goals.map(goal => {
          const isExpanded = expandedGoal === goal.goal_id;
          const maxPicks = Math.max(...goal.pick_rates.map(p => p.times_picked));

          return (
            <div key={goal.goal_id} className="rounded border overflow-hidden" style={{ borderColor: 'var(--ledger-line)' }}>
              <button
                onClick={() => setExpandedGoal(isExpanded ? null : goal.goal_id)}
                className="w-full px-3 py-2.5 transition-colors text-left flex items-center justify-between"
                style={{ background: 'rgba(0,0,0,0.015)' }}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-body text-sm font-medium text-ink truncate">{goal.goal_id.replace(/_/g, ' ')}</p>
                  <p className="font-body text-[10px] text-ink-muted truncate mt-0.5">{goal.goal_text}</p>
                </div>
                <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                  <span className="font-data text-[10px] text-seal-green">
                    {goal.pick_rates.length} picked
                  </span>
                  <span className="font-data text-[10px] text-seal-red">
                    {goal.never_picked.length} invisible
                  </span>
                  <span className="font-body text-xs text-ink-muted">{isExpanded ? '▲' : '▼'}</span>
                </div>
              </button>

              {isExpanded && (
                <div className="p-3 space-y-3 border-t" style={{ borderColor: 'var(--ledger-line)' }}>
                  <div>
                    <p className="font-body text-[10px] text-ink-muted uppercase tracking-wider font-medium mb-2">
                      Pick Rates (<span className="font-data">{goal.total_trials}</span> trials)
                    </p>
                    <div className="space-y-1.5">
                      {goal.pick_rates.map(p => (
                        <div key={p.item_id} className="flex items-center gap-2">
                          <div className="w-32 truncate font-body text-xs text-ink" title={p.item_title}>
                            {p.item_title}
                          </div>
                          <div className="flex-1 h-5 rounded overflow-hidden relative" style={{ background: 'var(--ledger-line)' }}>
                            <div
                              className="h-full rounded transition-all"
                              style={{ width: `${(p.times_picked / maxPicks) * 100}%`, background: 'var(--signal-indigo)', opacity: 0.7 }}
                            />
                            <span className="absolute inset-0 flex items-center justify-center font-data text-[10px] font-medium text-ink">
                              {p.times_picked}/{p.total_trials}
                            </span>
                          </div>
                          <span className="font-data text-[10px] text-ink-muted w-8 text-right">
                            {(p.rate * 100).toFixed(0)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {goal.never_picked.length > 0 && (
                    <div>
                      <p className="font-body text-[10px] text-seal-red uppercase tracking-wider font-medium mb-1.5">
                        Never Picked — "Invisible" Items ({goal.never_picked.length})
                      </p>
                      <div className="max-h-32 overflow-y-auto">
                        <div className="flex flex-wrap gap-1">
                          {goal.never_picked
                            .filter(n => isRelevantToGoal(goal.goal_id, n.category))
                            .map(n => (
                              <span
                                key={n.item_id}
                                className="font-body text-[10px] px-1.5 py-0.5 rounded border text-seal-red"
                                style={{ borderColor: 'var(--seal-red)', background: 'rgba(162,59,46,0.04)' }}
                                title={`${n.item_title} — ₹${n.price_rupees} (${n.category})`}
                              >
                                {n.item_title}
                              </span>
                            ))}
                          {goal.never_picked.filter(n => !isRelevantToGoal(goal.goal_id, n.category)).length > 0 && (
                            <span className="font-body text-[10px] text-ink-muted px-1.5 py-0.5">
                              +{goal.never_picked.filter(n => !isRelevantToGoal(goal.goal_id, n.category)).length} from other categories
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="pt-1 border-t" style={{ borderColor: 'var(--ledger-line)' }}>
                    <p className="font-body text-[10px] text-ink-muted uppercase tracking-wider font-medium mb-1">
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
                    <p className="font-body text-[10px] text-ink-muted mt-1">
                      Catalog order was shuffled each trial. {goal.position_analysis.summary.includes('possible') ? 'Possible position bias detected.' : 'No strong position bias.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <p className="font-data text-[10px] text-ink-muted text-center">
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
      <div className="h-4 rounded overflow-hidden relative" style={{ background: 'var(--ledger-line)' }}>
        <div
          className="h-full rounded"
          style={{ width: `${pct}%`, background: 'var(--signal-indigo)', opacity: 0.5 }}
        />
        <span className="absolute inset-0 flex items-center justify-center font-data text-[9px] text-ink">
          {count}/{total}
        </span>
      </div>
      <p className="font-body text-[9px] text-ink-muted mt-0.5">{label}</p>
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
