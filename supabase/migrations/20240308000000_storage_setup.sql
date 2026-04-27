-- 1. Create the 'content' bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('content', 'content', true)
on conflict (id) do nothing;

-- Ensure RLS is enabled on storage.objects
-- Note: Supabase enables this by default, so we don't need the ALTER TABLE command.

-- Drop existing policies if any to avoid conflicts
drop policy if exists "Org members can upload content" on storage.objects;
drop policy if exists "Org members can update content" on storage.objects;
drop policy if exists "Org members can delete content" on storage.objects;
drop policy if exists "Public content read" on storage.objects;

-- HELPER: Ensure folder path starts with the user's organization ID
-- Example path: "e123-4567/filename.jpg" -> the e123-4567 part MUST match their org ID
create policy "Org members can upload content"
on storage.objects for insert
to authenticated
with check ( 
  bucket_id = 'content' 
  and
  (storage.foldername(name))[1] = public.get_auth_user_organization_id()::text
);

create policy "Org members can update content"
on storage.objects for update
to authenticated
using ( 
  bucket_id = 'content'
  and
  (storage.foldername(name))[1] = public.get_auth_user_organization_id()::text
);

create policy "Org members can delete content"
on storage.objects for delete
to authenticated
using ( 
  bucket_id = 'content'
  and
  (storage.foldername(name))[1] = public.get_auth_user_organization_id()::text
);

-- Public content read:
-- The bucket is public because physical screens do not log in.
-- But the UUIDs are unguessable, so other users cannot list or guess the filenames.
create policy "Public content read"
on storage.objects for select
to public
using ( bucket_id = 'content' );
