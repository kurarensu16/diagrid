import { isSupabaseConfigured, supabase } from './supabase';

export interface AnalyticsFilters {
  start: string;
  end: string;
  project: string;
  type: string;
  search: string;
  bucket: 'day' | 'week' | 'month';
}
export interface DiagramRecord {
  id: string; title: string; project_id: string; project_name: string;
  type: string; created_at: string; updated_at: string;
}
export interface DiagramAnalytics {
  insights?: AnalyticsInsights;
  total_diagrams: number; project_count: number; average_per_project: number;
  most_used_type: string | null; most_used_count: number;
  types: { label: string; count: number }[];
  projects: { id: string; label: string; count: number }[];
  series: { date: string; count: number }[];
  records: DiagramRecord[];
  project_options: { id: string; name: string }[];
  type_options: string[];
  timezone: string; bucket: string;
}
export interface AnalyticsSegment {
  id: string; label: string; recent: number; previous: number; delta: number;
}
export interface AnalyticsInsights {
  window_start: string; window_end: string; complete_history: boolean;
  diagnostic: { recent_count: number; previous_count: number; delta: number; change_pct: number | null; project_changes: AnalyticsSegment[]; type_changes: AnalyticsSegment[] };
  forecast: { status: 'available' | 'insufficient_data'; reason: string | null; estimate: number | null; start: string; end: string; historical_projection: boolean; observed_weekly_min: number; observed_weekly_max: number; backtest_estimate: number | null; backtest_actual: number | null; backtest_absolute_error: number | null; weekly_counts: { start: string; end: string; count: number }[] };
  recommendations: { id: string; title: string; detail: string; evidence: string; project_id: string | null }[];
}
export async function getDiagramAnalytics(filters: AnalyticsFilters): Promise<DiagramAnalytics> {
  if (!isSupabaseConfigured()) throw new Error('Connect Supabase to load your diagram analytics.');
  const parameters = {
    start_date: filters.start || null, end_date: filters.end || null,
    filter_project: filters.project || null, filter_type: filters.type || null,
    search_text: filters.search.trim(), bucket: filters.bucket,
  };
  let { data, error } = await supabase.rpc('get_diagram_analytics_v2', parameters);
  if (error && (error.code === 'PGRST202' || error.code === '42883')) {
    ({ data, error } = await supabase.rpc('get_diagram_analytics', parameters));
  }
  if (error) throw new Error(error.message);
  if (!data) throw new Error('The analytics service returned no response.');
  return data as DiagramAnalytics;
}
