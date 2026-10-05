-- Diagrid security hardening, phase 1.
-- Apply with the Supabase CLI before deploying the matching frontend changes.

-- ---------------------------------------------------------------------------
-- Diagrams are private by default. Self-contained #d= share links continue to
-- work because their content lives in the URL fragment and never queries this
-- table. A token-based server share model can be added in a later migration.
-- ---------------------------------------------------------------------------
-- Older hosted projects predate account suspension. Add and backfill the
-- authorization column before any policy helper references it.
alter table public.profiles
  add column if not exists status text;
update public.profiles
set status = 'active'
where status is null;
alter table public.profiles
  alter column status set default 'active',
  alter column status set not null;
create index if not exists idx_profiles_status on public.profiles(status);

create or replace function public.is_active_user()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and (status = 'active' or role = 'admin'::public.user_role)
  );
$$;

revoke all on function public.is_active_user() from public, anon;
grant execute on function public.is_active_user() to authenticated;

-- Client validation improves error messages, but direct PostgREST writes must
-- still have a coarse database-enforced complexity ceiling. NOT VALID avoids
-- blocking deployment on legacy rows while enforcing the constraint for every
-- new or changed row.
alter table public.diagrams
  drop constraint if exists diagrams_content_security_limits;
alter table public.diagrams
  add constraint diagrams_content_security_limits check (
    jsonb_typeof(content) = 'object'
    and octet_length(content::text) <= 2097152
    and coalesce(jsonb_typeof(content -> 'nodes') = 'array', false)
    and jsonb_array_length(content -> 'nodes') <= 500
    and coalesce(jsonb_typeof(content -> 'edges') = 'array', false)
    and jsonb_array_length(content -> 'edges') <= 2000
    and (
      not (content ? 'drawings')
      or (
        jsonb_typeof(content -> 'drawings') = 'array'
        and jsonb_array_length(content -> 'drawings') <= 500
      )
    )
  ) not valid;

drop policy if exists "Public can view diagrams" on public.diagrams;
drop policy if exists "Users can view own diagrams" on public.diagrams;
drop policy if exists "Owners and admins can view diagrams" on public.diagrams;
create policy "Owners and admins can view diagrams"
  on public.diagrams for select
  to authenticated
  using (public.is_active_user() and (auth.uid() = user_id or public.is_admin()));

