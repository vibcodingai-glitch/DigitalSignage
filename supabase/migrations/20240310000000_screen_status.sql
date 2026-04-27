-- ============================================================
-- MIGRATION: screens.current_state
-- Adds a JSONB column to screens for storing what is currently
-- playing on the device. Updated by the display client heartbeat.
-- ============================================================

ALTER TABLE public.screens
  ADD COLUMN IF NOT EXISTS current_state JSONB DEFAULT '{}'::jsonb;

-- Also update the update_screen_heartbeat RPC to accept current_state
-- We create a new overloaded version that accepts the state param.
CREATE OR REPLACE FUNCTION public.update_screen_heartbeat_with_state(
  p_display_key UUID,
  p_status TEXT,
  p_current_state JSONB
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.screens
  SET
    last_heartbeat = now(),
    status = p_status::screen_status,
    current_state = p_current_state
  WHERE display_key = p_display_key;
$$;
