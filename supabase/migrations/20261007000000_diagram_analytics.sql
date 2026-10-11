-- Shared analytics contract for the React and Flutter clients.
create or replace function public.get_diagram_analytics(
  start_date date default null,
  end_date date default null,
  filter_project uuid default null,
  filter_type text default null,
  search_text text default '',
  bucket text default 'day'
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare result jsonb;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if bucket is null or bucket not in ('day', 'week', 'month') then
    raise exception 'Invalid time bucket';
  end if;
  if start_date > end_date then raise exception 'Start date must precede end date'; end if;
  with records as (
    select d.id, d.title, d.project_id, p.name as project_name,
           d.type::text as type, d.created_at, d.updated_at
    from public.diagrams d join public.projects p on p.id = d.project_id
    where (start_date is null or d.created_at >= start_date::timestamp at time zone 'UTC')
      and (end_date is null or d.created_at < (end_date + 1)::timestamp at time zone 'UTC')
      and (filter_project is null or d.project_id = filter_project)
      and (filter_type is null or d.type::text = filter_type)
      and (coalesce(search_text, '') = '' or strpos(lower(d.title || ' ' || p.name || ' ' || d.type::text), lower(search_text)) > 0)
  ), types as (
    select type as label, count(*) as count from records group by type
  ), projects as (
    select project_id as id, project_name as label, count(*) as count
    from records group by project_id, project_name
  ), bounds as (
    select date_trunc(bucket, coalesce(start_date::timestamp, min(created_at at time zone 'UTC'))) as first,
      date_trunc(bucket, coalesce(end_date::timestamp, max(created_at at time zone 'UTC'))) as last from records
  ), series as (
    select gs as date, count(r.id) as count
    from bounds cross join lateral generate_series(first, last,
      case bucket when 'day' then interval '1 day' when 'week' then interval '1 week' else interval '1 month' end) gs
    left join records r on date_trunc(bucket, r.created_at at time zone 'UTC') = gs
    group by gs order by gs
  )
  select jsonb_build_object(
    'total_diagrams', (select count(*) from records),
    'project_count', (select count(*) from projects),
    'average_per_project', (select case when count(distinct project_id) = 0 then 0 else round(count(*)::numeric / count(distinct project_id), 2) end from records),
    'most_used_type', (select label from types order by count desc, label limit 1),
    'most_used_count', coalesce((select count from types order by count desc, label limit 1), 0),
    'types', coalesce((select jsonb_agg(t order by count desc, label) from types t), '[]'::jsonb),
    'projects', coalesce((select jsonb_agg(p order by count desc, label, id) from projects p), '[]'::jsonb),
    'series', coalesce((select jsonb_agg(jsonb_build_object('date', to_char(date, 'YYYY-MM-DD'), 'count', count) order by date) from series), '[]'::jsonb),
    'records', coalesce((select jsonb_agg(r order by created_at desc, id) from records r), '[]'::jsonb),
    'project_options', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by name, id) from public.projects), '[]'::jsonb),
    'type_options', coalesce((select jsonb_agg(type order by type) from (select distinct type::text as type from public.diagrams) t), '[]'::jsonb),
    'timezone', 'UTC', 'bucket', bucket
  ) into result;
  return result;
end;
$$;
revoke all on function public.get_diagram_analytics(date, date, uuid, text, text, text) from public, anon;
grant execute on function public.get_diagram_analytics(date, date, uuid, text, text, text) to authenticated;
