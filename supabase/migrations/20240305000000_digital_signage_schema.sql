-- Create custom types for enums
create type public.user_role as enum ('owner', 'admin', 'editor', 'viewer');
create type public.screen_status as enum ('online', 'offline', 'unassigned');
create type public.screen_orientation as enum ('landscape', 'portrait');
create type public.content_type as enum (
  'image', 'video', 'audio', 'powerbi', 
  'url', 'webpage', 'html_snippet', 'dashboard'
);
create type public.push_event_type as enum (
  'play_sound', 'show_alert', 'override_content', 'reload', 'custom'
);

-- 1. organizations
create table public.organizations (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    slug text unique not null,
    created_at timestamptz default now() not null
);

-- 2. profiles
create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text,
    full_name text,
    avatar_url text,
    organization_id uuid references public.organizations(id) on delete set null,
    role public.user_role default 'viewer'::public.user_role,
    created_at timestamptz default now() not null
);

-- 3. locations
create table public.locations (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid references public.organizations(id) on delete cascade not null,
    name text not null,
    address text,
    city text,
    country text,
    timezone text,
    created_at timestamptz default now() not null
);

-- 4 & 6. screens and projects (handling circular dependency)
create table public.screens (
    id uuid primary key default gen_random_uuid(),
    display_key uuid unique,
    name text not null,
    location_id uuid references public.locations(id) on delete set null,
    organization_id uuid references public.organizations(id) on delete cascade not null,
    orientation public.screen_orientation default 'landscape',
    resolution character varying(50) default '1920x1080',
    status public.screen_status default 'unassigned',
    last_heartbeat timestamptz,
    created_at timestamptz default now() not null
    -- active_project_id will be added after projects table is created
);

-- 5. content_items
create table public.content_items (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid references public.organizations(id) on delete cascade not null,
    name text not null,
    type public.content_type not null,
    source_url text,
    file_path text,
    file_size bigint,
    thumbnail_url text,
    duration_seconds integer default 10,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz default now() not null
);

-- 6. projects
create table public.projects (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    screen_id uuid references public.screens(id) on delete cascade,
    organization_id uuid references public.organizations(id) on delete cascade not null,
    is_active boolean default false,
    settings jsonb default '{"transition_type": "fade", "default_duration": 10, "loop": true}'::jsonb,
    created_at timestamptz default now() not null
);

-- Now we can add active_project_id on screens
alter table public.screens 
add column active_project_id uuid references public.projects(id) on delete set null;

-- 7. playlist_items
create table public.playlist_items (
    id uuid primary key default gen_random_uuid(),
    project_id uuid references public.projects(id) on delete cascade not null,
    content_item_id uuid references public.content_items(id) on delete cascade not null,
    order_index integer not null,
    duration_override integer,
    transition_type character varying(50),
    settings jsonb default '{}'::jsonb,
    created_at timestamptz default now() not null
);

-- 8. schedules
create table public.schedules (
    id uuid primary key default gen_random_uuid(),
    project_id uuid references public.projects(id) on delete cascade not null,
    name text not null,
    start_time time,
    end_time time,
    days_of_week integer[] default '{0,1,2,3,4,5,6}'::integer[],
    start_date date,
    end_date date,
    priority integer default 0,
    is_active boolean default true,
    created_at timestamptz default now() not null
);

-- 9. push_events
create table public.push_events (
    id uuid primary key default gen_random_uuid(),
    screen_id uuid references public.screens(id) on delete cascade not null,
    event_type public.push_event_type not null,
    payload jsonb default '{}'::jsonb,
    created_by uuid references public.profiles(id) on delete set null,
    expires_at timestamptz,
    created_at timestamptz default now() not null
);

-- 10. screen_logs
create table public.screen_logs (
    id uuid primary key default gen_random_uuid(),
    screen_id uuid references public.screens(id) on delete cascade not null,
    event character varying(255) not null,
    details jsonb default '{}'::jsonb,
    created_at timestamptz default now() not null
);


-- ==============================================
-- TRIGGERS
-- ==============================================

-- 1. display_key auto-generation for screens
create or replace function public.set_display_key()
returns trigger
language plpgsql
as $$
begin
  if new.display_key is null then
    new.display_key = gen_random_uuid();
  end if;
  return new;
end;
$$;

