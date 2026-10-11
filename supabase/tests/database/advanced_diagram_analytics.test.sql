begin;
create extension if not exists pgtap with schema extensions;
select plan(12);
create temporary table insight_fixture as
select jsonb_agg(jsonb_build_object(
  'project_id', case when n = 1 then 'p2' else 'p1' end,
  'project_name', case when n = 1 then 'Secondary' else 'Main project' end,
  'type', case when n = 1 then 'flowchart' else 'erd' end,
  'created_at', ('2026-09-10'::date + week * 7)::timestamp at time zone 'UTC'
)) as data
from generate_series(0,3) week cross join lateral generate_series(1,2*(week+1)) n;
create temporary table advanced_result as select public.calculate_diagram_insights(data, null, null, '2026-10-08') as result from insight_fixture;
select is((select result->>'window_start' from advanced_result), '2026-09-10', 'analysis uses 28 completed UTC days');
select is((select (result->'diagnostic'->>'recent_count')::int from advanced_result), 14, 'recent 14-day count comes from records');
select is((select (result->'diagnostic'->>'previous_count')::int from advanced_result), 6, 'previous period has equal duration');
select is((select (result->'diagnostic'->>'change_pct')::numeric from advanced_result), 133.33::numeric, 'change percentage is calculated');
select is((select (result->'forecast'->>'estimate')::numeric from advanced_result), 5::numeric, 'four-week baseline averages 2,4,6,8');
select is((select (result->'forecast'->>'backtest_estimate')::numeric from advanced_result), 4::numeric, 'backtest trains only on preceding three weeks');
select is((select (result->'forecast'->>'backtest_absolute_error')::numeric from advanced_result), 4::numeric, 'backtest error compares estimate to held-out week');
select is((select result->'recommendations'->0->>'id' from advanced_result), 'concentration', 'measured project share triggers review rule');
select is((select public.calculate_diagram_insights(data,'2026-10-01',null,'2026-10-08')->'forecast'->>'status' from insight_fixture), 'insufficient_data', 'narrow ranges do not produce forecasts');
select is(public.calculate_diagram_insights('[]',null,null,'2026-10-08')->'forecast'->>'status', 'insufficient_data', 'empty data does not produce forecasts');
select is((select (public.calculate_diagram_insights(data,null,'2026-10-07','2026-10-10')->'forecast'->>'historical_projection')::boolean from insight_fixture), true, 'past projections are labelled historical');
select ok(not has_function_privilege('anon', 'public.get_diagram_analytics_v2(date,date,uuid,text,text,text)', 'EXECUTE'), 'anonymous accounts cannot execute advanced analytics');
select * from finish();
rollback;
