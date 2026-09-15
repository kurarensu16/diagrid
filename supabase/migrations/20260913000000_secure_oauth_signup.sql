-- Apply to an existing Supabase project before enabling social sign-in.
drop policy if exists "Enable insert for profiles" on public.profiles;
revoke insert, update on public.profiles from anon, authenticated;
grant update (name, avatar_type, preset_avatar, avatar_url, bio, theme)
  on public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  default_name text;
begin
  if new.raw_user_meta_data is not null and (new.raw_user_meta_data->>'name') is not null then
    default_name := new.raw_user_meta_data->>'name';
  elsif new.email is not null then
    default_name := initcap(split_part(new.email, '@', 1));
  else
    default_name := 'User';
  end if;

  insert into public.profiles (id, email, name, role, avatar_type, preset_avatar)
  values (
    new.id, coalesce(new.email, ''), default_name,
    'user'::public.user_role, 'preset'::public.avatar_type, 'terminal'
  )
  on conflict (id) do update
  set email = excluded.email,
      name = coalesce(public.profiles.name, excluded.name);

  return new;
exception when others then
  raise warning 'Diagrid handle_new_user warning: %', SQLERRM;
  return new;
end;
$$;

revoke execute on function public.promote_user_to_admin(text)
  from public, anon, authenticated;
