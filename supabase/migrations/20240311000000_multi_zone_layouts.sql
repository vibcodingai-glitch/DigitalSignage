ALTER TABLE projects ADD COLUMN IF NOT EXISTS 
  layout_type TEXT NOT NULL DEFAULT 'fullscreen'
  CHECK (layout_type IN (
    'fullscreen',
    'split_horizontal', 
    'split_vertical',
    'l_shape',
    'grid_2x2',
    'main_ticker'
  ));

ALTER TABLE projects ADD COLUMN IF NOT EXISTS 
  layout_settings JSONB DEFAULT '{}'::jsonb;

ALTER TABLE playlist_items ADD COLUMN IF NOT EXISTS
  zone_index INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_playlist_items_zone 
  ON playlist_items(project_id, zone_index, order_index);
