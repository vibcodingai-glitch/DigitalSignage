-- ============================================================
-- MIGRATION: screen_projects
-- Allows assigning multiple projects to a screen, each with
-- their own schedule (days/times/dates) and priority.
-- ============================================================

CREATE TABLE public.screen_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  screen_id UUID NOT NULL REFERENCES public.screens(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Schedule type
  schedule_type TEXT NOT NULL DEFAULT 'always'
    CHECK (schedule_type IN ('always', 'scheduled')),

  -- Day rules: array of integers 0=Sun, 1=Mon ... 6=Sat
  days_of_week INTEGER[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',

  -- Time rules in 24h "HH:MM" format
  start_time TEXT NOT NULL DEFAULT '00:00',
  end_time TEXT NOT NULL DEFAULT '23:59',

  -- Optional date range for limited campaigns
  start_date DATE,
  end_date DATE,

  -- Higher number = higher priority when schedules overlap
  priority INTEGER NOT NULL DEFAULT 0,

  -- Soft toggle without removing the assignment
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- UI sort order
  sort_order INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- One project can only be assigned once per screen
  UNIQUE(screen_id, project_id)
);

-- Indexes
CREATE INDEX idx_screen_projects_screen_id ON public.screen_projects(screen_id);
CREATE INDEX idx_screen_projects_project_id ON public.screen_projects(project_id);
CREATE INDEX idx_screen_projects_org_id ON public.screen_projects(organization_id);

-- Updated_at trigger — reuse the pattern: a before-update trigger per table
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_screen_projects_updated_at
BEFORE UPDATE ON public.screen_projects
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.screen_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org screen_projects"
  ON public.screen_projects FOR SELECT
  USING (organization_id = public.get_auth_user_organization_id());

CREATE POLICY "Users can insert their org screen_projects"
  ON public.screen_projects FOR INSERT
  WITH CHECK (organization_id = public.get_auth_user_organization_id());

CREATE POLICY "Users can update their org screen_projects"
  ON public.screen_projects FOR UPDATE
  USING (organization_id = public.get_auth_user_organization_id());

CREATE POLICY "Users can delete their org screen_projects"
  ON public.screen_projects FOR DELETE
  USING (organization_id = public.get_auth_user_organization_id());

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.screen_projects;
