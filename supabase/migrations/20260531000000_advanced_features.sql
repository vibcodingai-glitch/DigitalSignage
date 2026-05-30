-- Migration: Advanced Features (Scheduling & Interactivity)

-- 1. Add advanced scheduling columns to playlist_items
ALTER TABLE playlist_items
ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS day_part_start TIME NULL,
ADD COLUMN IF NOT EXISTS day_part_end TIME NULL,
ADD COLUMN IF NOT EXISTS days_of_week INTEGER[] NULL; -- e.g., '{1,2,3,4,5}' for Mon-Fri

-- 2. Add interactive / mobile handoff columns to playlist_items
ALTER TABLE playlist_items
ADD COLUMN IF NOT EXISTS show_qr_code BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS qr_code_url TEXT NULL,
ADD COLUMN IF NOT EXISTS interactive_action JSONB NULL; -- e.g., '{"type": "url", "url": "..."}'

-- Update the realtime publication if necessary, but playlist_items is likely already covered.