create trigger tr_screens_display_key
before insert on public.screens
for each row
execute function public.set_display_key();

-- 2. Auth hook to auto-create profile
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, created_at)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    now()
  );
  return new;
end;
$$;

create trigger tr_on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();


-- ==============================================
-- INDEXES
-- ==============================================

create index idx_profiles_organization_id on public.profiles(organization_id);
create index idx_locations_organization_id on public.locations(organization_id);
create index idx_screens_organization_id on public.screens(organization_id);
create index idx_content_items_organization_id on public.content_items(organization_id);
create index idx_projects_organization_id on public.projects(organization_id);

create index idx_screens_display_key on public.screens(display_key);
create index idx_screens_location_id on public.screens(location_id);
create index idx_projects_screen_id on public.projects(screen_id);
create index idx_playlist_items_project_order on public.playlist_items(project_id, order_index);


-- ==============================================
-- ROW LEVEL SECURITY (RLS)
-- ==============================================

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.locations enable row level security;
alter table public.screens enable row level security;
alter table public.content_items enable row level security;
alter table public.projects enable row level security;
alter table public.playlist_items enable row level security;
alter table public.schedules enable row level security;
alter table public.push_events enable row level security;
alter table public.screen_logs enable row level security;

-- Utility function to easily get the authenticated user's organization
create or replace function public.get_auth_user_organization_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid() limit 1;
$$;

-- organizations
create policy "Users can read their own organization"
on public.organizations for select
to authenticated
using (id = public.get_auth_user_organization_id());

-- profiles
create policy "Users can read profiles in their organization"
on public.profiles for select
to authenticated
using (
  id = auth.uid() or -- Users can always read their own profile
  organization_id = public.get_auth_user_organization_id()
);

create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using (id = auth.uid());

-- locations
create policy "Users can access their organization locations"
on public.locations for all
to authenticated
using (organization_id = public.get_auth_user_organization_id())
with check (organization_id = public.get_auth_user_organization_id());

-- screens
create policy "Users can access their organization screens"
on public.screens for all
to authenticated
using (organization_id = public.get_auth_user_organization_id())
with check (organization_id = public.get_auth_user_organization_id());

-- content_items
create policy "Users can access their organization content items"
on public.content_items for all
to authenticated
using (organization_id = public.get_auth_user_organization_id())
with check (organization_id = public.get_auth_user_organization_id());

-- projects
create policy "Users can access their organization projects"
on public.projects for all
to authenticated
using (organization_id = public.get_auth_user_organization_id())
with check (organization_id = public.get_auth_user_organization_id());

-- playlist_items
create policy "Users can access playlist items for their organization projects"
on public.playlist_items for all
to authenticated
using (
  project_id in (
    select id from public.projects where organization_id = public.get_auth_user_organization_id()
  )
)
with check (
  project_id in (
    select id from public.projects where organization_id = public.get_auth_user_organization_id()
  )
);

-- schedules
create policy "Users can access schedules for their organization projects"
on public.schedules for all
to authenticated
using (
  project_id in (
    select id from public.projects where organization_id = public.get_auth_user_organization_id()
  )
)
with check (
  project_id in (
    select id from public.projects where organization_id = public.get_auth_user_organization_id()
  )
);

-- push_events
create policy "Users can access push events for their organization screens"
on public.push_events for all
to authenticated
using (
  screen_id in (
    select id from public.screens where organization_id = public.get_auth_user_organization_id()
  )
)
with check (
  screen_id in (
    select id from public.screens where organization_id = public.get_auth_user_organization_id()
  )
);

-- screen_logs
create policy "Users can access screen logs for their organization screens"
on public.screen_logs for all
to authenticated
using (
  screen_id in (
    select id from public.screens where organization_id = public.get_auth_user_organization_id()
  )
)
with check (
  screen_id in (
    select id from public.screens where organization_id = public.get_auth_user_organization_id()
  )
);

-- ==============================================
-- SUPABASE REALTIME
-- ==============================================

-- Create publication if it doesn't already exist (often pre-configured by Supabase)
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end
$$;

-- Add required tables to realtime publication
-- Dropping then adding them to handle cases where they might already exist
alter publication supabase_realtime add table public.screens;
alter publication supabase_realtime add table public.projects;
alter publication supabase_realtime add table public.playlist_items;
alter publication supabase_realtime add table public.push_events;
