import { useState, useEffect } from 'react';
import { useMerchant } from '../MerchantContext';

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

function getDiscoveryLevel(picked: number, total: number): { label: string; color: string } {
  const pct = total > 0 ? (picked / total) * 100 : 0;
  if (pct <= 5) return { label: 'Very low', color: 'var(--seal-red)' };
  if (pct <= 15) return { label: 'Low', color: '#8B6914' };
  if (pct <= 30) return { label: 'Moderate', color: 'var(--ink-muted)' };
  return { label: 'Good', color: 'var(--seal-green)' };
}

export default function CatalogAudit() {
  const { apiUrl, merchantId } = useMerchant();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);

  useEffect(() => {
    fetch(apiUrl('/api/catalog-audit/findings'))
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [merchantId]);

  if (loading) {
    return (
      <div style={{ background: '#fff', border: '1px solid var(--ledger-line)', borderRadius: 8, padding: 32 }}>
        <p className="font-body text-sm text-ink-muted animate-pulse">Loading catalog audit...</p>
      </div>
    );
  }

  if (!data?.has_data || !data.findings) {
    return (
      <div style={{ background: '#fff', border: '1px solid var(--ledger-line)', borderRadius: 8, padding: 32 }}>
        <h2 className="font-display" style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--ink)' }}>Catalog Legibility Check</h2>
        <p className="font-body text-sm text-ink-muted mt-2">
          No audit data yet. Run <span className="font-data text-xs">npm run catalog-audit</span> to generate.
        </p>
      </div>
    );
  }

  const f = data.findings;
  const allPickedIds = new Set(f.goals.flatMap(g => g.pick_rates.map(p => p.item_id)));
  const discoveryPct = f.catalog_size > 0 ? Math.round((allPickedIds.size / f.catalog_size) * 100) : 0;

  return (
    <div style={{ background: '#fff', border: '1px solid var(--ledger-line)', borderRadius: 8, overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div style={{ padding: '32px 32px 0' }}>
        <div className="flex items-start justify-between">
          <div>
            <p className="font-body" style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              One-Time Measurement
            </p>
            <h2 className="font-display" style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em', marginTop: 4 }}>
              Catalog Legibility Check
            </h2>
          </div>
          <span className="font-data" style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 16 }}>
            N={f.goals[0]?.total_trials || 0} / goal
          </span>
        </div>
        <p className="font-body" style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 8, lineHeight: 1.6, maxWidth: 560, borderLeft: '2px solid var(--ledger-line)', paddingLeft: 12 }}>
          A one-time measurement of whether AI agents fairly consider every catalog item. Small sample size — read as a directional signal, not a statistical guarantee.
        </p>
      </div>

      {/* ── Primary insight ── */}
      <div style={{ padding: '28px 32px', margin: '24px 32px 0', background: 'var(--paper)', borderRadius: 8 }}>
        <p className="font-body" style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
          Catalog Discovery
        </p>
        <div className="flex items-end gap-3" style={{ marginBottom: 8 }}>
          <span className="font-data" style={{ fontSize: 42, fontWeight: 500, color: 'var(--ink)', lineHeight: 1 }}>
            {discoveryPct}%
          </span>
          <span className="font-body" style={{ fontSize: 14, color: 'var(--ink-muted)', paddingBottom: 6 }}>
            of catalog discovered across all intents
          </span>
        </div>
        <div style={{ height: 6, background: 'var(--ledger-line)', borderRadius: 3, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ height: '100%', width: `${discoveryPct}%`, background: 'var(--signal-indigo)', borderRadius: 3, transition: 'width 0.6s ease' }} />
        </div>
        <div className="flex items-center gap-8">
          <div>
            <span className="font-data" style={{ fontSize: 24, fontWeight: 500, color: 'var(--ink)' }}>{f.total_trials}</span>
            <p className="font-body" style={{ fontSize: 10, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>Total Trials</p>
          </div>
          <div>
            <span className="font-data" style={{ fontSize: 24, fontWeight: 500, color: 'var(--ink)' }}>{f.total_goals}</span>
            <p className="font-body" style={{ fontSize: 10, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>Goals Tested</p>
          </div>
          <div>
            <span className="font-data" style={{ fontSize: 24, fontWeight: 500, color: 'var(--ink)' }}>{f.catalog_size}</span>
            <p className="font-body" style={{ fontSize: 10, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>Catalog Items</p>
          </div>
          <div>
            <span className="font-data" style={{ fontSize: 24, fontWeight: 500, color: 'var(--ink)' }}>{allPickedIds.size}</span>
            <p className="font-body" style={{ fontSize: 10, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>Items Surfaced</p>
          </div>
        </div>
      </div>

      {/* ── Discovery by intent — compact bar chart ── */}
      <div style={{ padding: '24px 32px 0' }}>
        <p className="font-body" style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
          Discovery by Intent
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {f.goals.map(goal => {
            const picked = goal.pick_rates.length;
            const pct = f.catalog_size > 0 ? (picked / f.catalog_size) * 100 : 0;
            const level = getDiscoveryLevel(picked, f.catalog_size);
            return (
              <div key={goal.goal_id} className="flex items-center gap-3">
                <span className="font-body" style={{ fontSize: 12, color: 'var(--ink)', width: 120, flexShrink: 0, textTransform: 'capitalize' }}>
                  {goal.goal_id.replace(/_/g, ' ')}
                </span>
                <div style={{ flex: 1, height: 8, background: 'var(--ledger-line)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.max(pct, 2)}%`, background: level.color, borderRadius: 4, opacity: 0.7, transition: 'width 0.4s ease' }} />
                </div>
                <span className="font-data" style={{ fontSize: 11, color: 'var(--ink-muted)', width: 40, textAlign: 'right', flexShrink: 0 }}>
                  {picked}/{f.catalog_size}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Goal cards — 2-col grid ── */}
      <div style={{ padding: '28px 32px 0' }}>
        <p className="font-body" style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
          Detailed Findings
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {f.goals.map((goal, idx) => {
            const isExpanded = expandedGoal === goal.goal_id;
            const picked = goal.pick_rates.length;
            const pct = f.catalog_size > 0 ? Math.round((picked / f.catalog_size) * 100) : 0;
            const level = getDiscoveryLevel(picked, f.catalog_size);
            const maxPicks = Math.max(...goal.pick_rates.map(p => p.times_picked), 1);

            return (
              <div key={goal.goal_id} style={{
                border: '1px solid var(--ledger-line)',
                borderRadius: 8,
                overflow: 'hidden',
                transition: 'box-shadow 0.2s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
              >
                {/* Card header — always visible */}
                <button
                  onClick={() => setExpandedGoal(isExpanded ? null : goal.goal_id)}
                  style={{ width: '100%', textAlign: 'left', padding: '18px 20px', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <div className="flex items-start justify-between" style={{ marginBottom: 10 }}>
                    <div>
                      <span className="font-data" style={{ fontSize: 11, color: 'var(--ink-muted)' }}>
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <h4 className="font-body" style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', textTransform: 'capitalize', marginTop: 2 }}>
                        {goal.goal_id.replace(/_/g, ' ')}
                      </h4>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                      <span className="font-data" style={{ fontSize: 22, fontWeight: 500, color: 'var(--ink)' }}>
                        {picked}
                      </span>
                      <span className="font-data" style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
                        /{f.catalog_size}
                      </span>
                      <p className="font-body" style={{ fontSize: 9, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 1 }}>
                        Items Discovered
                      </p>
                    </div>
                  </div>

                  <p className="font-body" style={{ fontSize: 12, color: 'var(--ink-muted)', lineHeight: 1.5, marginBottom: 12 }}>
                    {goal.goal_text}
                  </p>

                  {/* Discovery bar */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ height: 4, background: 'var(--ledger-line)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.max(pct, 2)}%`, background: level.color, borderRadius: 2, opacity: 0.7 }} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-body" style={{ fontSize: 11, color: 'var(--ink-muted)' }}>
                        <span style={{ color: 'var(--seal-green)' }}>{picked} surfaced</span>
                        {' · '}
                        <span style={{ color: level.color }}>{goal.never_picked.length} not surfaced</span>
                      </span>
                    </div>
                    <span className="font-body" style={{ fontSize: 11, color: 'var(--ink-muted)' }}>
                      {isExpanded ? 'Hide details' : 'View details'} {isExpanded ? '↑' : '→'}
                    </span>
                  </div>
                </button>

                {/* ── Expanded detail ── */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--ledger-line)', padding: '18px 20px' }}>

                    {/* Pick rates */}
                    <div style={{ marginBottom: 18 }}>
                      <p className="font-body" style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                        Pick Distribution <span className="font-data" style={{ fontSize: 10, fontWeight: 400 }}>({goal.total_trials} trials)</span>
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {goal.pick_rates.map(p => (
                          <div key={p.item_id} className="flex items-center gap-2">
                            <span className="font-body" style={{ fontSize: 11, color: 'var(--ink)', width: 100, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.item_title}>
                              {p.item_title}
                            </span>
                            <div style={{ flex: 1, height: 6, background: 'var(--ledger-line)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{
                                height: '100%', borderRadius: 3,
                                width: `${(p.times_picked / maxPicks) * 100}%`,
                                background: 'var(--signal-indigo)', opacity: 0.6,
                              }} />
                            </div>
                            <span className="font-data" style={{ fontSize: 10, color: 'var(--ink-muted)', width: 36, textAlign: 'right', flexShrink: 0 }}>
                              {p.times_picked}/{p.total_trials}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Invisible items */}
                    {goal.never_picked.length > 0 && (
                      <div style={{ marginBottom: 18 }}>
                        <p className="font-body" style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                          Not Surfaced <span className="font-data" style={{ fontSize: 10, fontWeight: 400 }}>({goal.never_picked.length} items)</span>
                        </p>
                        <div style={{ maxHeight: 100, overflowY: 'auto' }}>
                          <div className="flex flex-wrap gap-1.5">
                            {goal.never_picked
                              .filter(n => isRelevantToGoal(goal.goal_id, n.category))
                              .map(n => (
                                <span key={n.item_id} className="font-body"
                                  style={{ fontSize: 10, color: 'var(--ink-muted)', background: 'var(--paper)', border: '1px solid var(--ledger-line)', borderRadius: 4, padding: '2px 8px' }}
                                  title={`${n.item_title} — ₹${n.price_rupees} (${n.category})`}
                                >
                                  {n.item_title}
                                </span>
                              ))}
                            {goal.never_picked.filter(n => !isRelevantToGoal(goal.goal_id, n.category)).length > 0 && (
                              <span className="font-body" style={{ fontSize: 10, color: 'var(--ink-muted)', padding: '2px 4px' }}>
                                +{goal.never_picked.filter(n => !isRelevantToGoal(goal.goal_id, n.category)).length} other categories
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Position bias */}
                    <div>
                      <p className="font-body" style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                        Position Bias Check
                      </p>
                      <div className="flex items-center gap-4">
                        <PositionBar label="Top ⅓" count={goal.position_analysis.top_third_picks} total={goal.position_analysis.total_valid} />
                        <PositionBar label="Mid ⅓" count={goal.position_analysis.middle_third_picks} total={goal.position_analysis.total_valid} />
                        <PositionBar label="Bot ⅓" count={goal.position_analysis.bottom_third_picks} total={goal.position_analysis.total_valid} />
                      </div>
                      <p className="font-body" style={{ fontSize: 10, color: 'var(--ink-muted)', marginTop: 6, lineHeight: 1.5 }}>
                        Catalog shuffled each trial. {goal.position_analysis.summary.includes('possible') ? 'Possible position bias detected.' : 'No strong position bias.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{ padding: '20px 32px 24px', marginTop: 20 }}>
        <div style={{ borderTop: '1px solid var(--ledger-line)', paddingTop: 14 }}>
          <span className="font-data" style={{ fontSize: 10, color: 'var(--ink-muted)' }}>
            Measurement batch · {f.run_batch_id}
          </span>
        </div>
      </div>
    </div>
  );
}

function PositionBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ height: 6, background: 'var(--ledger-line)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--signal-indigo)', borderRadius: 3, opacity: 0.45 }} />
      </div>
      <div style={{ marginTop: 4 }}>
        <span className="font-data" style={{ fontSize: 10, color: 'var(--ink)' }}>{count}/{total}</span>
        <span className="font-body" style={{ fontSize: 9, color: 'var(--ink-muted)', marginLeft: 4 }}>{label}</span>
      </div>
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
