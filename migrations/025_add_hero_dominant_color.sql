-- 025_add_hero_dominant_color.sql
-- Added 2026-09-29: Homepage Background Image Enhancement (PRD §18, TASKS.md
-- Action 65). Reuses the existing hero_image_url column for which background
-- shows (a real upload or a curated placeholder's data URI) -- this migration
-- only adds the dominant color used to compute the hero overlay's opacity, so
-- a light photo gets a darker overlay and a dark photo gets a lighter one.
-- HITL: the owner runs `npm run migrate` from their own terminal, and the
-- code that depends on this is pushed only after it has run.

ALTER TABLE theme_settings
  ADD COLUMN IF NOT EXISTS hero_dominant_color text DEFAULT '';
