-- 004_add_theme_palette_font_choice.sql
-- PRD §4.1 schema impact: theme_settings gains palette_name and font_choice.
-- Existing per-colour/font columns are kept so custom values are never lost.
-- NOT YET APPLIED to any database — HITL.md requires explicit approval before
-- running migrations against any non-local database.

ALTER TABLE theme_settings
  ADD COLUMN IF NOT EXISTS palette_name text DEFAULT 'modern-royal-romance',
  ADD COLUMN IF NOT EXISTS font_choice text DEFAULT 'cormorant';

-- The site's default look (owner decision, 2026-08-28) is the "Modern Royal
-- Romance" ThemePalette, not the original placeholder gold from migration
-- 003. Update the column defaults so any future fresh row lands on it...
ALTER TABLE theme_settings
  ALTER COLUMN primary_color SET DEFAULT '#4A1525',
  ALTER COLUMN secondary_color SET DEFAULT '#FBF9F5',
  ALTER COLUMN accent_color SET DEFAULT '#866D3D';

-- ...and backfill the existing single seed row from migration 003, but only
-- if it still holds that original placeholder gold untouched — if the couple
-- already customised their colours, this must not overwrite that choice.
UPDATE theme_settings
SET palette_name = 'modern-royal-romance',
    font_choice = 'cormorant',
    primary_color = '#4A1525',
    secondary_color = '#FBF9F5',
    accent_color = '#866D3D'
WHERE primary_color = '#B8860B'
  AND secondary_color = '#FFF8DC'
  AND accent_color = '#8B0000';
