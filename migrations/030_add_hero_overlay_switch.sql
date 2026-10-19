-- 030_add_hero_overlay_switch.sql
-- Added 2026-10-20 (TASKS.md Action 85): an on/off switch for the dark layer
-- on top of the hero photo. On (the default) keeps today's look; off shows the
-- photo as uploaded.
-- HITL: the owner runs `npm run migrate` BEFORE the code that saves this field
-- is pushed. Reading is safe without it (the code falls back to on), but saving
-- the Theme page writes the column and would fail until it exists.

ALTER TABLE theme_settings
  ADD COLUMN IF NOT EXISTS hero_overlay_enabled boolean NOT NULL DEFAULT true;
