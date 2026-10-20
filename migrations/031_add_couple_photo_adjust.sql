-- 031_add_couple_photo_adjust.sql
-- Added 2026-10-20 (TASKS.md Action 86): admin controls for the bride and
-- groom portraits -- frame size, edge fade, and each photo's zoom and position.
-- One JSON object; empty ({}) means "use the defaults".
-- HITL: the owner runs `npm run migrate` BEFORE the code that saves this field
-- is pushed. Reading is safe without it (the code falls back to the defaults),
-- but saving the Theme page writes the column and would fail until it exists.

ALTER TABLE theme_settings
  ADD COLUMN IF NOT EXISTS couple_photo_adjust jsonb NOT NULL DEFAULT '{}'::jsonb;
