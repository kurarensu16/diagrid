-- Additive API: keep the original FRE413 outputs and calculate additional
-- insights from those exact returned records, without another database scan.
create or replace function public.calculate_diagram_insights(
  dataset jsonb, selected_start date, selected_end date, reference_date date
) returns jsonb
language plpgsql immutable set search_path = public
as $$
declare
  analysis_end date := least(coalesce(selected_end, reference_date - 1), reference_date - 1);
  analysis_start date;
  oldest date;
  current_count int;
  previous_count int;
  total_count int;
  weekly_counts jsonb;
  segments jsonb;
  project_changes jsonb;
  type_changes jsonb;
  dominant jsonb;
  declining jsonb;
  forecast jsonb;
  actions jsonb := '[]'::jsonb;
  full_window boolean;
  forecast_ready boolean;
begin
  if reference_date is null then raise exception 'Reference date is required'; end if;
  analysis_start := analysis_end - 27;
  with records as (
    select * from jsonb_to_recordset(dataset) as r(
      project_id text, project_name text, type text, created_at timestamptz
    )
  ), usable as (
    select *, (created_at at time zone 'UTC')::date as day from records
    where (created_at at time zone 'UTC')::date <= analysis_end
  ), grouped as (
    select 'project' as kind, project_id as id, project_name as label,
      count(*) filter (where day between analysis_end - 13 and analysis_end)::int as recent,
      count(*) filter (where day between analysis_start and analysis_end - 14)::int as previous
    from usable where day >= analysis_start group by project_id, project_name
    union all
    select 'type', type, type,
      count(*) filter (where day between analysis_end - 13 and analysis_end)::int,
      count(*) filter (where day between analysis_start and analysis_end - 14)::int
    from usable where day >= analysis_start group by type
  ), weeks as (
    select n, count(u.day)::int as count
    from generate_series(0, 3) n
    left join usable u on u.day between analysis_start + n * 7 and analysis_start + n * 7 + 6
    group by n
  )
  select (select min(day) from usable),
    (select count(*) from usable where day between analysis_end - 13 and analysis_end),
    (select count(*) from usable where day between analysis_start and analysis_end - 14),
    coalesce((select jsonb_agg(jsonb_build_object('start', analysis_start + n * 7, 'end', analysis_start + n * 7 + 6, 'count', count) order by n) from weeks), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'id', id, 'label', label, 'recent', recent, 'previous', previous, 'delta', recent - previous) order by abs(recent - previous) desc, label, id) from grouped), '[]'::jsonb)
  into oldest, current_count, previous_count, weekly_counts, segments;

  total_count := current_count + previous_count;
  full_window := (selected_start is null or selected_start <= analysis_start)
    and oldest is not null and oldest <= analysis_start;
  forecast_ready := full_window and total_count >= 10;
  select coalesce(jsonb_agg(s), '[]'::jsonb) into project_changes
    from jsonb_array_elements(segments) s where s->>'kind' = 'project';
  select coalesce(jsonb_agg(s), '[]'::jsonb) into type_changes
    from jsonb_array_elements(segments) s where s->>'kind' = 'type';
  select s into dominant from jsonb_array_elements(project_changes) s
    order by (s->>'recent')::int + (s->>'previous')::int desc, s->>'label', s->>'id' limit 1;
  select s into declining from jsonb_array_elements(project_changes) s
    where (s->>'delta')::int < 0 order by (s->>'delta')::int, s->>'label', s->>'id' limit 1;

  forecast := jsonb_build_object(
    'status', case when forecast_ready then 'available' else 'insufficient_data' end,
    'reason', case when not full_window then 'Select a range containing at least 28 completed days of matching history.'
      when total_count < 10 then 'At least 10 matching creations in the 28-day analysis window are needed.' else null end,
    'method', 'four_week_average',
    'estimate', case when forecast_ready then round(total_count::numeric / 4, 2) else null end,
    'start', analysis_end + 1, 'end', analysis_end + 7,
    'historical_projection', analysis_end < reference_date - 1,
    'weekly_counts', weekly_counts,
    'observed_weekly_min', (select min((w->>'count')::int) from jsonb_array_elements(weekly_counts) w),
    'observed_weekly_max', (select max((w->>'count')::int) from jsonb_array_elements(weekly_counts) w),
    'backtest_estimate', case when forecast_ready then round(((weekly_counts->0->>'count')::numeric + (weekly_counts->1->>'count')::numeric + (weekly_counts->2->>'count')::numeric) / 3, 2) else null end,
    'backtest_actual', case when forecast_ready then (weekly_counts->3->>'count')::int else null end,
    'backtest_absolute_error', case when forecast_ready then round(abs(((weekly_counts->0->>'count')::numeric + (weekly_counts->1->>'count')::numeric + (weekly_counts->2->>'count')::numeric) / 3 - (weekly_counts->3->>'count')::numeric), 2) else null end
  );

  if not forecast_ready then
    actions := actions || jsonb_build_array(jsonb_build_object('id', 'history', 'title', 'Build a stronger history',
      'detail', 'Use a range covering 28 completed days and at least 10 actual creations before relying on the baseline forecast.',
      'evidence', total_count || ' matching creations in the analysis window.', 'project_id', null));
  end if;
  if full_window and previous_count >= 5 and current_count < previous_count then
    actions := actions || jsonb_build_array(jsonb_build_object('id', 'decline', 'title', 'Review declining project activity',
      'detail', 'Compare project requirements and recent work before deciding whether follow-up is needed. Lower creation counts alone do not prove a problem.',
      'evidence', case when declining is null then 'Recent 14-day creations are lower than the previous 14 days.' else
        (declining->>'label') || ': ' || (declining->>'previous') || ' to ' || (declining->>'recent') || ' creations.' end,
      'project_id', declining->>'id'));
  end if;
  if total_count >= 10 and dominant is not null
    and ((dominant->>'recent')::int + (dominant->>'previous')::int)::numeric / total_count >= 0.60 then
    actions := actions || jsonb_build_array(jsonb_build_object('id', 'concentration', 'title', 'Review the dominant project',
      'detail', 'Check that its documentation coverage matches its scope. Concentrated activity may be intentional; this rule flags a review, not a fault.',
      'evidence', (dominant->>'label') || ' accounts for ' || round(((dominant->>'recent')::int + (dominant->>'previous')::int)::numeric / total_count * 100, 1) || '% of creations in the analysis window (review threshold: 60%).',
      'project_id', dominant->>'id'));
  end if;
  return jsonb_build_object(
    'window_start', analysis_start, 'window_end', analysis_end, 'complete_history', full_window,
    'diagnostic', jsonb_build_object('recent_count', current_count, 'previous_count', previous_count,
      'delta', current_count - previous_count,
      'change_pct', case when full_window and previous_count > 0 then round((current_count - previous_count)::numeric / previous_count * 100, 2) else null end,
      'project_changes', project_changes, 'type_changes', type_changes),
    'forecast', forecast, 'recommendations', actions
  );
end;
$$;
revoke all on function public.calculate_diagram_insights(jsonb, date, date, date) from public, anon, authenticated;

create or replace function public.get_diagram_analytics_v2(
  start_date date default null, end_date date default null,
  filter_project uuid default null, filter_type text default null,
  search_text text default '', bucket text default 'day'
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare result jsonb;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  result := public.get_diagram_analytics(start_date, end_date, filter_project, filter_type, search_text, bucket);
  return result || jsonb_build_object('insights', public.calculate_diagram_insights(
    result->'records', start_date, end_date, (statement_timestamp() at time zone 'UTC')::date));
end;
$$;
revoke all on function public.get_diagram_analytics_v2(date, date, uuid, text, text, text) from public, anon;
grant execute on function public.get_diagram_analytics_v2(date, date, uuid, text, text, text) to authenticated;
