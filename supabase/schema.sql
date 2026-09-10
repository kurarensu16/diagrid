-- ==============================================================================
-- DIAGRID: DATABASE INITIALIZATION & AUTHENTICATION MIGRATION
-- Execute this script in the Supabase SQL Editor (https://app.supabase.com)
-- ==============================================================================

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 2. ENUMS
do $$ begin
  create type user_role as enum ('user', 'admin');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type avatar_type as enum ('preset', 'custom', 'initials');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type ui_theme as enum ('blueprint', 'dark', 'light');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type diagram_type as enum (
    'erd',
    'flowchart',
    'sequence',
    'class',
    'gantt',
    'dfd',
    'usecase',
    'activity'
  );
exception
  when duplicate_object then null;
end $$;

-- 3. PROFILES TABLE (Linked to auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null unique,
  name text,
  role user_role default 'user'::user_role not null,
  avatar_type avatar_type default 'preset'::avatar_type not null,
  preset_avatar text default 'terminal' not null,
  avatar_url text,
  bio text,
  theme ui_theme default 'blueprint'::ui_theme not null,
  default_notation diagram_type default 'erd'::diagram_type not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_profiles_email on public.profiles(email);
create index if not exists idx_profiles_role on public.profiles(role);

-- 4. ENABLE ROW LEVEL SECURITY
alter table public.profiles enable row level security;

-- 5. RLS POLICIES FOR PROFILES
-- Security definer helper to check admin role without RLS recursion
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'::public.user_role
  );
$$;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles for select
  using (
    auth.uid() = id or public.is_admin()
  );

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (
    auth.uid() = id or public.is_admin()
  );

drop policy if exists "Admins can insert or delete profiles" on public.profiles;
drop policy if exists "Enable insert for profiles" on public.profiles;
create policy "Enable insert for profiles"
  on public.profiles for insert
  with check (true);

drop policy if exists "Admins can delete profiles" on public.profiles;
create policy "Admins can delete profiles"
  on public.profiles for delete
  using (public.is_admin());

-- 6. AUTOMATIC PROFILE CREATION TRIGGER ON SIGNUP
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  default_name text;
  assigned_role public.user_role;
  raw_role text;
begin
  -- 1. Derive default name from raw_user_meta_data or email prefix
  if new.raw_user_meta_data is not null and (new.raw_user_meta_data->>'name') is not null then
    default_name := new.raw_user_meta_data->>'name';
  elsif new.email is not null then
    default_name := initcap(split_part(new.email, '@', 1));
  else
    default_name := 'User';
  end if;

  -- 2. Determine role: any email containing 'admin' or 'superadmin' defaults to admin
  if new.email is not null and (
    new.email = 'admin@diagrid.dev' or 
    lower(new.email) ilike '%admin%' or 
    lower(new.email) ilike '%superadmin%'
  ) then
    assigned_role := 'admin'::public.user_role;
  else
    raw_role := case when new.raw_user_meta_data is not null then new.raw_user_meta_data->>'role' else null end;
    if raw_role = 'admin' then
      assigned_role := 'admin'::public.user_role;
    else
      assigned_role := 'user'::public.user_role;
    end if;
  end if;

  -- 3. Insert profile record
  insert into public.profiles (
    id,
    email,
    name,
    role,
    avatar_type,
    preset_avatar
  ) values (
    new.id,
    coalesce(new.email, ''),
    default_name,
    assigned_role,
    'preset'::public.avatar_type,
    case when assigned_role = 'admin'::public.user_role then 'shield' else 'terminal' end
  )
  on conflict (id) do update
  set 
    email = excluded.email,
    name = coalesce(public.profiles.name, excluded.name),
    role = case when public.profiles.role = 'admin'::public.user_role then 'admin'::public.user_role else excluded.role end;

  return new;
exception when others then
  -- Fail-safe: log warning and allow auth user creation to succeed
  raise warning 'Diagrid handle_new_user warning: %', SQLERRM;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 7. AUTOMATIC TIMESTAMP UPDATER
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_profiles_updated_at on public.profiles;
create trigger trigger_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- 8. STORAGE BUCKETS CONFIGURATION (Avatars & Diagram Thumbnails)
insert into storage.buckets (id, name, public) 
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public) 
values ('thumbnails', 'thumbnails', true)
on conflict (id) do nothing;

