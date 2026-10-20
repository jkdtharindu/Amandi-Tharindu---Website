-- 032_add_hero_overlay_strength.sql
-- Added 2026-10-20 (TASKS.md Action 87): a strength slider (0-100) for the dark
-- layer on the hero photo. 100 (the default) keeps today's look; lower values
-- make the layer lighter, and 0 is see-through.
-- HITL: the owner runs `npm run migrate` BEFORE the code that saves this field
-- is pushed. Reading is safe without it (the code falls back to 100), but saving
-- the Theme page writes the column and would fail until it exists.

ALTER TABLE theme_settings
  ADD COLUMN IF NOT EXISTS hero_overlay_strength integer NOT NULL DEFAULT 100;
