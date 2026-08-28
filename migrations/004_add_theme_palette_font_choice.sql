-- 004_add_theme_palette_font_choice.sql
-- PRD §4.1 schema impact: theme_settings gains palette_name and font_choice.
-- Existing per-colour/font columns are kept so custom values are never lost.
-- NOT YET APPLIED to any database — HITL.md requires explicit approval before
-- running migrations against any non-local database.

ALTER TABLE theme_settings
  ADD COLUMN IF NOT EXISTS palette_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS font_choice text DEFAULT '';
