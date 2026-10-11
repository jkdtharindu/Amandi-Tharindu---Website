-- 026_add_section_glass.sql
-- Added 2026-10-11: Section tint + frosted-glass panels (PRD §22, TASKS.md
-- Action 80). Two admin controls on the Theme page: an on/off switch and a
-- 0-100 strength slider for the hero-colour tint and glass look on the big
-- section panels.
-- HITL: the owner applies this (npm run migrate, or Neon's SQL Editor) BEFORE
-- the code that saves these fields is merged/deployed. Reading is safe
-- without it (the code falls back to on / 60), but saving the Theme page
-- writes both columns and would fail until they exist.

ALTER TABLE theme_settings
  ADD COLUMN IF NOT EXISTS section_glass_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS section_glass_strength integer NOT NULL DEFAULT 60;
