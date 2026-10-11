begin;
create extension if not exists pgtap with schema extensions;
select plan(10);
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
values ('41000000-0000-0000-0000-000000000001', 'analytics-test@example.test', '{}', '{}');
update public.profiles set role = 'admin' where id = '41000000-0000-0000-0000-000000000001';
insert into public.projects (id, user_id, name) values
('42000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', 'Analytics fixture');
insert into public.diagrams (project_id, user_id, title, type, created_at) values
('42000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', 'First', 'erd', '2026-10-01T00:00:00Z'),
('42000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', 'Second', 'flowchart', '2026-10-03T23:59:59Z'),
('42000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', 'Outside', 'erd', '2026-10-04T00:00:00Z');
select set_config('request.jwt.claims', '{"sub":"41000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
create temporary table analytics_result as select public.get_diagram_analytics('2026-10-01', '2026-10-03', '42000000-0000-0000-0000-000000000001') as data;
select is((select (data->>'total_diagrams')::int from analytics_result), 2, 'UTC start and inclusive end dates filter actual records');
select is((select (data->>'project_count')::int from analytics_result), 1, 'projects with diagrams excludes empty projects');
select is((select (data->>'average_per_project')::numeric from analytics_result), 2::numeric, 'average uses filtered projects');
select is((select jsonb_array_length(data->'records') from analytics_result), 2, 'record count matches KPI');
select is((select (data->'series'->1->>'count')::int from analytics_result), 0, 'missing day has a zero bucket');
select is((select sum((x->>'count')::int)::int from analytics_result, jsonb_array_elements(data->'types') x), 2, 'pie total matches records');
select is((public.get_diagram_analytics(null,null,'42000000-0000-0000-0000-000000000001','erd','First')->>'total_diagrams')::int, 1, 'search and type filters are combined');
select is((public.get_diagram_analytics(null,null,'42000000-0000-0000-0000-000000000001',null,'absent')->>'average_per_project')::numeric, 0::numeric, 'empty dataset avoids division by zero');
select throws_ok($$select public.get_diagram_analytics('2026-10-03','2026-10-01')$$, 'P0001', 'Start date must precede end date', 'invalid date range rejected');
reset role;
update public.profiles set role = 'user' where id = '41000000-0000-0000-0000-000000000001';
set local role authenticated;
select throws_ok($$select public.get_diagram_analytics()$$, '42501', 'Administrator access required', 'non-admin cannot use shared analytics RPC');
select * from finish();
rollback;
