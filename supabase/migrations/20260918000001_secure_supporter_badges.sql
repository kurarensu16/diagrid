-- Supporter badges require administrator verification.
-- Apply this migration to existing Supabase projects.

revoke update (is_supporter) on public.profiles from anon, authenticated;

create or replace function public.set_user_supporter_status(
  target_user_id uuid,
  target_is_supporter boolean
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Unauthorized: Admin role required';
  end if;

  update public.profiles
  set is_supporter = target_is_supporter,
      updated_at = now()
  where id = target_user_id;

  if not found then
    raise exception 'User profile not found';
  end if;

  return jsonb_build_object('success', true);
end;
$$;

revoke all on function public.set_user_supporter_status(uuid, boolean) from public;
grant execute on function public.set_user_supporter_status(uuid, boolean) to authenticated;
