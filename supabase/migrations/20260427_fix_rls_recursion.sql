-- Fix recursive RLS policies causing infinite hangs on joins

create or replace function public.check_project_access(p_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.projects
    where id = p_id
    and organization_id = (select organization_id from public.profiles where id = auth.uid() limit 1)
  );
$$;

drop policy if exists "Users can access their organization playlist items" on public.playlist_items;
create policy "Users can access their organization playlist items"
on public.playlist_items for all to authenticated
using (public.check_project_access(project_id))
with check (public.check_project_access(project_id));

drop policy if exists "Users can access their organization schedules" on public.schedules;
create policy "Users can access their organization schedules"
on public.schedules for all to authenticated
using (public.check_project_access(project_id))
with check (public.check_project_access(project_id));