-- Storage Policies
drop policy if exists "Public view avatars" on storage.objects;
create policy "Public view avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Users upload own avatar" on storage.objects;
create policy "Users upload own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars' and 
    auth.uid() = (storage.foldername(name))[1]::uuid
  );

drop policy if exists "Public view thumbnails" on storage.objects;
create policy "Public view thumbnails"
  on storage.objects for select
  using (bucket_id = 'thumbnails');

drop policy if exists "Users upload thumbnails" on storage.objects;
create policy "Users upload thumbnails"
  on storage.objects for insert
  with check (bucket_id = 'thumbnails' and auth.uid() is not null);

-- ==============================================================================
-- 9. ADMIN PROMOTION UTILITY FUNCTION
-- ==============================================================================

create or replace function public.promote_user_to_admin(target_email text)
returns text as $$
declare
  updated_count int;
begin
  update public.profiles
  set role = 'admin'::user_role,
      preset_avatar = 'shield'
  where lower(email) = lower(trim(target_email));

  get diagnostics updated_count = row_count;
  if updated_count > 0 then
    return 'Success: User ' || target_email || ' is now an ADMIN.';
  else
    return 'Notice: No profile found matching ' || target_email || '. Register the account first, then run this.';
  end if;
end;
$$ language plpgsql security definer;

-- ==============================================================================
-- 10. PROJECTS TABLE (Workspaces)
-- ==============================================================================

create table if not exists public.projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text default '' not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- Indexes
create index if not exists idx_projects_user_id on public.projects(user_id);
create index if not exists idx_projects_updated_at on public.projects(updated_at desc);

-- Enable RLS
alter table public.projects enable row level security;

-- Policies for projects
drop policy if exists "Users can view own projects" on public.projects;
create policy "Users can view own projects"
  on public.projects for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "Users can create own projects" on public.projects;
create policy "Users can create own projects"
  on public.projects for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own projects" on public.projects;
create policy "Users can update own projects"
  on public.projects for update
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "Users can delete own projects" on public.projects;
create policy "Users can delete own projects"
  on public.projects for delete
  using (auth.uid() = user_id or public.is_admin());

-- Auto-update timestamp trigger for projects
drop trigger if exists trigger_projects_updated_at on public.projects;
create trigger trigger_projects_updated_at
  before update on public.projects
  for each row execute procedure public.set_updated_at();

-- ==============================================================================
-- 11. DIAGRAMS TABLE (Visual Schematics)
-- ==============================================================================

create table if not exists public.diagrams (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  type diagram_type not null default 'erd'::diagram_type,
  content jsonb default '{"nodes":[],"edges":[]}'::jsonb not null,
  thumbnail_url text,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- Indexes
create index if not exists idx_diagrams_project_id on public.diagrams(project_id);
create index if not exists idx_diagrams_user_id on public.diagrams(user_id);
create index if not exists idx_diagrams_updated_at on public.diagrams(updated_at desc);

-- Enable RLS
alter table public.diagrams enable row level security;

-- Policies for diagrams
drop policy if exists "Users can view own diagrams" on public.diagrams;
drop policy if exists "Public can view diagrams" on public.diagrams;
create policy "Public can view diagrams"
  on public.diagrams for select
  using (true);

drop policy if exists "Users can create own diagrams" on public.diagrams;
create policy "Users can create own diagrams"
  on public.diagrams for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own diagrams" on public.diagrams;
create policy "Users can update own diagrams"
  on public.diagrams for update
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "Users can delete own diagrams" on public.diagrams;
create policy "Users can delete own diagrams"
  on public.diagrams for delete
  using (auth.uid() = user_id or public.is_admin());

-- Auto-update timestamp trigger for diagrams
drop trigger if exists trigger_diagrams_updated_at on public.diagrams;
create trigger trigger_diagrams_updated_at
  before update on public.diagrams
  for each row execute procedure public.set_updated_at();

