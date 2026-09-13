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

insert into storage.buckets (id, name, public) 
values ('feedback-attachments', 'feedback-attachments', true)
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

drop policy if exists "Public view feedback attachments" on storage.objects;
create policy "Public view feedback attachments"
  on storage.objects for select
  using (bucket_id = 'feedback-attachments');

drop policy if exists "Anyone upload feedback attachments" on storage.objects;
create policy "Anyone upload feedback attachments"
  on storage.objects for insert
  with check (bucket_id = 'feedback-attachments');

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

drop policy if exists "Anyone can insert feedback" on public.feedback;
create policy "Anyone can insert feedback"
  on public.feedback for insert
  with check (true);

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
create policy "Anyone authenticated can insert audit logs"
  on public.audit_logs for insert
  with check (true);

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

  update public.profiles
  set status = target_status,
      updated_at = now()
  where id = target_user_id;

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

  update public.profiles
  set role = target_role::user_role,
      preset_avatar = case when target_role = 'admin' then 'shield' else preset_avatar end,
      updated_at = now()
  where id = target_user_id;

  return jsonb_build_object('success', true);
end;
$$;

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
create policy "Authenticated and anonymous users can insert audit logs"
  on public.audit_logs for insert
  with check (true);

drop policy if exists "Admins can delete/prune audit logs" on public.audit_logs;
create policy "Admins can delete/prune audit logs"
  on public.audit_logs for delete
  using (public.is_admin());

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
values ('feedback-attachments', 'feedback-attachments', true)
on conflict (id) do update set public = true;

-- Storage bucket RLS policies for feedback-attachments
drop policy if exists "Public Access for Feedback Attachments" on storage.objects;
create policy "Public Access for Feedback Attachments"
  on storage.objects for select
  using (bucket_id = 'feedback-attachments');

drop policy if exists "Anyone can upload feedback attachments" on storage.objects;
create policy "Anyone can upload feedback attachments"
  on storage.objects for insert
  with check (bucket_id = 'feedback-attachments');

drop policy if exists "Admins can manage feedback attachments" on storage.objects;
create policy "Admins can manage feedback attachments"
  on storage.objects for all
  using (bucket_id = 'feedback-attachments' and public.is_admin());

