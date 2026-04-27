-- Fix: auto-create an organization for new users on registration
-- and update the handle_new_user trigger to wire up organization_id

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_org_id uuid;
  v_org_name text;
  v_org_slug text;
begin
  -- Derive an org name from user metadata or email
  v_org_name := coalesce(
    new.raw_user_meta_data->>'organization_name',
    new.raw_user_meta_data->>'full_name',
    split_part(new.email, '@', 1)
  ) || '''s Workspace';

  -- Build a slug: lowercase, alphanumeric + hyphens, unique via timestamp suffix
  v_org_slug := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9]', '-', 'g'))
    || '-' || extract(epoch from now())::bigint;

  -- Create the organization
  insert into public.organizations (name, slug)
  values (v_org_name, v_org_slug)
  returning id into v_org_id;

  -- Create the profile linked to the org, with 'owner' role
  insert into public.profiles (id, email, full_name, avatar_url, organization_id, role, created_at)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    v_org_id,
    'owner'::public.user_role,
    now()
  );

  return new;
end;
$$;
