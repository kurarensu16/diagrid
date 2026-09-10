# Diagrid — Complete Backend Implementation Specification

> This document defines the end-to-end backend architecture, relational schema, security policies, API service interfaces, and deployment plan for **Diagrid**.

---

## Table of Contents

1. [Architectural Overview](#1-architectural-overview)
2. [Technology Stack](#2-technology-stack)
3. [Complete Database Schema (PostgreSQL DDL)](#3-complete-database-schema-postgresql-ddl)
   - [3.1 Extensions](#31-extensions)
   - [3.2 Enumerations](#32-enumerations)
   - [3.3 Tables & Constraints](#33-tables--constraints)
   - [3.4 Database Triggers & Automation](#34-database-triggers--automation)
4. [Row Level Security (RLS) & Authorization](#4-row-level-security-rls--authorization)
5. [Storage Buckets & Asset Management](#5-storage-buckets--asset-management)
6. [Frontend Service Integration Architecture](#6-frontend-service-integration-architecture)
   - [6.1 Auth Service (`authService.ts`)](#61-auth-service-authservicets)
   - [6.2 Project Service (`projectService.ts`)](#62-project-service-projectservicets)
   - [6.3 Diagram & Canvas Service (`diagramService.ts`)](#63-diagram--canvas-service-diagramservicets)
   - [6.4 Template Service (`templateService.ts`)](#64-template-service-templateservicets)
   - [6.5 Feedback & Telemetry Service (`adminService.ts`)](#65-feedback--telemetry-service-adminservicets)
7. [Realtime Synchronization & WebSockets](#7-realtime-synchronization--websockets)
8. [Phased Implementation Roadmap](#8-phased-implementation-roadmap)
9. [Local Development, Environment & Seed Data](#9-local-development-environment--seed-data)
10. [Security, Scalability & Performance Guidelines](#10-security-scalability--performance-guidelines)

---

## 1. Architectural Overview

Diagrid requires a backend that accommodates both **structured relational entity management** (users, projects, roles, permissions) and **high-throughput JSON document persistence** (coordinate-based canvas nodes, orthogonal edge routing, and freehand drawing paths).

```
+-----------------------------------------------------------------------------------+
|                                 Diagrid Client (SPA)                              |
+-----------------------------------------------------------------------------------+
                                         |
                       HTTPS / WSS (Supabase JS Client)
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                         Supabase Managed Backend (Postgres)                       |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  +---------------------------+  +----------------------------------------------+  |
|  |       Supabase Auth       |  |             PostgreSQL Database              |  |
|  |  - Email / Password       |  |  - public.profiles        - public.diagrams  |  |
|  |  - OAuth (GitHub/Google)  |  |  - public.projects        - public.templates |  |
|  |  - JWT token issuance     |  |  - public.feedback        - audit logs       |  |
|  +---------------------------+  +----------------------------------------------+  |
|                |                                       |                          |
|                +-------------------+-------------------+                          |
|                                    |                                              |
|                                    v                                              |
|  +-----------------------------------------------------------------------------+  |
|  |                 Row Level Security (RLS) & Policy Engine                    |  |
|  |  - User data isolation (auth.uid() = user_id)                               |  |
|  |  - Role-based Admin escalation (role = 'admin')                             |  |
|  |  - Public read-only diagram sharing tokens                                  |  |
|  +-----------------------------------------------------------------------------+  |
|                                    |                                              |
|  +---------------------------------+-------------------------------------------+  |
|  |       Supabase Realtime         |             Supabase Storage              |  |
|  |  - Multi-client canvas broadcast|  - avatars/ (user profile images)         |  |
|  |  - Live collaborator presence   |  - thumbnails/ (diagram previews)         |  |
|  +---------------------------------+-------------------------------------------+  |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

---

## 2. Technology Stack

- **Database Engine**: PostgreSQL 15+ (via Supabase)
- **Authentication**: Supabase Auth (GoTrue) with JWT bearer tokens
- **Data Access Layer**: Supabase JavaScript Client (`@supabase/supabase-js`)
- **Storage Layer**: Supabase Storage (S3-compatible bucket storage for image renders and avatars)
- **Realtime Layer**: PostgreSQL WAL (Write-Ahead Logging) change broadcasts over WebSockets
- **Local Fallback**: Pluggable LocalStorage adapter ensuring zero-downtime offline functionality when `.env` is unconfigured.

---

## 3. Complete Database Schema (PostgreSQL DDL)

### 3.1 Extensions
```sql
-- Enable necessary cryptographic and UUID extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
```

### 3.2 Enumerations
```sql
-- Diagram notation categories
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

-- User authorization roles
create type user_role as enum ('user', 'admin');

-- User avatar rendering modes
create type avatar_type as enum ('preset', 'custom', 'initials');

-- UI themes
create type ui_theme as enum ('blueprint', 'dark', 'light');

-- Feedback ticket lifecycle states
create type feedback_status as enum ('pending', 'in_progress', 'resolved', 'dismissed');

-- Feedback category classification
create type feedback_type as enum ('bug', 'feature', 'general');
```

---

### 3.3 Tables & Constraints

#### 1. `profiles` Table
Stores application-specific user profile metadata linked to `auth.users`.
```sql
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null unique,
  name text,
  role user_role default 'user' not null,
  avatar_type avatar_type default 'preset' not null,
  preset_avatar text default 'terminal' not null,
  avatar_url text,
  bio text,
  theme ui_theme default 'blueprint' not null,
  default_notation diagram_type default 'erd' not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create index idx_profiles_email on public.profiles(email);
create index idx_profiles_role on public.profiles(role);
```

#### 2. `projects` Table
Folders grouping diagrams within a user's workspace.
```sql
create table public.projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null check (char_length(trim(name)) > 0),
  description text default '' not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create index idx_projects_user_id on public.projects(user_id);
create index idx_projects_updated_at on public.projects(updated_at desc);
```

#### 3. `diagrams` Table
The primary canvas document containing node coordinates, edge links, and freehand drawing paths.
```sql
create table public.diagrams (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  title text not null check (char_length(trim(title)) > 0),
  type diagram_type not null,
  content jsonb default '{"nodes":[],"edges":[],"drawings":[]}'::jsonb not null,
  thumbnail_url text,
  is_public boolean default false not null,
  share_token text unique,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create index idx_diagrams_project_id on public.diagrams(project_id);
create index idx_diagrams_type on public.diagrams(type);
create index idx_diagrams_share_token on public.diagrams(share_token) where is_public = true;
create index idx_diagrams_updated_at on public.diagrams(updated_at desc);
```

#### 4. `templates` Table
Pre-built diagram starters accessible to all users.
```sql
create table public.templates (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text default '' not null,
  type diagram_type not null,
  category text not null check (category in ('data', 'logic', 'planning')),
  content jsonb not null,
  is_featured boolean default false not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create index idx_templates_type on public.templates(type);
create index idx_templates_category on public.templates(category);
```

#### 5. `feedback` Table
Direct user feedback, bug reports, and feature requests.
```sql
create table public.feedback (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete set null,
  user_email text not null,
  type feedback_type not null,
  message text not null check (char_length(trim(message)) > 3),
  status feedback_status default 'pending' not null,
  admin_notes text,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create index idx_feedback_status on public.feedback(status);
create index idx_feedback_created_at on public.feedback(created_at desc);
```

#### 6. `activity_logs` Table
Audit trail of user actions for telemetry, security, and administrative oversight.
```sql
create table public.activity_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  action text not null,
  details jsonb default '{}'::jsonb not null,
  ip_address text,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create index idx_activity_logs_user_id on public.activity_logs(user_id);
create index idx_activity_logs_created_at on public.activity_logs(created_at desc);
```

---

### 3.4 Database Triggers & Automation

#### Auto-create User Profile on Supabase Signup
```sql
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (
    id,
    email,
    name,
    role
  ) values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    case 
      when new.email = 'admin@diagrid.dev' then 'admin'::user_role
      else coalesce((new.raw_user_meta_data->>'role')::user_role, 'user'::user_role)
    end
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

#### Auto-update `updated_at` Timestamp
```sql
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

create trigger trigger_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

create trigger trigger_projects_updated_at
  before update on public.projects
  for each row execute procedure public.set_updated_at();

create trigger trigger_diagrams_updated_at
  before update on public.diagrams
  for each row execute procedure public.set_updated_at();

create trigger trigger_feedback_updated_at
  before update on public.feedback
  for each row execute procedure public.set_updated_at();
```

---

## 4. Row Level Security (RLS) & Authorization

Every table in `public` has Row Level Security strictly enforced.

```sql
-- Enable RLS across all tables
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.diagrams enable row level security;
alter table public.templates enable row level security;
alter table public.feedback enable row level security;
alter table public.activity_logs enable row level security;
```

### 4.1 Profiles RLS
```sql
-- Users can view their own profile; Admins can view all
create policy "profiles_select_policy"
  on public.profiles for select
  using (
    auth.uid() = id or 
    (select role from public.profiles where id = auth.uid()) = 'admin'
  );

-- Users can update their own profile; Admins can update any
create policy "profiles_update_policy"
  on public.profiles for update
  using (
    auth.uid() = id or 
    (select role from public.profiles where id = auth.uid()) = 'admin'
  );
```

### 4.2 Projects RLS
```sql
-- Users can view projects they own; Admins can view all
create policy "projects_select_policy"
  on public.projects for select
  using (
    auth.uid() = user_id or 
    (select role from public.profiles where id = auth.uid()) = 'admin'
  );

-- Users can insert projects owned by themselves
create policy "projects_insert_policy"
  on public.projects for insert
  with check (auth.uid() = user_id);

-- Users can update their own projects
create policy "projects_update_policy"
  on public.projects for update
  using (auth.uid() = user_id);

-- Users can delete their own projects
create policy "projects_delete_policy"
  on public.projects for delete
  using (auth.uid() = user_id);
```

### 4.3 Diagrams RLS
```sql
-- Users can view diagrams in their projects OR public diagrams via share token
create policy "diagrams_select_policy"
  on public.diagrams for select
  using (
    is_public = true or
    exists (
      select 1 from public.projects
      where projects.id = diagrams.project_id
      and (projects.user_id = auth.uid() or (select role from public.profiles where id = auth.uid()) = 'admin')
    )
  );

-- Users can create diagrams in projects they own
create policy "diagrams_insert_policy"
  on public.diagrams for insert
  with check (
    exists (
      select 1 from public.projects
      where projects.id = diagrams.project_id
      and projects.user_id = auth.uid()
    )
  );

-- Users can update diagrams in projects they own
create policy "diagrams_update_policy"
  on public.diagrams for update
  using (
    exists (
      select 1 from public.projects
      where projects.id = diagrams.project_id
      and projects.user_id = auth.uid()
    )
  );

-- Users can delete diagrams in projects they own
create policy "diagrams_delete_policy"
  on public.diagrams for delete
  using (
    exists (
      select 1 from public.projects
      where projects.id = diagrams.project_id
      and projects.user_id = auth.uid()
    )
  );
```

### 4.4 Templates RLS
```sql
-- Templates are publicly readable by everyone (even unauthenticated guests)
create policy "templates_read_all"
  on public.templates for select
  using (true);

-- Only admins can insert, update, or delete templates
create policy "templates_admin_write"
  on public.templates for all
  using ((select role from public.profiles where id = auth.uid()) = 'admin')
  with check ((select role from public.profiles where id = auth.uid()) = 'admin');
```

### 4.5 Feedback RLS
```sql
-- Authenticated users can insert feedback
create policy "feedback_insert_policy"
  on public.feedback for insert
  with check (auth.uid() is not null);

-- Users can view feedback they authored; Admins can view all
create policy "feedback_select_policy"
  on public.feedback for select
  using (
    auth.uid() = user_id or 
    (select role from public.profiles where id = auth.uid()) = 'admin'
  );

-- Only admins can modify feedback status or notes
create policy "feedback_admin_update"
  on public.feedback for update
  using ((select role from public.profiles where id = auth.uid()) = 'admin');
```

---

## 5. Storage Buckets & Asset Management

Supabase Storage manages user avatars and rendered canvas preview thumbnails.

```sql
-- Create storage buckets
insert into storage.buckets (id, name, public) 
values ('avatars', 'avatars', true)
on conflict do nothing;

insert into storage.buckets (id, name, public) 
values ('thumbnails', 'thumbnails', true)
on conflict do nothing;

-- Storage RLS: Anyone can view avatars and thumbnails
create policy "Public view avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Public view thumbnails"
  on storage.objects for select
  using (bucket_id = 'thumbnails');

-- Storage RLS: Users can upload their own avatar
create policy "Users can upload avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars' and 
    auth.uid() = (storage.foldername(name))[1]::uuid
  );

-- Storage RLS: Users can upload thumbnails for their diagrams
create policy "Users can upload thumbnails"
  on storage.objects for insert
  with check (bucket_id = 'thumbnails' and auth.uid() is not null);
```

---

## 6. Frontend Service Integration Architecture

To maintain a clean separation of concerns, frontend components interact with backend storage via strongly typed service modules.

### 6.1 Auth Service (`src/services/authService.ts`)
Unified interface for authentication:
```typescript
export interface AuthUser {
  id: string;
  email: string;
  role: 'user' | 'admin';
  name?: string;
  avatar?: string;
  avatarType?: 'preset' | 'custom' | 'initials';
  presetAvatar?: string;
  bio?: string;
  theme?: 'blueprint' | 'dark' | 'light';
  defaultNotation?: 'erd' | 'flowchart' | 'sequence';
}

export interface IAuthService {
  getUser(): Promise<AuthUser | null>;
  signUp(email: string, password: string, name?: string): Promise<{ user: AuthUser | null; error?: string }>;
  signIn(email: string, password: string): Promise<{ user: AuthUser | null; error?: string }>;
  signInWithOAuth(provider: 'google' | 'github'): Promise<{ error?: string }>;
  signOut(): Promise<void>;
  updateProfile(updates: Partial<AuthUser>): Promise<{ user: AuthUser | null; error?: string }>;
  onAuthStateChange(callback: (user: AuthUser | null) => void): () => void;
}
```

### 6.2 Project Service (`src/services/projectService.ts`)
```typescript
export interface IProjectService {
  getProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | null>;
  createProject(name: string, description?: string): Promise<Project>;
  updateProject(id: string, updates: Partial<Project>): Promise<Project>;
  deleteProject(id: string): Promise<void>;
}
```

### 6.3 Diagram & Canvas Service (`src/services/diagramService.ts`)
```typescript
export interface IDiagramService {
  getDiagramsByProject(projectId: string): Promise<Diagram[]>;
  getDiagram(id: string): Promise<Diagram | null>;
  createDiagram(projectId: string, title: string, type: DiagramType, content?: string): Promise<Diagram>;
  saveDiagramContent(id: string, content: string, thumbnailUrl?: string): Promise<void>;
  duplicateDiagram(id: string): Promise<Diagram>;
  deleteDiagram(id: string): Promise<void>;
  generateShareLink(id: string): Promise<string>;
}
```

### 6.4 Template Service (`src/services/templateService.ts`)
```typescript
export interface ITemplateService {
  getTemplates(): Promise<Template[]>;
  getTemplatesByCategory(category: 'data' | 'logic' | 'planning'): Promise<Template[]>;
  createDiagramFromTemplate(templateId: string, projectId: string, title?: string): Promise<Diagram>;
}
```

### 6.5 Feedback & Telemetry Service (`src/services/adminService.ts`)
```typescript
export interface IAdminService {
  getMetrics(): Promise<{ userCount: number; diagramCount: number; projectCount: number }>;
  getAllUsers(): Promise<Profile[]>;
  getFeedbackTickets(): Promise<Feedback[]>;
  updateFeedbackStatus(id: string, status: FeedbackStatus, notes?: string): Promise<void>;
  getActivityLogs(): Promise<ActivityLog[]>;
}
```

---

## 7. Realtime Synchronization & WebSockets

For collaborative diagram editing and real-time auto-saving across devices:

1. **Presence Tracking**:
   - Supabase Realtime Channels track collaborators on a diagram:
     ```typescript
     const room = supabase.channel(`diagram:${diagramId}`, {
       config: { presence: { key: currentUserId } },
     });
     room.on('presence', { event: 'sync' }, () => {
       const state = room.presenceState();
       // Update cursor positions and collaborator list on the canvas
     });
     ```
2. **Broadcast Channel for Node Movements**:
   - When a node is dragged, delta position payloads (`{ nodeId, x, y }`) are broadcast over WebSockets, bypassing database writes until `onMouseUp` (debounced commit to PostgreSQL).

---

## 8. Phased Implementation Roadmap

```
+-------------------------------------------------------------------------------+
|                        BACKEND IMPLEMENTATION ROADMAP                         |
+-------------------------------------------------------------------------------+

[PHASE 1: AUTHENTICATION FOUNDATION] (Immediate Step)
  1. Install @supabase/supabase-js
  2. Setup .env.example with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
  3. Create supabase.ts client and authService.ts adapter
  4. Implement SQL migration for profiles table, triggers, and RLS policies
  5. Connect Auth.tsx and Settings.tsx with fallback to offline mock mode

[PHASE 2: PROJECTS & WORKSPACE CRUD]
  1. Migrate Project entities from localStorage to public.projects
  2. Implement projectService.ts with real database queries
  3. Wire Dashboard.tsx and ProjectDetail.tsx with loading skeletons & errors

[PHASE 3: DIAGRAM CANVAS PERSISTENCE & AUTO-SAVE]
  1. Store CanvasNode[], CanvasEdge[], and FreehandDrawing[] as JSONB
  2. Implement debounced auto-save hook in Editor.tsx (300ms throttle)
  3. Wire thumbnail generation via HTML5 canvas blob upload to Supabase Storage

[PHASE 4: TEMPLATES & SEED PIPELINE]
  1. Migrate hardcoded SEEDS in mockDb.ts into public.templates table
  2. Seed default schemas for ERD, Flowchart, Sequence, DFD, Use Case, Activity
  3. Connect Templates.tsx to live templates query with offline cache

[PHASE 5: ADMIN TELEMETRY & FEEDBACK PIPELINE]
  1. Wire FeedbackModal.tsx to submit rows into public.feedback
  2. Connect AdminFeedback.tsx and AdminOverview.tsx to live admin queries
  3. Implement RLS check ensuring only role = 'admin' accesses admin routes

[PHASE 6: PUBLIC SHARING & REALTIME COLLABORATION]
  1. Implement share_token generator and public read-only route (/view/:token)
  2. Enable Supabase Realtime channels for live cursor & collaborator tracking
```

---

## 9. Local Development, Environment & Seed Data

### 9.1 Environment Configuration (`.env`)
```bash
# Supabase Project Credentials
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Optional: Local development flags
VITE_USE_MOCK_FALLBACK=true
```

### 9.2 Initial Admin Account Provisioning
When executing the SQL migrations in Supabase SQL Editor:
```sql
-- Automatically promote the designated admin email
insert into auth.users (id, email)
values ('00000000-0000-0000-0000-000000000001', 'admin@diagrid.dev')
on conflict do nothing;

update public.profiles
set role = 'admin'
where email = 'admin@diagrid.dev';
```

---

## 10. Security, Scalability & Performance Guidelines

1. **Payload Size Optimization**:
   - Large canvas nodes (`customWidth`, `customHeight`, fields) and drawings are compressed and serialized as JSONB.
   - Vector SVG exports and raster PNG generation occur **client-side in the browser** via `diagramExport.ts`, ensuring server compute stays near zero.
2. **Debounced Autosave**:
   - Direct node drags update React state at 60fps; database writes are debounced by 400ms after the user releases the mouse.
3. **Database Indexing**:
   - Foreign keys (`project_id`, `user_id`) and lookup tokens (`share_token`, `email`) are indexed with B-Trees.
4. **Offline Resilience**:
   - The application detects network disconnection or missing credentials and switches seamlessly to local `indexedDB` / `localStorage` caching, ensuring users never lose diagram work.
