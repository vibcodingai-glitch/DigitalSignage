CREATE TABLE screen_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  screen_id UUID NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_screen_logs_screen_created 
  ON screen_logs(screen_id, created_at DESC);

ALTER TABLE screen_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view logs for their org's screens"
  ON screen_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM screens 
      WHERE screens.id = screen_logs.screen_id 
      AND screens.organization_id = get_auth_user_organization_id()
    )
  );
