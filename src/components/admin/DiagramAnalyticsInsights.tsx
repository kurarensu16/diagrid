import { Card } from '../ui/Card';
import type { AnalyticsInsights, AnalyticsSegment } from '../../services/analyticsService';

const signed = (value: number) => `${value > 0 ? '+' : ''}${value}`;
export function DiagramAnalyticsInsights({ insights, onProject }: { insights?: AnalyticsInsights; onProject: (id: string) => void }) {
  if (!insights) return <Card><h2 className="font-bold text-lg">Advanced analytics</h2><p className="text-sm text-ink-soft mt-2">Apply the advanced analytics migration in Supabase to enable comparisons, forecasts, and suggested actions.</p></Card>;
  const { diagnostic, forecast, recommendations } = insights;
  const segmentRows = (title: string, segments: AnalyticsSegment[]) => <div className="mt-4"><h4 className="font-bold text-xs mb-2">{title}</h4>{segments.length ? segments.slice(0, 3).map(s => <div key={s.id} className="flex justify-between gap-3 py-1 text-xs"><span className="truncate" title={s.label}>{s.label}</span><span className="shrink-0">{s.previous} → {s.recent} ({signed(s.delta)})</span></div>) : <p className="text-xs text-ink-soft">No matching creations in this window.</p>}</div>;
  return <section aria-label="Advanced analytics" className="space-y-5">
    <div><h2 className="text-xl font-bold">Comparisons, forecasts & actions</h2><p className="text-xs text-ink-soft mt-1">Analysis window: {insights.window_start}–{insights.window_end} · 28 completed UTC days · uses the current filters</p></div>
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
      <Card><p className="font-mono text-xs text-blueprint">// diagnostic</p><h3 className="font-bold text-lg mt-2">What changed?</h3>
        {insights.complete_history ? <><p className="text-2xl font-bold mt-4">{diagnostic.previous_count} → {diagnostic.recent_count}</p><p className="text-xs text-ink-soft mt-1">Previous 14 days → recent 14 days · {diagnostic.change_pct === null ? 'Percentage unavailable: previous count is zero.' : `${signed(diagnostic.change_pct)}% change`}</p></> : <p className="text-sm text-ink-soft mt-4">A full 28-day matching history is needed for a fair period comparison.</p>}
        {insights.complete_history && <>{segmentRows('Project contributions', diagnostic.project_changes)}{segmentRows('Diagram-type contributions', diagnostic.type_changes)}</>}
        <p className="text-xs text-ink-soft mt-4">These differences identify segments associated with the change; they do not establish its cause.</p>
      </Card>
      <Card><p className="font-mono text-xs text-blueprint">// predictive</p><h3 className="font-bold text-lg mt-2">Seven-day baseline</h3>
        {forecast.status === 'available' ? <><p className="text-2xl font-bold mt-4">≈ {forecast.estimate?.toFixed(2)} diagrams</p><p className="text-xs text-ink-soft mt-1">Estimated creations for {forecast.start}–{forecast.end}{forecast.historical_projection ? ' (historical projection)' : ''}</p><p className="text-sm mt-4">Recent weekly counts: {forecast.observed_weekly_min}–{forecast.observed_weekly_max}</p><p className="text-xs text-ink-soft mt-2">Last-week check: estimated {forecast.backtest_estimate}, observed {forecast.backtest_actual}; absolute error {forecast.backtest_absolute_error} diagrams.</p></> : <p className="text-sm text-ink-soft mt-4">{forecast.reason}</p>}
        <p className="text-xs text-ink-soft mt-4">Four-week moving average. A planning estimate, not a guarantee; the weekly range is historical variation, not a confidence interval.</p>
      </Card>
      <Card><p className="font-mono text-xs text-blueprint">// prescriptive</p><h3 className="font-bold text-lg mt-2">Suggested reviews</h3>
        {recommendations.length ? recommendations.map(r => <div key={r.id} className="mt-4 border-t border-line pt-3"><h4 className="text-sm font-bold">{r.title}</h4><p className="text-xs mt-1">{r.evidence}</p><p className="text-xs text-ink-soft mt-2">{r.detail}</p>{r.project_id && <button className="text-xs text-blueprint underline mt-2" onClick={() => onProject(r.project_id!)}>Focus on this project</button>}</div>) : <p className="text-sm text-ink-soft mt-4">No rule-based review actions were triggered for this view.</p>}
      </Card>
    </div>
    <details className="text-xs text-ink-soft"><summary className="cursor-pointer font-mono text-blueprint">Calculation methods & limitations</summary><p className="mt-2">The analysis ends on the selected end date or yesterday UTC, whichever is earlier. Today and future records are excluded. Comparisons require 28 days of matching history; forecasts also require 10 creations during that window. The last-week check uses the preceding three weeks, so it does not train on the week being checked. Deleted diagrams are absent from retained records, and a narrow filter may leave too little history. Suggestions are transparent review rules and never automatically change a project.</p></details>
  </section>;
}
