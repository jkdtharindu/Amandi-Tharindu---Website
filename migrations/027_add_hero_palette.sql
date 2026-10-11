-- 027_add_hero_palette.sql
-- Added 2026-10-11: section colours read from the hero photo (PRD §22, TASKS.md
-- Action 80, round 2). Stores up to 6 colours read from the hero photo as a
-- comma-separated list of #RRGGBB values, e.g. '#B38E46,#672942,#E8C9A8'.
-- Empty means "not read yet": the sections fall back to the theme's own colours.
-- HITL: the owner applies this BEFORE the code that saves it is merged. Reading
-- is safe without it, but saving the Theme page writes the column and would
-- fail until it exists (same rule as 025 and 026).

ALTER TABLE theme_settings
  ADD COLUMN IF NOT EXISTS hero_palette text NOT NULL DEFAULT '';
