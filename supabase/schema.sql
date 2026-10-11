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
    'blank',
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
  status text default 'active' not null,
  is_supporter boolean default false not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_profiles_email on public.profiles(email);
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_status on public.profiles(status);

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

-- The signup trigger owns inserts. Clients may update only non-privileged fields.
-- Supporter status is changed exclusively by the admin-only RPC below.
revoke insert, update on public.profiles from anon, authenticated;
grant update (name, avatar_type, preset_avatar, avatar_url, bio, theme)
  on public.profiles to authenticated;

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
  provider_avatar_url text;
begin
  -- 1. Derive default name from raw_user_meta_data or email prefix
  if new.raw_user_meta_data is not null and (new.raw_user_meta_data->>'name') is not null then
    default_name := new.raw_user_meta_data->>'name';
  elsif new.email is not null then
    default_name := initcap(split_part(new.email, '@', 1));
  else
    default_name := 'User';
  end if;

  provider_avatar_url := coalesce(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture'
  );

  -- New accounts always start as users. Promotion requires an admin operation.
  insert into public.profiles (
    id,
    email,
    name,
    role,
    avatar_type,
    preset_avatar,
    avatar_url
  ) values (
    new.id,
    coalesce(new.email, ''),
    default_name,
    'user'::public.user_role,
    case when provider_avatar_url is not null then 'custom'::public.avatar_type else 'preset'::public.avatar_type end,
    'terminal',
    provider_avatar_url
  )
  on conflict (id) do update
  set 
    email = excluded.email,
    name = coalesce(public.profiles.name, excluded.name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
    avatar_type = case when public.profiles.avatar_url is null and excluded.avatar_url is not null then 'custom'::public.avatar_type else public.profiles.avatar_type end,
    role = public.profiles.role;

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

insert into storage.buckets (id, name, public) 
values ('feedback-attachments', 'feedback-attachments', false)
on conflict (id) do nothing;

update storage.buckets
set file_size_limit = 2097152,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'avatars';

-- Storage Policies
drop policy if exists "Public view avatars" on storage.objects;
create policy "Public view avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Users upload own avatar" on storage.objects;
create policy "Users upload own avatar"
  on storage.objects for insert
  with check (
    public.is_active_user() and bucket_id = 'avatars' and
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

drop policy if exists "Public view feedback attachments" on storage.objects;
drop policy if exists "Anyone upload feedback attachments" on storage.objects;
drop policy if exists "Authenticated users upload own feedback attachments" on storage.objects;
create policy "Authenticated users upload own feedback attachments"
  on storage.objects for insert
  to authenticated
  with check (
    public.is_active_user()
    and bucket_id = 'feedback-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

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

revoke execute on function public.promote_user_to_admin(text) from public, anon, authenticated;

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
drop policy if exists "Active users can view own projects" on public.projects;
create policy "Active users can view own projects"
  on public.projects for select
  to authenticated
  using (public.is_active_user() and (auth.uid() = user_id or public.is_admin()));

drop policy if exists "Users can create own projects" on public.projects;
drop policy if exists "Active users can create own projects" on public.projects;
create policy "Active users can create own projects"
  on public.projects for insert
  to authenticated
  with check (public.is_active_user() and auth.uid() = user_id);

drop policy if exists "Users can update own projects" on public.projects;
drop policy if exists "Active users can update own projects" on public.projects;
create policy "Active users can update own projects"
  on public.projects for update
  to authenticated
  using (public.is_active_user() and (auth.uid() = user_id or public.is_admin()))
  with check (public.is_active_user() and (auth.uid() = user_id or public.is_admin()));

drop policy if exists "Users can delete own projects" on public.projects;
drop policy if exists "Active users can delete own projects" on public.projects;
create policy "Active users can delete own projects"
  on public.projects for delete
  to authenticated
  using (public.is_active_user() and (auth.uid() = user_id or public.is_admin()));

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

-- Coarse database limits protect direct API writes that bypass client validation.
-- NOT VALID preserves legacy rows while enforcing the constraint on new writes.
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

-- Enable RLS
alter table public.diagrams enable row level security;

-- Policies for diagrams
drop policy if exists "Users can view own diagrams" on public.diagrams;
drop policy if exists "Public can view diagrams" on public.diagrams;
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
create policy "Users can update own diagrams"
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
create policy "Users can delete own diagrams"
  on public.diagrams for delete
  to authenticated
  using (public.is_active_user() and (auth.uid() = user_id or public.is_admin()));

-- Auto-update timestamp trigger for diagrams
drop trigger if exists trigger_diagrams_updated_at on public.diagrams;
create trigger trigger_diagrams_updated_at
  before update on public.diagrams
  for each row execute procedure public.set_updated_at();

-- ==============================================================================
-- 12. TEMPLATES TABLE (Hybrid Blueprint Library)
-- ==============================================================================

create table if not exists public.templates (
  id text primary key,
  title text not null,
  description text default '' not null,
  type diagram_type not null default 'erd'::diagram_type,
  content jsonb default '{"nodes":[],"edges":[]}'::jsonb not null,
  is_featured boolean default false not null,
  is_system boolean default true not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- Indexes
create index if not exists idx_templates_type on public.templates(type);
create index if not exists idx_templates_featured on public.templates(is_featured);

-- Enable RLS
alter table public.templates enable row level security;

-- Policies for templates (Public can view, Admins can modify)
drop policy if exists "Public can view templates" on public.templates;
create policy "Public can view templates"
  on public.templates for select
  using (true);

drop policy if exists "Admins can insert templates" on public.templates;
create policy "Admins can insert templates"
  on public.templates for insert
  with check (public.is_admin());

drop policy if exists "Admins can update templates" on public.templates;
create policy "Admins can update templates"
  on public.templates for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete templates" on public.templates;
create policy "Admins can delete templates"
  on public.templates for delete
  using (public.is_admin());

-- Auto-update timestamp trigger for templates
drop trigger if exists trigger_templates_updated_at on public.templates;
create trigger trigger_templates_updated_at
  before update on public.templates
  for each row execute procedure public.set_updated_at();

-- Seed starter blueprints into public.templates (Idempotent)
insert into public.templates (id, title, description, type, is_featured, is_system, content)
values
  ('t-erd', 'Starter ERD Schema', 'Relational database schema mapping Users, Projects, and Diagrams with PK/FK column attributes.', 'erd', true, true, 
   '{"nodes":[{"id":"n-users","type":"table","label":"users","x":60,"y":40,"fields":["id uuid pk","email text","created_at timestamptz"]},{"id":"n-projects","type":"table","label":"projects","x":60,"y":220,"fields":["id uuid pk","user_id uuid fk","name text"]},{"id":"n-diagrams","type":"table","label":"diagrams","x":360,"y":40,"fields":["id uuid pk","project_id uuid fk","title text","content text"]}],"edges":[{"id":"e-1","source":"n-users","target":"n-projects","sourceHandle":"bottom","targetHandle":"top","label":"1:N","sourceMarker":"one","targetMarker":"many"},{"id":"e-2","source":"n-projects","target":"n-diagrams","sourceHandle":"right","targetHandle":"left","label":"1:N","sourceMarker":"one","targetMarker":"many"}]}'::jsonb),
  
  ('t-flowchart', 'Starter Flowchart Workflow', '5-step workflow tracking start terminal, request action, decision branching, and terminal states.', 'flowchart', true, true,
   '{"nodes":[{"id":"n-start","type":"terminal","label":"Start Flow","x":190,"y":40},{"id":"n-drag","type":"process","label":"Submit Request","x":180,"y":130},{"id":"n-decision","type":"decision","label":"Is Valid?","x":205,"y":230},{"id":"n-success","type":"process","label":"Process Success","x":80,"y":350},{"id":"n-end","type":"terminal","label":"Complete","x":320,"y":350}],"edges":[{"id":"e-1","source":"n-start","target":"n-drag","sourceHandle":"bottom","targetHandle":"top"},{"id":"e-2","source":"n-drag","target":"n-decision","sourceHandle":"bottom","targetHandle":"top"},{"id":"e-3","source":"n-decision","target":"n-success","sourceHandle":"left","targetHandle":"top","label":"yes"},{"id":"e-4","source":"n-decision","target":"n-end","sourceHandle":"right","targetHandle":"top","label":"no"}]}'::jsonb),

  ('t-sequence', 'Starter Sequence Interaction', 'Message sequence tracing requests across Client App, API Gateway, and Database Server with lifeline activations.', 'sequence', false, true,
   '{"nodes":[{"id":"n-client","type":"process","label":"Client App","x":60,"y":40},{"id":"n-gateway","type":"process","label":"API Gateway","x":280,"y":40},{"id":"n-db","type":"process","label":"Database Server","x":500,"y":40},{"id":"act-client-1","type":"sequence-activation","label":"","x":120,"y":120},{"id":"act-gateway-1","type":"sequence-activation","label":"","x":340,"y":140},{"id":"act-db","type":"sequence-activation","label":"","x":560,"y":180},{"id":"act-gateway-2","type":"sequence-activation","label":"","x":340,"y":260},{"id":"act-client-2","type":"sequence-activation","label":"","x":120,"y":290}],"edges":[{"id":"e-seq-1","source":"act-client-1","target":"act-gateway-1","sourceHandle":"right","targetHandle":"left","label":"GET /records"},{"id":"e-seq-2","source":"act-gateway-1","target":"act-db","sourceHandle":"right","targetHandle":"left","label":"SELECT * FROM tbl"},{"id":"e-seq-3","source":"act-db","target":"act-gateway-2","sourceHandle":"left","targetHandle":"right","label":"result_data","style":"dashed"},{"id":"e-seq-4","source":"act-gateway-2","target":"act-client-2","sourceHandle":"left","targetHandle":"right","label":"200 OK (JSON)","style":"dashed"}]}'::jsonb),

  ('t-class', 'Starter Class Diagram', 'Clean architecture model showing UserController, UserService, and UserEntity with method signatures.', 'class', false, true,
   '{"nodes":[{"id":"n-c1","type":"table","label":"UserController","x":60,"y":40,"fields":["+String route","+handleRequest()","+sendResponse()"]},{"id":"n-c2","type":"table","label":"UserService","x":320,"y":40,"fields":["+User findById()","+saveUser()","+validateToken()"]},{"id":"n-c3","type":"table","label":"UserEntity","x":580,"y":40,"fields":["-UUID id","-String email","-String role","+getEmail()"]}],"edges":[{"id":"e-1","source":"n-c1","target":"n-c2","sourceHandle":"right","targetHandle":"left","label":"delegates"},{"id":"e-2","source":"n-c2","target":"n-c3","sourceHandle":"right","targetHandle":"left","label":"manages"}]}'::jsonb),

  ('t-gantt', 'Starter Gantt Project Timeline', 'Project release roadmap tracking Specifications, Core Engineering, and QA/Deployment milestone dependencies.', 'gantt', false, true,
   '{"nodes":[{"id":"n-g1","type":"process","label":"Phase 1: Specifications & Design","x":60,"y":60},{"id":"n-g2","type":"process","label":"Phase 2: Core Engineering","x":260,"y":140},{"id":"n-g3","type":"process","label":"Phase 3: QA & Deployment","x":460,"y":220}],"edges":[{"id":"e-1","source":"n-g1","target":"n-g2","sourceHandle":"right","targetHandle":"left","label":"pre-req"},{"id":"e-2","source":"n-g2","target":"n-g3","sourceHandle":"right","targetHandle":"left","label":"hand-off"}]}'::jsonb),

  ('t-dfd', 'Starter Data Flow Diagram (DFD)', 'Standard Level-1 Data Flow Diagram (Gane-Sarson) with Entities, Process ID headers, and Stores.', 'dfd', true, true,
   '{"nodes":[{"id":"dfd-n1","type":"dfd-entity","label":"Customer","x":40,"y":70},{"id":"dfd-n2","type":"dfd-process","label":"1.0 Process Order","x":260,"y":50},{"id":"dfd-n3","type":"dfd-entity","label":"Payment Gateway","x":520,"y":70},{"id":"dfd-s1","type":"dfd-store","label":"Orders Store","x":260,"y":160},{"id":"dfd-n4","type":"dfd-process","label":"2.0 Generate Invoice","x":260,"y":260},{"id":"dfd-s2","type":"dfd-store","label":"Users Database","x":40,"y":260}],"edges":[{"id":"dfd-e1","source":"dfd-n1","target":"dfd-n2","sourceHandle":"right","targetHandle":"left","label":"Order Request"},{"id":"dfd-e2","source":"dfd-n2","target":"dfd-s1","sourceHandle":"bottom","targetHandle":"top","label":"Save Record"},{"id":"dfd-e3","source":"dfd-n2","target":"dfd-n3","sourceHandle":"right","targetHandle":"left","label":"Payment Request"},{"id":"dfd-e4","source":"dfd-n3","target":"dfd-n4","sourceHandle":"bottom","targetHandle":"right","label":"Payment Receipt"},{"id":"dfd-e5","source":"dfd-s2","target":"dfd-n4","sourceHandle":"right","targetHandle":"left","label":"User Profile"},{"id":"dfd-e6","source":"dfd-n4","target":"dfd-n1","sourceHandle":"left","targetHandle":"bottom","label":"Invoice PDF","style":"dashed"}]}'::jsonb),

  ('t-usecase', 'Starter Use Case Diagram', 'UML Use Case model showing System Boundary with Customer & Administrator actors linked to functional goals.', 'usecase', false, true,
   '{"nodes":[{"id":"uc-n2","type":"usecase-boundary","label":"System Platform","x":160,"y":30},{"id":"uc-n1","type":"usecase-actor","label":"Customer","x":40,"y":70},{"id":"uc-admin","type":"usecase-actor","label":"Administrator","x":40,"y":220},{"id":"uc-n3","type":"usecase-oval","label":"Authenticate User","x":210,"y":60},{"id":"uc-n4","type":"usecase-oval","label":"Place Order","x":210,"y":140},{"id":"uc-n5","type":"usecase-oval","label":"View Reports","x":210,"y":220}],"edges":[{"id":"uc-e1","source":"uc-n1","target":"uc-n3","sourceHandle":"right","targetHandle":"left"},{"id":"uc-e2","source":"uc-n1","target":"uc-n4","sourceHandle":"right","targetHandle":"left"},{"id":"uc-e3","source":"uc-admin","target":"uc-n3","sourceHandle":"right","targetHandle":"left"},{"id":"uc-e4","source":"uc-admin","target":"uc-n5","sourceHandle":"right","targetHandle":"left"}]}'::jsonb),

  ('t-activity', 'Starter Activity Diagram', 'Concurrent UML activity workflow with initial node (●), decision diamond, parallel fork/join synchronization, and final node (◉).', 'activity', true, true,
   '{"nodes":[{"id":"act-start","type":"activity-start","label":"","x":214,"y":20},{"id":"act-receive","type":"activity-action","label":"Receive Request","x":155,"y":70},{"id":"act-check","type":"activity-decision","label":"Is Valid?","x":185,"y":150},{"id":"act-error","type":"activity-action","label":"Show Error Message","x":380,"y":174},{"id":"act-fork","type":"activity-fork","label":"","x":130,"y":275},{"id":"act-process","type":"activity-action","label":"Process Payment","x":60,"y":320},{"id":"act-audit","type":"activity-action","label":"Log Audit Trail","x":270,"y":320},{"id":"act-join","type":"activity-fork","label":"","x":130,"y":405},{"id":"act-notify","type":"activity-action","label":"Send Confirmation","x":155,"y":440},{"id":"act-end","type":"activity-end","label":"","x":212,"y":520}],"edges":[{"id":"act-e1","source":"act-start","target":"act-receive","sourceHandle":"bottom","targetHandle":"top"},{"id":"act-e2","source":"act-receive","target":"act-check","sourceHandle":"bottom","targetHandle":"top"},{"id":"act-e3","source":"act-check","target":"act-fork","sourceHandle":"bottom","targetHandle":"top","label":"[valid]"},{"id":"act-e4","source":"act-check","target":"act-error","sourceHandle":"right","targetHandle":"left","label":"[invalid]"},{"id":"act-e5","source":"act-error","target":"act-receive","sourceHandle":"top","targetHandle":"right","label":"retry","style":"dashed"},{"id":"act-e6","source":"act-fork","target":"act-process","sourceHandle":"bottom","targetHandle":"top"},{"id":"act-e7","source":"act-fork","target":"act-audit","sourceHandle":"bottom","targetHandle":"top"},{"id":"act-e8","source":"act-process","target":"act-join","sourceHandle":"bottom","targetHandle":"top"},{"id":"act-e9","source":"act-audit","target":"act-join","sourceHandle":"bottom","targetHandle":"top"},{"id":"act-e10","source":"act-join","target":"act-notify","sourceHandle":"bottom","targetHandle":"top"},{"id":"act-e11","source":"act-notify","target":"act-end","sourceHandle":"bottom","targetHandle":"top"}]}'::jsonb)
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  type = excluded.type,
  content = excluded.content,
  is_featured = excluded.is_featured,
  is_system = excluded.is_system;

-- ==============================================================================
-- 13. FEEDBACK TABLE (User Feedback & Bug Reports)
-- ==============================================================================

create table if not exists public.feedback (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete set null,
  user_email text not null,
  type text not null default 'general',
  rating int not null default 5,
  rating_label text,
  message text not null,
  page_url text,
  client_metadata jsonb default '{}'::jsonb,
  attachment_url text,
  priority text not null default 'medium',
  admin_notes text not null default '',
  status text not null default 'new',
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_feedback_status on public.feedback(status);
create index if not exists idx_feedback_priority on public.feedback(priority);
create index if not exists idx_feedback_created_at on public.feedback(created_at desc);

alter table public.feedback enable row level security;

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

drop policy if exists "Admins can view feedback" on public.feedback;
create policy "Admins can view feedback"
  on public.feedback for select
  using (public.is_admin());

drop policy if exists "Admins can update feedback" on public.feedback;
create policy "Admins can update feedback"
  on public.feedback for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete feedback" on public.feedback;
create policy "Admins can delete feedback"
  on public.feedback for delete
  using (public.is_admin());

-- Auto-update timestamp trigger for feedback
drop trigger if exists trigger_feedback_updated_at on public.feedback;
create trigger trigger_feedback_updated_at
  before update on public.feedback
  for each row execute procedure public.set_updated_at();

-- ==============================================================================
-- 14. AUDIT LOGS TABLE (Platform Activity & Auditing)
-- ==============================================================================

create table if not exists public.audit_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete set null,
  user_email text not null,
  action text not null,
  target text not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);
create index if not exists idx_audit_logs_user_email on public.audit_logs(user_email);

alter table public.audit_logs enable row level security;

drop policy if exists "Anyone authenticated can insert audit logs" on public.audit_logs;
revoke insert on public.audit_logs from anon, authenticated;

drop policy if exists "Admins can view audit logs" on public.audit_logs;
create policy "Admins can view audit logs"
  on public.audit_logs for select
  using (public.is_admin());

drop policy if exists "Admins can delete audit logs" on public.audit_logs;
create policy "Admins can delete audit logs"
  on public.audit_logs for delete
  using (public.is_admin());

-- ==============================================================================
-- 15. ADMIN BACKEND RPC FUNCTIONS
-- ==============================================================================

-- Aggregated Platform Metrics for Admin Dashboard
create or replace function public.get_platform_stats()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  total_users int;
  active_users_24h int;
  total_projects int;
  total_diagrams int;
  diagrams_by_type jsonb;
  signups_last_7_days int[];
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Unauthorized: Admin role required';
  end if;

  -- Total users
  select count(*) into total_users from public.profiles;

  -- Active users in last 24h
  select count(*) into active_users_24h from public.profiles
  where updated_at >= now() - interval '24 hours';

  -- Total projects
  select count(*) into total_projects from public.projects;

  -- Total diagrams
  select count(*) into total_diagrams from public.diagrams;

  -- Diagrams grouped by type
  select coalesce(jsonb_object_agg(type, count), '{}'::jsonb)
  into diagrams_by_type
  from (
    select type::text, count(*) as count
    from public.diagrams
    group by type
  ) t;

  -- Signups over last 7 days (array of 7 counts)
  select array_agg(coalesce(c, 0) order by d)
  into signups_last_7_days
  from (
    select gs::date as d, count(p.id) as c
    from generate_series(current_date - interval '6 days', current_date, interval '1 day') gs
    left join public.profiles p on p.created_at::date = gs::date
    group by gs::date
  ) s;

  result := jsonb_build_object(
    'total_users', coalesce(total_users, 0),
    'active_users_24h', coalesce(active_users_24h, 0),
    'total_projects', coalesce(total_projects, 0),
    'total_diagrams', coalesce(total_diagrams, 0),
    'diagrams_by_type', coalesce(diagrams_by_type, '{}'::jsonb),
    'signups_last_7_days', coalesce(signups_last_7_days, array[0,0,0,0,0,0,0])
  );

  return result;
end;
$$;

-- Admin function to set user status (active / suspended)
create or replace function public.set_user_status(target_user_id uuid, target_status text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Unauthorized: Admin role required';
  end if;

  if target_status not in ('active', 'suspended') then
    raise exception 'Invalid user status';
  end if;
  if target_user_id = auth.uid() and target_status = 'suspended' then
    raise exception 'Administrators cannot suspend themselves';
  end if;
  if exists (select 1 from public.profiles where id = target_user_id and role = 'admin'::public.user_role) and target_status = 'suspended' then
    raise exception 'Administrator accounts cannot be suspended';
  end if;

  update public.profiles
  set status = target_status,
      updated_at = now()
  where id = target_user_id;

  if not found then raise exception 'User profile not found'; end if;

  return jsonb_build_object('success', true);
end;
$$;

-- Admin function to set user role (user / admin)
create or replace function public.set_user_role(target_user_id uuid, target_role text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Unauthorized: Admin role required';
  end if;

  if target_role not in ('user', 'admin') then
    raise exception 'Invalid user role';
  end if;
  if target_user_id = auth.uid() and target_role <> 'admin' then
    raise exception 'Administrators cannot demote themselves';
  end if;
  if target_role = 'user'
     and exists (select 1 from public.profiles where id = target_user_id and role = 'admin'::public.user_role)
     and (select count(*) from public.profiles where role = 'admin'::public.user_role) <= 1 then
    raise exception 'Cannot demote the last administrator';
  end if;

  update public.profiles
  set role = target_role::user_role,
      preset_avatar = case when target_role = 'admin' then 'shield' else preset_avatar end,
      updated_at = now()
  where id = target_user_id;

  if not found then raise exception 'User profile not found'; end if;

  return jsonb_build_object('success', true);
end;
$$;

-- Admin-only supporter badge management. Client-side claims are recorded as
-- feedback and must be reviewed before this function is called.
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

revoke all on function public.get_platform_stats() from public, anon;
grant execute on function public.get_platform_stats() to authenticated;
revoke all on function public.set_user_status(uuid, text) from public, anon;
grant execute on function public.set_user_status(uuid, text) to authenticated;
revoke all on function public.set_user_role(uuid, text) from public, anon;
grant execute on function public.set_user_role(uuid, text) to authenticated;

-- ==============================================================================
-- 15. AUDIT LOGS TABLE & TRIGGER AUTOMATION
-- ==============================================================================

create table if not exists public.audit_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete set null,
  user_email text not null,
  action text not null,
  target text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_audit_logs_user_email on public.audit_logs(user_email);
create index if not exists idx_audit_logs_action on public.audit_logs(action);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);

-- Enable RLS
alter table public.audit_logs enable row level security;

-- RLS Policies for audit_logs
drop policy if exists "Admins can view all audit logs" on public.audit_logs;
create policy "Admins can view all audit logs"
  on public.audit_logs for select
  using (public.is_admin());

drop policy if exists "Authenticated and anonymous users can insert audit logs" on public.audit_logs;
revoke insert on public.audit_logs from anon, authenticated;

drop policy if exists "Admins can delete/prune audit logs" on public.audit_logs;
create policy "Admins can delete/prune audit logs"
  on public.audit_logs for delete
  using (public.is_admin());

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

-- ==============================================================================
-- 16. SYSTEM SETTINGS & PLATFORM GOVERNANCE TABLE
-- ==============================================================================

create table if not exists public.system_settings (
  id text primary key default 'current',
  maintenance_mode boolean default false not null,
  registration_policy text default 'open' not null, -- 'open' | 'invite_only' | 'disabled'
  max_projects_per_user int default 10 not null,
  public_sharing boolean default true not null,
  pdf_export boolean default false not null,
  audit_retention_days int default 30 not null,
  creator_wallets_enabled boolean default true not null,
  creator_wallet_name text default 'GCash' not null,
  creator_wallet_account text default '0912 345 6789 (Diagrid Creator)' not null,
  creator_wallet_qr_url text default '' not null,
  creator_wallets jsonb default '[{"id":"w-1","name":"GCash","account_name":"Diagrid Creator","account_number":"0912 345 6789","qr_url":"","enabled":true},{"id":"w-2","name":"Maya","account_name":"Diagrid Creator","account_number":"0912 345 6789","qr_url":"","enabled":true}]'::jsonb not null,
  github_repo_url text default 'https://github.com/kurarensu16/diagrid' not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null,
  updated_by text default 'system' not null
);

-- Seed default settings row if not present
insert into public.system_settings (id, maintenance_mode, registration_policy, max_projects_per_user, public_sharing, pdf_export, audit_retention_days, creator_wallets_enabled, creator_wallet_name, creator_wallet_account, creator_wallets, github_repo_url)
values (
  'current', false, 'open', 10, true, false, 30, true, 'GCash', '0912 345 6789 (Diagrid Creator)',
  '[{"id":"w-1","name":"GCash","account_name":"Diagrid Creator","account_number":"0912 345 6789","qr_url":"","enabled":true},{"id":"w-2","name":"Maya","account_name":"Diagrid Creator","account_number":"0912 345 6789","qr_url":"","enabled":true}]'::jsonb,
  'https://github.com/kurarensu16/diagrid'
)
on conflict (id) do nothing;

-- Enable RLS
alter table public.system_settings enable row level security;

-- Policies
drop policy if exists "Anyone can read system settings" on public.system_settings;
create policy "Anyone can read system settings"
  on public.system_settings for select
  using (true);

drop policy if exists "Admins can update system settings" on public.system_settings;
create policy "Admins can update system settings"
  on public.system_settings for update
  using (public.is_admin());

drop policy if exists "Admins can insert system settings" on public.system_settings;
create policy "Admins can insert system settings"
  on public.system_settings for insert
  with check (public.is_admin());

-- ==============================================================================
-- 17. STORAGE BUCKETS CONFIGURATION (Feedback Attachments & Screenshots)
-- ==============================================================================

-- Create public bucket for feedback screenshot attachments if storage schema is accessible
insert into storage.buckets (id, name, public)
values ('feedback-attachments', 'feedback-attachments', false)
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- Storage bucket RLS policies for feedback-attachments
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

drop policy if exists "Admins can manage feedback attachments" on storage.objects;
create policy "Admins can manage feedback attachments"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'feedback-attachments' and public.is_admin());

-- FRE413 diagram analytics shared by React and Flutter.
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