drop policy if exists "Users can create own diagrams" on public.diagrams;
drop policy if exists "Users can create diagrams in own projects" on public.diagrams;
create policy "Users can create diagrams in own projects"
  on public.diagrams for insert
  to authenticated
  with check (
    public.is_active_user()
    and auth.uid() = user_id
    and exists (
      select 1 from public.projects
      where projects.id = project_id and projects.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update own diagrams" on public.diagrams;
drop policy if exists "Owners and admins can update diagrams" on public.diagrams;
create policy "Owners and admins can update diagrams"
  on public.diagrams for update
  to authenticated
  using (public.is_active_user() and (auth.uid() = user_id or public.is_admin()))
  with check (
    public.is_admin()
    or (
      auth.uid() = user_id
      and exists (
        select 1 from public.projects
        where projects.id = project_id and projects.user_id = auth.uid()
      )
    )
  );

drop policy if exists "Users can delete own diagrams" on public.diagrams;
drop policy if exists "Owners and admins can delete diagrams" on public.diagrams;
create policy "Owners and admins can delete diagrams"
  on public.diagrams for delete
  to authenticated
  using (public.is_active_user() and (auth.uid() = user_id or public.is_admin()));

drop policy if exists "Users can view own projects" on public.projects;
drop policy if exists "Active users can view own projects" on public.projects;
create policy "Active users can view own projects"
  on public.projects for select to authenticated
  using (public.is_active_user() and (auth.uid() = user_id or public.is_admin()));
drop policy if exists "Users can create own projects" on public.projects;
drop policy if exists "Active users can create own projects" on public.projects;
create policy "Active users can create own projects"
  on public.projects for insert to authenticated
  with check (public.is_active_user() and auth.uid() = user_id);
drop policy if exists "Users can update own projects" on public.projects;
drop policy if exists "Active users can update own projects" on public.projects;
create policy "Active users can update own projects"
  on public.projects for update to authenticated
  using (public.is_active_user() and (auth.uid() = user_id or public.is_admin()))
  with check (public.is_active_user() and (auth.uid() = user_id or public.is_admin()));
drop policy if exists "Users can delete own projects" on public.projects;
drop policy if exists "Active users can delete own projects" on public.projects;
create policy "Active users can delete own projects"
  on public.projects for delete to authenticated
  using (public.is_active_user() and (auth.uid() = user_id or public.is_admin()));

-- ---------------------------------------------------------------------------
-- Storage: keep avatars public for profile display, but accept raster formats
-- only. Feedback screenshots are private, size-limited, and owner-scoped.
-- ---------------------------------------------------------------------------
update storage.buckets
set file_size_limit = 2097152,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'avatars';

update storage.buckets
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'feedback-attachments';

drop policy if exists "Public view feedback attachments" on storage.objects;
drop policy if exists "Anyone upload feedback attachments" on storage.objects;
drop policy if exists "Public Access for Feedback Attachments" on storage.objects;
drop policy if exists "Anyone can upload feedback attachments" on storage.objects;
drop policy if exists "Authenticated users upload own feedback attachments" on storage.objects;
create policy "Authenticated users upload own feedback attachments"
  on storage.objects for insert
  to authenticated
  with check (
    public.is_active_user()
    and bucket_id = 'feedback-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Admins read feedback attachments" on storage.objects;
create policy "Admins read feedback attachments"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'feedback-attachments' and public.is_admin());

drop policy if exists "Admins can manage feedback attachments" on storage.objects;
create policy "Admins can manage feedback attachments"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'feedback-attachments' and public.is_admin());

drop policy if exists "Users update own avatar" on storage.objects;
create policy "Users update own avatar"
  on storage.objects for update
  to authenticated
  using (public.is_active_user() and bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (public.is_active_user() and bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users delete own avatar" on storage.objects;
create policy "Users delete own avatar"
  on storage.objects for delete
  to authenticated
  using (public.is_active_user() and bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Feedback remains available to guests, but trusted workflow fields cannot be
-- supplied by clients. RLS also applies basic bounds to limit direct API abuse.
-- ---------------------------------------------------------------------------
revoke insert on public.feedback from anon, authenticated;
grant insert (user_id, user_email, type, rating, rating_label, message, page_url, client_metadata, attachment_url, priority)
  on public.feedback to anon, authenticated;

drop policy if exists "Anyone can insert feedback" on public.feedback;
drop policy if exists "Validated feedback can be submitted" on public.feedback;
create policy "Validated feedback can be submitted"
  on public.feedback for insert
  to anon, authenticated
  with check (
    (user_id is null or user_id = auth.uid())
    and char_length(user_email) between 3 and 320
    and type in ('feature', 'bug', 'general')
    and rating between 1 and 5
    and char_length(message) between 1 and 10000
    and coalesce(char_length(page_url), 0) <= 2048
    and priority in ('low', 'medium', 'high', 'critical')
    and status = 'new'
    and admin_notes = ''
  );

-- ---------------------------------------------------------------------------
-- Audit rows receive their actor identity from auth.uid(), never from client
-- input. The target remains descriptive telemetry, not a trusted authorization
-- record; sensitive admin RPCs should also log inside their transaction.
-- ---------------------------------------------------------------------------
drop policy if exists "Anyone authenticated can insert audit logs" on public.audit_logs;
drop policy if exists "Authenticated and anonymous users can insert audit logs" on public.audit_logs;
revoke insert on public.audit_logs from anon, authenticated;
alter table public.audit_logs add column if not exists metadata jsonb default '{}'::jsonb not null;

create or replace function public.log_user_activity(activity_action text, activity_target text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  actor_email text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if activity_action !~ '^[a-z][a-z0-9_]{1,63}$' then
    raise exception 'Invalid activity action';
  end if;
  if char_length(activity_target) > 1000 then
    raise exception 'Activity target is too long';
  end if;

  select email into actor_email from public.profiles where id = auth.uid();
  insert into public.audit_logs (user_id, user_email, action, target, metadata)
  values (auth.uid(), coalesce(actor_email, 'unknown'), activity_action, activity_target, '{}'::jsonb);
end;
$$;

revoke all on function public.log_user_activity(text, text) from public, anon;
grant execute on function public.log_user_activity(text, text) to authenticated;

create or replace function public.set_user_status(target_user_id uuid, target_status text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Unauthorized: Admin role required'; end if;
  if target_status not in ('active', 'suspended') then raise exception 'Invalid user status'; end if;
  if target_user_id = auth.uid() and target_status = 'suspended' then raise exception 'Administrators cannot suspend themselves'; end if;
  if exists (select 1 from public.profiles where id = target_user_id and role = 'admin'::public.user_role) and target_status = 'suspended' then
    raise exception 'Administrator accounts cannot be suspended';
  end if;

  update public.profiles set status = target_status, updated_at = now() where id = target_user_id;
  if not found then raise exception 'User profile not found'; end if;
  insert into public.audit_logs (user_id, user_email, action, target, metadata)
  select auth.uid(), email, 'updated_user_status', target_user_id::text,
    jsonb_build_object('status', target_status) from public.profiles where id = auth.uid();
  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.set_user_role(target_user_id uuid, target_role text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Unauthorized: Admin role required'; end if;
  if target_role not in ('user', 'admin') then raise exception 'Invalid user role'; end if;
  if target_user_id = auth.uid() and target_role <> 'admin' then raise exception 'Administrators cannot demote themselves'; end if;
  if target_role = 'user'
     and exists (select 1 from public.profiles where id = target_user_id and role = 'admin'::public.user_role)
     and (select count(*) from public.profiles where role = 'admin'::public.user_role) <= 1 then
    raise exception 'Cannot demote the last administrator';
  end if;

  update public.profiles
  set role = target_role::public.user_role,
      preset_avatar = case when target_role = 'admin' then 'shield' else preset_avatar end,
      updated_at = now()
  where id = target_user_id;
  if not found then raise exception 'User profile not found'; end if;
  insert into public.audit_logs (user_id, user_email, action, target, metadata)
  select auth.uid(), email, 'updated_user_role', target_user_id::text,
    jsonb_build_object('role', target_role) from public.profiles where id = auth.uid();
  return jsonb_build_object('success', true);
end;
$$;

-- Security-definer functions are callable only by authenticated users and keep
-- their own is_admin() checks as the authoritative authorization decision.
revoke all on function public.get_platform_stats() from public, anon;
grant execute on function public.get_platform_stats() to authenticated;
revoke all on function public.set_user_status(uuid, text) from public, anon;
grant execute on function public.set_user_status(uuid, text) to authenticated;
revoke all on function public.set_user_role(uuid, text) from public, anon;
grant execute on function public.set_user_role(uuid, text) to authenticated;
revoke all on function public.set_user_supporter_status(uuid, boolean) from public, anon;
grant execute on function public.set_user_supporter_status(uuid, boolean) to authenticated;
