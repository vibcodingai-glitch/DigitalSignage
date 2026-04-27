-- Add public read access for screens using display_key
create policy "Public screens access"
on public.screens for select
to public
using (display_key is not null);

create policy "Public projects access"
on public.projects for select
to public
using (is_active = true or id in (select active_project_id from public.screens));

create policy "Public playlist_items access"
on public.playlist_items for select
to public
using (project_id in (select id from public.projects where is_active = true or id in (select active_project_id from public.screens)));

create policy "Public content_items access"
on public.content_items for select
to public
using (true); -- Public can read content_items, or restricted if preferred

create policy "Public push_events access"
on public.push_events for select
to public
using (true);

-- Allow public to update screen last_heartbeat and status
-- We can add a simple policy for update, or an RPC function to avoid trusting client data.
-- Since this is an internal/unauthenticated physical screen, an RPC is safer.

create or replace function public.update_screen_heartbeat(p_display_key uuid, p_status text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.screens 
  set last_heartbeat = now(), status = p_status 
  where display_key = p_display_key;
$$;
