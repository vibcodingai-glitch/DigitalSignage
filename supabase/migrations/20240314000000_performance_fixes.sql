-- PERFORMANCE FIX: Mark get_auth_user_organization_id() as STABLE
-- By default, language sql functions are VOLATILE, causing Postgres to
-- call them once per row during RLS policy evaluation. Marking as STABLE
-- allows Postgres to cache the result within a single query — turning
-- an N-row lookup into a single profile lookup per request.

create or replace function public.get_auth_user_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid() limit 1;
$$;

-- Add index on profiles(id) for faster org_id lookups (may already exist as PK)
-- Add index on screens(organization_id) for faster RLS filtering
create index if not exists idx_profiles_id_org on public.profiles(id, organization_id);
create index if not exists idx_screens_organization_id on public.screens(organization_id);
create index if not exists idx_screens_status on public.screens(status);
create index if not exists idx_screens_created_at on public.screens(created_at desc);

-- Ensure current_state column exists (in case 20240310 migration wasn't applied)
alter table public.screens
  add column if not exists current_state jsonb default '{}'::jsonb;

-- Ensure last_heartbeat column exists
alter table public.screens
  add column if not exists last_heartbeat timestamptz;

-- Ensure resolution and orientation columns exist
alter table public.screens
  add column if not exists resolution text default '1920x1080';
alter table public.screens
  add column if not exists orientation text default 'landscape';
