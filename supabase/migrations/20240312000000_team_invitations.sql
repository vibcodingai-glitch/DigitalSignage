CREATE TABLE invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  token TEXT NOT NULL UNIQUE,
  accepted BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(organization_id, email)
);

CREATE INDEX idx_invites_org ON invites(organization_id);
CREATE INDEX idx_invites_token ON invites(token);

ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS public.user_role
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE POLICY "Users can view invites in their org"
  ON invites FOR SELECT
  USING (organization_id = get_auth_user_organization_id());

CREATE POLICY "Admins can create invites"
  ON invites FOR INSERT
  WITH CHECK (
    organization_id = get_auth_user_organization_id()
    AND get_auth_user_role() IN ('owner', 'admin')
  );

CREATE POLICY "Admins can delete invites"
  ON invites FOR DELETE
  USING (
    organization_id = get_auth_user_organization_id()
    AND get_auth_user_role() IN ('owner', 'admin')
  );

CREATE OR REPLACE FUNCTION accept_invite(invite_token TEXT, user_id UUID)
RETURNS JSONB AS $$
DECLARE
  invite_record invites;
  org_name TEXT;
BEGIN
  SELECT * INTO invite_record FROM invites 
  WHERE token = invite_token 
    AND NOT accepted 
    AND expires_at > now();
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Invalid or expired invite'
    );
  END IF;
  
  UPDATE profiles SET 
    organization_id = invite_record.organization_id,
    role = invite_record.role::user_role
  WHERE id = user_id;
  
  UPDATE invites SET accepted = true WHERE id = invite_record.id;
  
  SELECT name INTO org_name FROM organizations 
  WHERE id = invite_record.organization_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'organization_id', invite_record.organization_id,
    'organization_name', org_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
