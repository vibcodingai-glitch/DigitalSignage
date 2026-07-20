-- ============================================================
-- MIGRATION: campaigns & campaign_screens
-- Enables the Campaign Override feature — a named package
-- that overrides each screen's standard project on demand.
-- ============================================================

-- 1. campaigns table
CREATE TABLE public.campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  color           TEXT DEFAULT '#6366f1',   -- UI accent colour
  is_active       BOOLEAN NOT NULL DEFAULT false,
  activated_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 2. campaign_screens — maps each screen to its override project
CREATE TABLE public.campaign_screens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  screen_id   UUID NOT NULL REFERENCES public.screens(id)   ON DELETE CASCADE,
  project_id  UUID NOT NULL REFERENCES public.projects(id)  ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(campaign_id, screen_id)
);

-- 3. Add campaign_id to screen_projects so we can clean up on deactivate
ALTER TABLE public.screen_projects
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE;

-- Indexes
CREATE INDEX idx_campaigns_org_id         ON public.campaigns(organization_id);
CREATE INDEX idx_campaign_screens_camp_id ON public.campaign_screens(campaign_id);
CREATE INDEX idx_campaign_screens_screen  ON public.campaign_screens(screen_id);
CREATE INDEX idx_screen_projects_camp_id  ON public.screen_projects(campaign_id);

-- Ensure the updated_at helper function exists (may already exist from earlier migrations)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- updated_at trigger for campaigns
CREATE TRIGGER tr_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: campaigns
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org campaigns"
  ON public.campaigns FOR SELECT
  USING (organization_id = public.get_auth_user_organization_id());

CREATE POLICY "Users can insert their org campaigns"
  ON public.campaigns FOR INSERT
  WITH CHECK (organization_id = public.get_auth_user_organization_id());

CREATE POLICY "Users can update their org campaigns"
  ON public.campaigns FOR UPDATE
  USING (organization_id = public.get_auth_user_organization_id());

CREATE POLICY "Users can delete their org campaigns"
  ON public.campaigns FOR DELETE
  USING (organization_id = public.get_auth_user_organization_id());

-- RLS: campaign_screens (join through campaigns for org check)
ALTER TABLE public.campaign_screens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their campaign_screens"
  ON public.campaign_screens FOR SELECT
  USING (
    campaign_id IN (
      SELECT id FROM public.campaigns
      WHERE organization_id = public.get_auth_user_organization_id()
    )
  );

CREATE POLICY "Users can insert their campaign_screens"
  ON public.campaign_screens FOR INSERT
  WITH CHECK (
    campaign_id IN (
      SELECT id FROM public.campaigns
      WHERE organization_id = public.get_auth_user_organization_id()
    )
  );

CREATE POLICY "Users can update their campaign_screens"
  ON public.campaign_screens FOR UPDATE
  USING (
    campaign_id IN (
      SELECT id FROM public.campaigns
      WHERE organization_id = public.get_auth_user_organization_id()
    )
  );

CREATE POLICY "Users can delete their campaign_screens"
  ON public.campaign_screens FOR DELETE
  USING (
    campaign_id IN (
      SELECT id FROM public.campaigns
      WHERE organization_id = public.get_auth_user_organization_id()
    )
  );

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaigns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_screens;
